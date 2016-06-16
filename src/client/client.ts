/// <reference path="../../typings/main.d.ts" />

import {loggerFor, debugFor} from "../utils/logger";
import {Messenger} from "../connection/messenger";
import {FileContainer, FileContainerOptions} from "../fs_helpers/file_container";
import {EventsHelper} from "./events_helper";
import config from "../configuration";
import {StrategySubject, SyncData, SynchronizationStrategy} from "../sync_strategy/sync_strategy";
import {CallbackHelper} from "../transport/callback_helper";
import {NoActionStrategy} from "../sync_strategy/no_action_strategy";
import * as _ from "lodash";
import {TransferHelper} from "../transport/transfer_helper";

const debug = debugFor("syncrow:client");
const logger = loggerFor('Client');

export interface ClientOptions {
    socketsLimit?:number
    strategy?:SynchronizationStrategy,
    filter?:(s:string)=>boolean;
}

export class Client implements StrategySubject {
    static events = {
        fileChanged: 'fileChanged',
        fileCreated: 'fileCreated',
        fileDeleted: 'fileDeleted',
        directoryCreated: 'directoryCreated',

        getFileList: 'getFileList',
        getMetaForFile: 'getMetaForFile',
        metaDataForFile: 'metaDataForFile',
        fileList: 'fileList'
    };
    private otherParty:Messenger;
    private callbackHelper:CallbackHelper;
    private fileContainer:FileContainer;
    private transferHelper:TransferHelper;
    private syncStrategy:SynchronizationStrategy;
    private filterFunction:(s:string)=>boolean;

    /**
     * End application client
     * @param pathToWatch
     * @param otherParty
     * @param options
     */
    constructor(pathToWatch:string, otherParty:Messenger, options:ClientOptions = {}) {

        const socketsLimit = options.socketsLimit ? options.socketsLimit : config.client.socketsLimit;
        const syncStrategy = options.strategy ? options.strategy : new NoActionStrategy();
        this.filterFunction = options.filter ? options.filter : s => false;

        this.fileContainer = this.createDirectoryWatcher(pathToWatch, {filter: this.filterFunction});
        this.otherParty = this.addOtherPartyMessenger(otherParty);

        this.transferHelper = new TransferHelper(this.fileContainer, {
            preferConnecting: true,
            transferQueueSize: socketsLimit,
            name: 'Client'
        });

        this.callbackHelper = new CallbackHelper();
        this.fileContainer.beginWatching();
        this.syncStrategy = syncStrategy;
        this.syncStrategy.setData(this, this.fileContainer);

        if (this.otherParty.isMessengerAlive()) this.syncStrategy.synchronize(otherParty, _.noop);
    }

    /**
     * @param otherParty
     * @returns {Messenger}
     */
    public addOtherPartyMessenger(otherParty:Messenger) {
        otherParty.on(Messenger.events.message, (message:string)=>this.handleEvent(this.otherParty, message));

        otherParty.on(Messenger.events.alive, ()=> {
            this.syncStrategy.synchronize(otherParty, _.noop); //TODO add better places for this
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
    public pushFileToRemote(otherParty:Messenger, fileName:string, callback:Function):any {
        this.transferHelper.sendFileToRemote(otherParty, fileName, callback);
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public getRemoteFileMeta(otherParty:Messenger, fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any {
        const id = this.callbackHelper.addCallback(callback);
        EventsHelper.sendEvent(otherParty, Client.events.getMetaForFile, {fileName: fileName, id: id});
    }

    /**
     * @param otherParty
     * @param callback
     */
    public getRemoteFileList(otherParty:Messenger, callback:(err:Error, fileList?:Array<string>)=>any):any {
        const id = this.callbackHelper.addCallback(callback);
        EventsHelper.sendEvent(otherParty, Client.events.getFileList, {id: id});
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public requestRemoteFile(otherParty:Messenger, fileName:string, callback:ErrorCallback):any {
        this.transferHelper.getFileFromRemote(otherParty, fileName, callback);
    }

    private handleEvent(otherParty:Messenger, message:string) {
        let event = EventsHelper.parseEvent(otherParty, message);
        if (!event) return;

        debug(`Client - received a ${event.type} event: ${JSON.stringify(event)}`);

        if (event.type === TransferHelper.outerEvent) {
            this.transferHelper.consumeMessage(event.body, otherParty);

        } else if (event.type === Client.events.metaDataForFile) {
            this.callbackHelper.retriveCallback(event.body.id)(null, event.body.syncData);

        } else if (event.type === Client.events.fileList) {
            this.callbackHelper.retriveCallback(event.body.id)(null, event.body.fileList);

        } else if (event.type === Client.events.fileCreated) {
            this.transferHelper.getFileFromRemote(otherParty, event.body.fileName);

        } else if (event.type === Client.events.fileChanged) {
            this.transferHelper.getFileFromRemote(otherParty, event.body.fileName);

        } else if (event.type === Client.events.getFileList) {
            return this.fileContainer.getFileTree((err, fileList)=> {
                if (err) return logger.error(err);

                EventsHelper.sendEvent(otherParty, Client.events.fileList,
                    {fileList: fileList, id: event.body.id}
                );
            });

        } else if (event.type === Client.events.getMetaForFile) {
            return this.fileContainer.getFileMeta(event.body.fileName, (err, syncData)=> {
                if (err)return logger.error(err);

                EventsHelper.sendEvent(otherParty,
                    Client.events.metaDataForFile,
                    {syncData: syncData,id: event.body.id}
                )
            });

        } else if (event.type === Client.events.directoryCreated) {
            return this.fileContainer.createDirectory(event.body.fileName);

        } else if (event.type === Client.events.fileDeleted) {
            return this.fileContainer.deleteFile(event.body.fileName);

        } else if (event.type === EventsHelper.events.error) {
            return console.info(`received error message ${JSON.stringify(event.body)}`);
        }

        logger.warn(`unknown event type: ${event}`);
        EventsHelper.sendEvent(otherParty, EventsHelper.events.error, `unknown event type: ${event.type}`);
    }

    private createDirectoryWatcher(directoryToWatch:string, options:FileContainerOptions):FileContainer {
        const fileContainer = new FileContainer(directoryToWatch, options);

        fileContainer.on(FileContainer.events.changed, (eventContent)=> {
            debug(`detected file changed: ${eventContent}`);
            EventsHelper.sendEvent(this.otherParty, Client.events.fileChanged, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.fileCreated, (eventContent)=> {
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
