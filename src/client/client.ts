/// <reference path="../../typings/main.d.ts" />

import fs = require('fs');
import net = require('net');
import Messenger= require('../helpers/messenger');
import FileContainer = require("../helpers/file_container");
import Logger = require('../helpers/logger');
import EventsHelper from "../helpers/events_helper";
import TransferQueue from "../helpers/transfer_queue";
import Configuration = require('../configuration');
import TransferActions = require("../helpers/transfer_actions");

let logger = Logger.getNewLogger('Client', Configuration.client.logLevel);
const debug = require('debug')('syncrow:client');

import errorPrinter = require('../utils/error_printer');

//TODO add support syncing after reestablishing connection
//TODO add support for deleting offline
//TODO Strategies for offline loading
//TODO extract the common parts of client and bucket

class Client {
    otherParty:Messenger;
    fileContainer:FileContainer;
    filesToSync:Object;
    transferJobsQueue:TransferQueue;

    static events = {
        fileChanged: 'fileChanged',
        fileDeleted: 'fileDeleted',
        directoryCreated: 'directoryCreated',

        getFile: 'getFile',
        getFileList: 'getFileList',
        getMeta: 'getMeta',
        metaData: 'metaData',
    };


    constructor(pathToWatch:string, otherParty:Messenger, socketsLimit = Configuration.client.socketsLimit) {
        this.filesToSync = {};
        this.fileContainer = this.createDirectoryWatcher(pathToWatch);
        this.otherParty = this.addOtherPartyMessenger(otherParty);
        this.transferJobsQueue = new TransferQueue(socketsLimit);
    }

    /**
     * @param socketMessenger
     * @returns {Messenger}
     */
    public addOtherPartyMessenger(socketMessenger:Messenger) {
        socketMessenger.on(Messenger.events.message, (message:string)=>this.handleEvent(this.otherParty, message));

        socketMessenger.on(Messenger.events.connected, ()=> {
            logger.info('connected with other party beginning to sync');
            // this.fileContainer.recomputeMetaDataForDirectory(); //TODO remove
        });

        socketMessenger.on(Messenger.events.disconnected, ()=>logger.info('disconnected, waiting for reconnection'));
        return socketMessenger;
    }

    private handleEvent(otherParty:Messenger, message:string) {
        let event = EventsHelper.parseEvent(otherParty, message);
        if (!event) return;

        debug(`Client - received a ${event.type} event: ${JSON.stringify(event.body)}`);

        if (this.handleTransferEvents(event, otherParty)) {
            return debug('routed transfer event');

        } else if (event.type === Client.events.getFile) {
            EventsHelper.writeEventToOtherParty(otherParty, TransferActions.events.listenAndDownload, event.body);
            return;

        } else if (event.type === Client.events.metaData) {
            this.addSyncMetaDataFromOtherParty(event.body);
            return;

        } else if (event.type === Client.events.getMeta) {
            this.fileContainer.recomputeMetaDataForDirectory();
            return;

        } else if (event.type === FileContainer.events.createdDirectory) {
            this.fileContainer.createDirectory(event.body);
            return;

        } else if (event.type === Client.events.fileDeleted) {
            this.fileContainer.deleteFile(event.body);
            return;

        } else if (event.type === EventsHelper.events.error) {
            console.info(`received error message ${JSON.stringify(event.body)}`);
            return;
        }

        EventsHelper.writeEventToOtherParty(otherParty, EventsHelper.events.error, `unknown event type: ${event.type}`);
    }

    private handleTransferEvents(event:{type:string, body?:any}, otherParty:Messenger):boolean {
        if (event.type === TransferActions.events.connectAndUpload) {
            this.transferJobsQueue.addConnectAndUploadJobToQueue(event.body.fileName, event.body.address,
                this.fileContainer, `client - uploading: ${event.body.fileName}`);
            return true;

        } else if (event.type === TransferActions.events.connectAndDownload) {
            this.transferJobsQueue.addConnectAndDownloadJobToQueue(event.body.address, event.body.name,
                this.fileContainer, `client - downloading: ${event.body.fileName}`);
            return true;

        } else if (event.type === TransferActions.events.listenAndDownload) {
            this.transferJobsQueue.addListenAndDownloadJobToQueue(otherParty, event.body.fileName,
                otherParty.getOwnHost(), this.fileContainer, `client - downloading: ${event.body.fileName}`);
            return true;

        } else if (event.type === TransferActions.events.listenAndUpload) {
            this.transferJobsQueue.addListenAndUploadJobToQueue(event.body.fileName, otherParty,
                this.otherParty.getOwnHost(), this.fileContainer, `client - uploading: ${event.body.fileName}`);
            return true;

        }

        return false;
    }

    private createDirectoryWatcher(directoryToWatch:string):FileContainer {
        var fileContainer = new FileContainer(directoryToWatch);

        fileContainer.on(FileContainer.events.changed, (eventContent)=> {
            debug(`detected file changed: ${eventContent}`);
            EventsHelper.writeEventToOtherParty(this.otherParty, Client.events.fileChanged, eventContent);
        });

        fileContainer.on(FileContainer.events.created, (eventContent)=> {
            debug(`detected file created: ${eventContent}`);
            EventsHelper.writeEventToOtherParty(this.otherParty, Client.events.fileChanged, eventContent);
        });

        fileContainer.on(FileContainer.events.deleted, (eventContent)=> {
            debug(`detected file deleted: ${eventContent}`);
            EventsHelper.writeEventToOtherParty(this.otherParty, Client.events.fileDeleted, eventContent);
        });

        fileContainer.on(FileContainer.events.createdDirectory, (eventContent)=> {
            EventsHelper.writeEventToOtherParty(this.otherParty, Client.events.directoryCreated, eventContent);
        });

        fileContainer.on(FileContainer.events.metaComputed, (metaData)=> {
            this.addSyncMetaDataFromOwnContainer(metaData);
            EventsHelper.writeEventToOtherParty(this.otherParty, Client.events.metaData, metaData);
        });

        fileContainer.getListOfTrackedFilesAndBeginWatching();

        return fileContainer;
    }


    //TODO separate into strategy file
    private addSyncMetaDataFromOtherParty(syncData:{hashCode:string, modified:Date, name:string}):void {
        if (this.filesToSync[syncData.name]) {
            this.compareSyncMetaData(this.filesToSync[syncData.name], syncData);
            delete this.filesToSync[syncData.name];
            return;

        } else if (syncData.hashCode === FileContainer.directoryHashConstant && !this.fileContainer.isFileInContainer(syncData.name)) {
            return this.fileContainer.createDirectory(syncData.name);

        } else if (!this.fileContainer.isFileInContainer(syncData.name)) {
            return EventsHelper.writeEventToOtherParty(this.otherParty, Client.events.getFile, syncData.name);
        }
    }

    private addSyncMetaDataFromOwnContainer(syncData:{hashCode:string, modified:Date, name:string}) {
        if (this.filesToSync[syncData.name]) {
            this.compareSyncMetaData(syncData, this.filesToSync[syncData.name]);
            delete this.filesToSync[syncData.name];
        }
    }

    private compareSyncMetaData(ownMeta:{hashCode:string, modified:Date, name:string}, otherPartyMeta:{hashCode:string, modified:Date, name:string}) {
        Client.checkMetaDataFileIsTheSame(ownMeta, otherPartyMeta);
        if (otherPartyMeta.hashCode !== ownMeta.hashCode && ownMeta.hashCode) {
            if (otherPartyMeta.modified.getTime() > ownMeta.modified.getTime()) {
                return EventsHelper.writeEventToOtherParty(this.otherParty, Client.events.getFile, ownMeta.name);
            }
        }
    }

    private static checkMetaDataFileIsTheSame(ownMeta:{hashCode:string; modified:Date; name:string}, otherPartyMeta:{hashCode:string; modified:Date; name:string}) {
        if (ownMeta.name !== otherPartyMeta.name) {
            throw new Error('comparing not matching metadata')
        }
    }
}

export  = Client;