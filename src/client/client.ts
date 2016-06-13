/// <reference path="../../typings/main.d.ts" />

import {loggerFor, debugFor} from "../utils/logger";
import {Messenger} from "../connection/messenger";
import {FileContainer, FileContainerOptions} from "../fs_helpers/file_container";
import {TransferQueue} from "../transport/transfer_queue";
import {EventsHelper} from "./events_helper";
import {TransferActions} from "../transport/transfer_actions";
import config from "../configuration";
import {StrategySubject, SyncData, SynchronizationStrategy} from "../sync_strategy/sync_strategy";
import {CallbackHelper} from "../transport/callback_helper";
import {NoActionStrategy} from "../sync_strategy/no_action_strategy";
import * as _ from "lodash";
import {Offer, Pull, EventTypes, PullResponse} from "./events";

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
    private transferJobsQueue:TransferQueue;
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
        this.transferJobsQueue = new TransferQueue(socketsLimit);
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
    public getRemoteFileMeta(otherParty:Messenger, fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any {
        this.callbackHelper.sendWrapped(otherParty, Client.events.getMetaForFile, {fileName: fileName}, (err, event)=> {
            return callback(err, event.body);
        });
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public offerFileToRemote(otherParty:Messenger, fileName:string, callback:Function):any {

        const id = CallbackHelper.generateEventId();

        const fileOffer:Offer = {
            id: `${id}`,
            type: 'offer',
            fileName: fileName
        };

        this.callbackHelper.addCallback(id, callback);
        EventsHelper.sendEventTwo(otherParty, fileOffer);
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
     * @param id
     */
    public requestRemoteFile(otherParty:Messenger, fileName:string, callback:Function, id:string = null):any {

        id = id ? id : CallbackHelper.generateEventId();

        const filePull:Pull = {
            id: `${id}`,
            type: 'pull',
            fileName: fileName,
            command: TransferActions.events.listenAndUpload
        };

        this.callbackHelper.addCallbackWithId(id, callback);

        EventsHelper.sendEventTwo(otherParty, filePull);

        // EventsHelper.sendEvent(otherParty, TransferActions.events.listenAndUpload, {fileName: fileName});
        // callback(); //TODO implement strategy to handle callbacks
        //TODO: FILE_REQUEST_CALLBACK_STRATEGY - store callback here in callbackHelper
    }

    private handleEvent(otherParty:Messenger, message:string) {
        let event = EventsHelper.parseEvent(otherParty, message);
        if (!event) return;

        debug(`Client - received a ${event.type} event: ${JSON.stringify(event)}`);

        if (event.type === EventTypes.offer) {
            debug('got offer');
            const offer = <Offer> event;
            this.requestRemoteFile(otherParty, offer.fileName, _.noop, offer.id)

        } else if (event.type === EventTypes.pull) {
            debug('got a pull');
            const pull = <Pull>event;

            const pullResponse:PullResponse = {
                fileName: pull.fileName,
                id: pull.id,
                type: EventTypes.pullResponse,
                command: TransferActions.events.listenAndDownload
            };

            EventsHelper.sendEventTwo(otherParty, pullResponse);
        } else if (event.type === EventTypes.pullResponse) {
            debug('got a pull response');
            const pullResponse = <PullResponse> event;

            if (pullResponse.command === TransferActions.events.connectAndDownload) {
                this.transferJobsQueue.addConnectAndDownloadJobToQueue(
                    {host: pullResponse.host, port: pullResponse.port},
                    pullResponse.fileName,
                    this.fileContainer,
                    `client - downloading: ${pullResponse.fileName}`,
                    this.callbackHelper.retriveCallback(pullResponse.id));
                return;
            }
            if(pullResponse.command === TransferActions.events.listenAndDownload){
                
            }


        } else if (this.handleTransferEvents(event, otherParty)) {
            return debug('routed transfer event');

        } else if (this.callbackHelper.checkResponse(event)) {
            return debug('routed event with callback');

        } else if (event.type === Client.events.fileChanged) {
            return EventsHelper.sendEvent(otherParty, TransferActions.events.listenAndUpload, {fileName: event.body.fileName});
            //TODO  FILE_REQUEST_CALLBACK_STRATEGY use here requestRemoteFile

        } else if (event.type === Client.events.getFileList) {
            return this.fileContainer.getFileTree((err, fileList)=> {
                if (err) return logger.error(err);
                EventsHelper.sendEvent(otherParty, Client.events.fileList, fileList, event.id);
            });

        } else if (event.type === Client.events.getMetaForFile) {
            return this.fileContainer.getFileMeta(event.body.fileName, (err, syncData)=> {
                if (err)return logger.error(err);

                EventsHelper.sendEvent(otherParty, Client.events.metaDataForFile, syncData, event.id)
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

    private handleTransferEvents(event:{type:string, body?:any}, otherParty:Messenger):boolean {
        if (event.type === TransferActions.events.connectAndUpload) {
            this.transferJobsQueue.addConnectAndUploadJobToQueue(event.body.fileName, event.body.address,
                this.fileContainer, `client - uploading: ${event.body.fileName}`);
            return true;

        } else if (event.type === TransferActions.events.connectAndDownload) {
            this.transferJobsQueue.addConnectAndDownloadJobToQueue(event.body.address, event.body.fileName,
                this.fileContainer, `client - downloading: ${event.body.fileName}`);
            return true;
            //TODO FILE_REQUEST_CALLBACK_STRATEGY - here after download is complete check callbaks in callback helper

        } else if (event.type === TransferActions.events.listenAndDownload) {
            this.transferJobsQueue.addListenAndDownloadJobToQueue(otherParty, event.body.fileName,
                otherParty.getOwnHost(), this.fileContainer, `client - downloading: ${event.body.fileName}`);
            return true;
            //TODO FILE_REQUEST_CALLBACK_STRATEGY - here after download is complete check callbacks

        } else if (event.type === TransferActions.events.listenAndUpload) {
            this.transferJobsQueue.addListenAndUploadJobToQueue(event.body.fileName, otherParty,
                this.otherParty.getOwnHost(), this.fileContainer, `client - uploading: ${event.body.fileName}`);
            return true;

        }
        return false;
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
