/// <reference path="../../typings/main.d.ts" />

import {loggerFor, debugFor} from "../utils/logger";
import {Messenger} from "../transport/messenger";
import {FileContainer} from "../fs_helpers/file_container";
import {TransferQueue} from "../transport/transfer_queue";
import {EventsHelper} from "./events_helper";
import {TransferActions} from "../transport/transfer_actions";
import config from "../configuration";
import {StrategySubject, SyncData, SynchronizationStrategy} from "../sync_strategy/synchronization_strategy";
import {AcceptNewestStrategy} from "../sync_strategy/accept_newest_strategy";
import {handleTransferEvents} from "../transport/handle_trasnfer_evens";

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
    private fileContainer:FileContainer;
    private transferJobsQueue:TransferQueue;
    private syncStrategy:SynchronizationStrategy;
    private remoteMetaCallbacks:Map<string,(syncData:SyncData)=>any>;
    private remoteFileListCallback:(result:Array<string>)=>any;

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

        this.remoteMetaCallbacks = new Map();

        this.fileContainer.beginWatching();

        if (!syncStrategy) {
            this.syncStrategy = new AcceptNewestStrategy(this);
        } else {
            this.syncStrategy = syncStrategy;
        }

        if (otherParty.isMessengerAlive()) {
            this.syncStrategy.acknowledgeConnectedWithRemoteParty();
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
            this.syncStrategy.acknowledgeConnectedWithRemoteParty();
        });

        otherParty.on(Messenger.events.recovering, ()=> {
            debug(`lost connection with remote party - recovering`);
            this.remoteMetaCallbacks.clear();
            delete this.remoteFileListCallback;
            this.syncStrategy.acknowledgeReconnectingWithRemoteParty();
        });

        otherParty.on(Messenger.events.died, ()=> {
            debug(`lost connection with remote party - permanently`);
            this.remoteMetaCallbacks.clear();
            delete this.remoteFileListCallback;
            this.syncStrategy.acknowledgeDisconnectedWithRemoteParty();
        });

        return otherParty;
    }

    /**
     * @param fileName
     * @param callback
     */
    public getLocalFileMeta(fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any {
        this.fileContainer.getFileMeta(fileName, callback);
    }

    /**
     * @param fileName
     * @param callback
     */
    public getRemoteFileMeta(fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any {

        this.remoteMetaCallbacks.set(fileName, (result:SyncData)=> {
            this.remoteMetaCallbacks.delete(fileName);
            callback(null, result);
        });

        EventsHelper.writeEventToOtherParty(this.otherParty, Client.events.getMetaForFile, {fileName: fileName});
    }

    /**
     * @param callback
     */
    public getLocalFileList(callback:(err:Error, fileList?:Array<string>)=>any):any {
        this.fileContainer.getFileTree(callback);
    }

    /**
     * @param callback
     */
    public getRemoteFileList(callback:(err:Error, fileList?:Array<string>)=>any):any {

        this.remoteFileListCallback = (result:Array<string>)=> {
            delete  this.getRemoteFileList;
            debug('remoteFileList callback called');
            callback(null, result);
        };

        EventsHelper.writeEventToOtherParty(this.otherParty, Client.events.getFileList);
    }

    /**
     * @param fileName
     * @param callback
     */
    public requestRemoteFile(fileName:string, callback:Function):any {
        EventsHelper.writeEventToOtherParty(this.otherParty, Client.events.getFile, {fileName: fileName});
        callback(); //TODO implement strategy to handle callbacks
    }

    /**
     * @param fileName
     * @param callback
     */
    public deleteLocalFile(fileName:string, callback:Function):any {
        this.fileContainer.deleteFile(fileName, callback);
    }

    /**
     * @param directoryName
     * @param callback
     */
    public createLocalDirectory(directoryName:string, callback:Function):any {
        this.fileContainer.createDirectory(directoryName, callback);
    }

    private handleEvent(otherParty:Messenger, message:string) {
        let event = EventsHelper.parseEvent(otherParty, message);
        if (!event) return;

        debug(`Client - received a ${event.type} event: ${JSON.stringify(event.body)}`);

        if (handleTransferEvents(event, otherParty, this.fileContainer, this.transferJobsQueue, 'Client', 'Client')) {
            return debug('routed transfer event');

        } else if (event.type === Client.events.fileChanged) {
            return this.syncStrategy.acknowledgeLocalFileChanged(event.body.fileName);

        } else if (event.type === Client.events.getFile) {
            return EventsHelper.writeEventToOtherParty(otherParty, TransferActions.events.listenAndDownload, {fileName: event.body.fileName});

        } else if (event.type === Client.events.getFileList) {
            return this.fileContainer.getFileTree((err, fileList)=> {
                if (err) return logger.error(err);
                EventsHelper.writeEventToOtherParty(otherParty, Client.events.fileList, fileList);
            });

        } else if (event.type === Client.events.fileList) {
            return this.remoteFileListCallback(event.body);

        } else if (event.type === Client.events.metaDataForFile) {
            return this.addSyncMetaDataFromOtherParty(event.body);

        } else if (event.type === Client.events.getMetaForFile) {
            return this.fileContainer.getFileMeta(event.body.fileName, (err, syncData)=> {
                if (err)return logger.error(err);

                EventsHelper.writeEventToOtherParty(otherParty, Client.events.metaDataForFile, syncData)
            });

        } else if (event.type === Client.events.directoryCreated) {
            return this.syncStrategy.acknowledgeRemoteDirectoryCreated(event.body.fileName);

        } else if (event.type === Client.events.fileDeleted) {
            return this.syncStrategy.acknowledgeRemoteFileDeleted(event.body.fileName);

        } else if (event.type === EventsHelper.events.error) {
            return console.info(`received error message ${JSON.stringify(event.body)}`);
        }

        logger.warn(`unknown event type: ${event}`);
        EventsHelper.writeEventToOtherParty(otherParty, EventsHelper.events.error, `unknown event type: ${event.type}`);
    }

    private createDirectoryWatcher(directoryToWatch:string):FileContainer {
        const fileContainer = new FileContainer(directoryToWatch);

        fileContainer.on(FileContainer.events.changed, (eventContent)=> {
            debug(`detected file changed: ${eventContent}`);
            this.syncStrategy.acknowledgeLocalFileChanged(eventContent);
            EventsHelper.writeEventToOtherParty(this.otherParty, Client.events.fileChanged, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.created, (eventContent)=> {
            debug(`detected file created: ${eventContent}`);
            this.syncStrategy.acknowledgeLocalFileCreated(eventContent);
            EventsHelper.writeEventToOtherParty(this.otherParty, Client.events.fileChanged, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.deleted, (eventContent)=> {
            debug(`detected file deleted: ${eventContent}`);
            this.syncStrategy.acknowledgeLocalFileDeleted(eventContent);
            EventsHelper.writeEventToOtherParty(this.otherParty, Client.events.fileDeleted, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.createdDirectory, (eventContent)=> {
            this.syncStrategy.acknowledgeLocalDirectoryCreated(eventContent);
            EventsHelper.writeEventToOtherParty(this.otherParty, Client.events.directoryCreated, {fileName: eventContent});
        });

        return fileContainer;
    }

    private addSyncMetaDataFromOtherParty(syncData:SyncData):void {
        if (!this.remoteMetaCallbacks.has(syncData.name)) {
            return logger.error(`Got Metadata that was not requested!`);
        }

        const remoteMetaCallback = this.remoteMetaCallbacks.get(syncData.name);
        remoteMetaCallback(syncData);
    }
}