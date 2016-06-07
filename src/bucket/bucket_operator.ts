/// <reference path="../../typings/main.d.ts" />

import {FileContainer} from "../fs_helpers/file_container";
import {EventsHelper} from "../client/events_helper";
import {TransferQueue} from "../transport/transfer_queue";
import {Messenger} from "../connection/messenger";
import {Client} from "../client/client";
import {TransferActions} from "../transport/transfer_actions";
import {loggerFor, debugFor} from "../utils/logger";
import {StrategySubject, SyncData, SynchronizationStrategy} from "../sync_strategy/sync_strategy";
import {CallbackHelper} from "../transport/callback_helper";
import {AcceptNewestStrategy} from "../sync_strategy/accept_newest_strategy";

const debug = debugFor("syncrow:bucket_operator");
const logger = loggerFor('BucketOperator');

export class BucketOperator implements StrategySubject {
    private path:string;
    private host:string;
    private otherParties:Array<Messenger>;
    private container:FileContainer;
    private otherPartiesMessageListeners:Array<Function>;
    private transferJobsQueue:TransferQueue;
    private callbackHelper:CallbackHelper;
    private syncStrategy:SynchronizationStrategy;

    constructor(host:string, path:string, transferConcurrency = 10) {
        this.path = path;
        this.host = host;
        this.container = new FileContainer(path);
        this.otherParties = [];
        this.otherPartiesMessageListeners = [];
        this.transferJobsQueue = new TransferQueue(transferConcurrency);
        this.callbackHelper = new CallbackHelper();
        this.syncStrategy = new AcceptNewestStrategy(this, this.container);
    }

    /**
     * @param otherParty
     */
    public addOtherParty(otherParty:Messenger) {
        debug(`adding other party`);
        const messageListener = (message)=>this.handleEvent(otherParty, message);

        otherParty.once(Messenger.events.died, ()=>this.removeOtherParty(otherParty));
        otherParty.once(Messenger.events.recovering, ()=>this.removeOtherParty(otherParty));
        otherParty.on(Messenger.events.message, (message)=> messageListener(message));

        if (otherParty.isMessengerAlive()) this.syncStrategy.synchronize(otherParty);


        this.otherParties.push(otherParty);
        this.otherPartiesMessageListeners.push(messageListener);
    }

    /**
     * Completely removes otherParty from operator
     * @param otherParty
     */
    public removeOtherParty(otherParty:Messenger) {
        const index = this.otherParties.indexOf(otherParty);
        const messageListener = this.otherPartiesMessageListeners[index];

        otherParty.removeListener(Messenger.events.message, messageListener);

        this.otherParties.splice(index, 1);
        this.otherPartiesMessageListeners.splice(index, 1);
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public getRemoteFileMeta(otherParty:Messenger, fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any {
        this.callbackHelper.sendWrapped(otherParty, Client.events.getMetaForFile, {fileName: fileName}, (err, event)=> {
            callback(err, event.body);
        });
    }

    /**
     * @param otherParty
     * @param callback
     */
    public getRemoteFileList(otherParty:Messenger, callback:(err:Error, fileList?:Array<string>)=>any):any {
        this.callbackHelper.sendWrapped(otherParty, Client.events.getFileList, {}, (err, event)=> {
            callback(err, event.body);
        });
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     * @returns {undefined}
     */
    public requestRemoteFile(otherParty:Messenger, fileName:string, callback:Function):any {
        this.transferJobsQueue.addListenAndDownloadJobToQueue(otherParty, fileName, this.host, this.container, `BucketOperator: downloading ${fileName}`, callback);
    }

    private handleEvent(otherParty:Messenger, message:string) {
        const event = EventsHelper.parseEvent(otherParty, message);

        debug(`got event from other party: ${event}`);

        if (this.handleTransferEvent(otherParty, event)) {
            return debug('Server handled transfer event');

        } else if (this.callbackHelper.checkResponse(event)) {
            return debug(`Handled event via callbackHelper`)

        } else if (event.type === Client.events.directoryCreated) {
            this.container.createDirectory(event.body.fileName);
            return this.broadcastEvent(event.type, {fileName:event.body.fileName}, otherParty);

        } else if (event.type === Client.events.fileDeleted) {
            this.container.deleteFile(event.body.fileName);
            return this.broadcastEvent(event.type, event.body, otherParty);

        } else if (event.type === Client.events.fileChanged) {
            this.requestRemoteFile(otherParty, event.body.fileName, ()=> {
                this.broadcastEvent(event.type, event.body, otherParty);
            })

        } else if (event.type === Client.events.getFileList) {
            return this.container.getFileTree((err, fileList)=> {
                if (err) return logger.error(err);
                EventsHelper.sendEvent(otherParty, Client.events.fileList, fileList, event.id);
            });

        } else if (event.type === Client.events.getMetaForFile) {
            return this.container.getFileMeta(event.body.fileName, (err, syncData)=> {
                if (err)return logger.error(err);
                EventsHelper.sendEvent(otherParty, Client.events.metaDataForFile, syncData, event.id);
            })

        } else if (event.type === EventsHelper.events.error) {
            logger.warn(`received error message ${JSON.stringify(event.body)}`);
            return;
        }

        EventsHelper.sendEvent(otherParty, EventsHelper.events.error, `unknown event type: ${event.type}`);
    }

    private handleTransferEvent(otherParty:Messenger, event:{type:string, body?:any}):boolean {
        if (event.type === TransferActions.events.connectAndDownload) {
            this.transferJobsQueue.addConnectAndDownloadJobToQueue(event.body.address, event.body.fileName,
                this.container, `Server - downloading: ${event.body.fileName}`, ()=> {
                    this.broadcastEvent(Client.events.fileChanged, event.body.fileName, otherParty);
                });
            return true;

        } else if (event.type === TransferActions.events.connectAndUpload) {
            this.transferJobsQueue.addConnectAndUploadJobToQueue(event.body.fieldName, event.body.address,
                this.container, `Server - uploading: ${event.body.fieldName}`);
            return true;

        } else if (event.type === TransferActions.events.listenAndDownload) {
            this.transferJobsQueue.addListenAndDownloadJobToQueue(otherParty, event.body.fileName, this.host,
                this.container, `Server - downloading: ${event.body.fileName}`, ()=> {
                    this.broadcastEvent(Client.events.fileChanged, event.body.fileName, otherParty);
                });
            return true;

        } else if (event.type === TransferActions.events.listenAndUpload) {
            this.transferJobsQueue.addListenAndUploadJobToQueue(event.body.fileName, otherParty, this.host,
                this.container, `Server - uploading: ${event.body.fileName}`);
            return true;

        }
        return false;
    }

    private broadcastEvent(eventType:string, body:any, excludeParty?:Messenger) {
        this.otherParties.forEach((otherParty)=> {
            if (excludeParty && excludeParty === otherParty) {
                return;
            }

            EventsHelper.sendEvent(otherParty, eventType, body);
        })
    }
}