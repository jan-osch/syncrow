/// <reference path="../../typings/main.d.ts" />

import {loggerFor, debugFor} from "../utils/logger";
import {Messenger} from "../transport/messenger";
import {FileContainer} from "../fs_helpers/file_container";
import {TransferQueue} from "../transport/transfer_queue";
import {EventsHelper} from "./events_helper";
import {TransferActions} from "../transport/transfer_actions";
import config from "../configuration";
import {StrategySubject, SyncData, SynchronizationStrategy} from "../sync_strategy/sync_strategy";
import {AcceptNewestStrategy} from "../sync_strategy/accept_newest_strategy";
import {CallbackHelper} from "../transport/callback_helper";

const debug = debugFor("syncrow:client");
const logger = loggerFor('Client');

export class Client implements StrategySubject {
    static events = {
        fileChanged: 'fileChanged',
        fileCreated: 'fileCreated',
        fileDeleted: 'fileDeleted',
        directoryCreated: 'directoryCreated',

        getFile: 'getFile',
        getFileList: 'getFileList',
        getMetaForFile: 'getMetaForFile',
        metaDataForFile: 'metaDataForFile',
        fileList: 'fileList'
    };
    private otherParty:Messenger;
    private callbackHelper:CallbackHelper;
    private fileContainer:FileContainer;
    private transferJobsQueue:TransferQueue;
    private syncStrategy:SynchronizationStrategy;

    /**
     * End application client
     * @param pathToWatch
     * @param otherParty
     * @param socketsLimit
     * @param [syncStrategy]
     */
    constructor(pathToWatch:string, otherParty:Messenger, socketsLimit = config.client.socketsLimit, syncStrategy?:SynchronizationStrategy) {

        this.fileContainer = this.createDirectoryWatcher(pathToWatch);
        this.otherParty = this.addOtherPartyMessenger(otherParty);
        this.transferJobsQueue = new TransferQueue(socketsLimit);
        this.callbackHelper = new CallbackHelper();

        this.fileContainer.beginWatching();

        if (!syncStrategy) {
            this.syncStrategy = new AcceptNewestStrategy(this, this.fileContainer);
        } else {
            this.syncStrategy = syncStrategy;
        }
    }

    /**
     * @param otherParty
     * @returns {Messenger}
     */
    public addOtherPartyMessenger(otherParty:Messenger) {
        otherParty.on(Messenger.events.message, (message:string)=>this.handleEvent(this.otherParty, message));

        otherParty.on(Messenger.events.alive, ()=> {
            logger.info('connected with other party beginning to sync');
        });

        otherParty.on(Messenger.events.recovering, ()=> {
            debug(`lost connection with remote party - recovering`);
        });

        otherParty.on(Messenger.events.died, ()=> {
            debug(`lost connection with remote party - permanently`);
        });

        return otherParty;
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public getRemoteFileMeta(otherParty:Messenger, fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any {
        this.callbackHelper.sendWrapped(otherParty, Client.events.getMetaForFile, {fileName: fileName}, (err, event)=> {
            return callback(err, event.body);
        });
    }

    /**
     * @param otherParty
     * @param callback
     */
    public getRemoteFileList(otherParty:Messenger, callback:(err:Error, fileList?:Array<string>)=>any):any {
        this.callbackHelper.sendWrapped(otherParty, Client.events.getFileList, {}, (err, event)=> {
            return callback(err, event.body);
        });
    }


    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    requestRemoteFile(otherParty:Messenger, fileName:string, callback:Function):any {
        EventsHelper.sendEvent(otherParty, Client.events.getFile, {fileName: fileName});
        callback(); //TODO implement strategy to handle callbacks
    }

    private handleEvent(otherParty:Messenger, message:string) {
        let event = EventsHelper.parseEvent(otherParty, message);
        if (!event) return;

        debug(`Client - received a ${event.type} event: ${JSON.stringify(event.body)}`);

        if (handleTransferEvents(event, otherParty, this.fileContainer, this.transferJobsQueue, 'Client', 'Client')) {
            return debug('routed transfer event');

        } else if (event.type === Client.events.fileChanged) {
            return this.syncStrategy.acknowledgeLocalFileChanged(event.body.fileName);//TODO

        } else if (event.type === Client.events.getFile) {
            return EventsHelper.sendEvent(otherParty, TransferActions.events.listenAndDownload, {fileName: event.body.fileName});

        } else if (event.type === Client.events.getFileList) {
            return this.fileContainer.getFileTree((err, fileList)=> {
                if (err) return logger.error(err);
                EventsHelper.sendEvent(otherParty, Client.events.fileList, fileList);
            });

        } else if (event.type === Client.events.fileList) {
            return this.remoteFileListCallback(event.body);

        } else if (event.type === Client.events.metaDataForFile) {
            return this.addSyncMetaDataFromOtherParty(event.body);

        } else if (event.type === Client.events.getMetaForFile) {
            return this.fileContainer.getFileMeta(event.body.fileName, (err, syncData)=> {
                if (err)return logger.error(err);

                EventsHelper.sendEvent(otherParty, Client.events.metaDataForFile, syncData)
            });

        } else if (event.type === Client.events.directoryCreated) {
            return this.syncStrategy.acknowledgeRemoteDirectoryCreated(event.body.fileName);

        } else if (event.type === Client.events.fileDeleted) {
            return this.syncStrategy.acknowledgeRemoteFileDeleted(event.body.fileName);

        } else if (event.type === EventsHelper.events.error) {
            return console.info(`received error message ${JSON.stringify(event.body)}`);
        }

        logger.warn(`unknown event type: ${event}`);
        EventsHelper.sendEvent(otherParty, EventsHelper.events.error, `unknown event type: ${event.type}`);
    }

    private createDirectoryWatcher(directoryToWatch:string):FileContainer {
        const fileContainer = new FileContainer(directoryToWatch);

        fileContainer.on(FileContainer.events.changed, (eventContent)=> {
            debug(`detected file changed: ${eventContent}`);
            EventsHelper.sendEvent(this.otherParty, Client.events.fileChanged, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.created, (eventContent)=> {
            debug(`detected file created: ${eventContent}`);
            EventsHelper.sendEvent(this.otherParty, Client.events.fileChanged, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.deleted, (eventContent)=> {
            debug(`detected file deleted: ${eventContent}`);
            EventsHelper.sendEvent(this.otherParty, Client.events.fileDeleted, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.createdDirectory, (eventContent)=> {
            EventsHelper.sendEvent(this.otherParty, Client.events.directoryCreated, {fileName: eventContent});
        });

        return fileContainer;
    }
}