import {loggerFor, debugFor} from "../utils/logger";
import {Messenger} from "../connection/messenger";
import {FileContainer, FileContainerOptions} from "../fs_helpers/file_container";
import config from "../configuration";
import {SynchronizationSubject, SyncData, SynchronizationAction} from "../sync_strategy/sync_strategy";
import {CallbackHelper} from "../transport/callback_helper";
import {NoActionStrategy} from "../sync_strategy/no_action_strategy";
import * as _ from "lodash";
import {TransferHelper} from "../transport/transfer_helper";
import {ErrBack} from "../utils/interfaces";
import {EventedMessenger} from "../connection/evented_messenger";

const debug = debugFor("syncrow:client:client");
const logger = loggerFor('Client');

export interface ClientOptions {
    socketsLimit?:number;
    strategy?:SynchronizationAction;
    filter?:(s:string)=>boolean;
    listen?:boolean;
}

export class Client implements SynchronizationSubject {
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
    private otherParty:EventedMessenger;
    private callbackHelper:CallbackHelper;
    private fileContainer:FileContainer;
    private transferHelper:TransferHelper;
    private syncStrategy:SynchronizationAction;
    private filterFunction:(s:string)=>boolean;

    /**
     * End application client
     * @param pathToWatch
     * @param otherParty
     * @param options
     */
    constructor(pathToWatch:string, otherParty:EventedMessenger, options:ClientOptions = {}) {

        const socketsLimit = options.socketsLimit ? options.socketsLimit : config.client.socketsLimit;
        const syncStrategy = options.strategy ? options.strategy : new NoActionStrategy();
        this.filterFunction = options.filter ? options.filter : s => false;

        this.fileContainer = this.createDirectoryWatcher(pathToWatch, {filter: this.filterFunction});

        this.addOtherPartyMessenger(otherParty);

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
    public addOtherPartyMessenger(otherParty:EventedMessenger) {
        this.otherParty = otherParty;

        this.otherParty.on(Messenger.events.alive, ()=> {
            logger.info('connected with other party beginning to sync');
            this.syncStrategy.synchronize(otherParty, _.noop); //TODO add better places for this
        });

        this.otherParty.on(Messenger.events.recovering, ()=> {
            debug(`lost connection with remote party - recovering`);
        });

        this.otherParty.on(Messenger.events.died, ()=> {
            debug(`lost connection with remote party - permanently`);
        });

        this.addClientEventsListenersToMessenger(otherParty);
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public pushFileToRemote(otherParty:EventedMessenger, fileName:string, callback:ErrBack):any {
        this.transferHelper.sendFileToRemote(otherParty, fileName, callback);
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public getRemoteFileMeta(otherParty:EventedMessenger, fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any {
        const id = this.callbackHelper.addCallback(callback);
        otherParty.send(Client.events.getMetaForFile, {fileName: fileName, id: id});
    }

    /**
     * @param otherParty
     * @param callback
     */
    public getRemoteFileList(otherParty:EventedMessenger, callback:(err:Error, fileList?:Array<string>)=>any):any {
        const id = this.callbackHelper.addCallback(callback);
        otherParty.send(Client.events.getFileList, {id: id});
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public requestRemoteFile(otherParty:EventedMessenger, fileName:string, callback:ErrBack):any {
        this.transferHelper.getFileFromRemote(otherParty, fileName, callback);
    }

    private addClientEventsListenersToMessenger(otherParty:EventedMessenger) {

        this.otherParty.on(EventedMessenger.error, (event)=> {
            return logger.error(`received error message ${JSON.stringify(event.body)}`);
        });

        this.otherParty.on(TransferHelper.outerEvent, (event)=>this.transferHelper.consumeMessage(event.body, otherParty));

        this.otherParty.on(Client.events.metaDataForFile, (event)=>this.callbackHelper.getCallback(event.body.id)(null, event.body.syncData));

        this.otherParty.on(Client.events.fileList, (event)=>this.callbackHelper.getCallback(event.body.id)(null, event.body.fileList));

        this.otherParty.on(Client.events.fileCreated, (event)=>this.transferHelper.getFileFromRemote(otherParty, event.body.fileName, logger.error));

        this.otherParty.on(Client.events.fileChanged, (event)=>this.transferHelper.getFileFromRemote(otherParty, event.body.fileName, logger.error));

        this.otherParty.on(Client.events.getFileList, (event)=>this.fileContainer.getFileTree((err, fileList)=> {
            if (err) return logger.error(err);


            otherParty.send(Client.events.fileList, {fileList: fileList, id: event.body.id});
        }));

        this.otherParty.on(Client.events.getMetaForFile, (event)=>this.fileContainer.getFileMeta(event.body.fileName, (err, syncData)=> {
            if (err) return logger.error(err);

            otherParty.send(Client.events.metaDataForFile, {syncData: syncData, id: event.body.id})
        }));

        this.otherParty.on(Client.events.directoryCreated, (event)=> this.fileContainer.createDirectory(event.body.fileName));

        this.otherParty.on(Client.events.fileDeleted, (event)=> this.fileContainer.deleteFile(event.body.fileName));

    }

    private createDirectoryWatcher(directoryToWatch:string, options:FileContainerOptions):FileContainer {
        const fileContainer = new FileContainer(directoryToWatch, options);

        fileContainer.on(FileContainer.events.changed, (eventContent)=> {
            debug(`detected file changed: ${eventContent}`);
            this.otherParty.send(Client.events.fileChanged, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.fileCreated, (eventContent)=> {
            debug(`detected file created: ${eventContent}`);
            this.otherParty.send(Client.events.fileChanged, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.deleted, (eventContent)=> {
            debug(`detected file deleted: ${eventContent}`);
            this.otherParty.send(Client.events.fileDeleted, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.createdDirectory, (eventContent)=> {
            this.otherParty.send(Client.events.directoryCreated, {fileName: eventContent});
        });

        return fileContainer;
    }
}
