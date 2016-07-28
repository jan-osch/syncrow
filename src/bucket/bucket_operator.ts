import {FileContainer} from "../fs_helpers/file_container";
import {Messenger} from "../connection/messenger";
import {Client} from "../client/client";
import {loggerFor, debugFor} from "../utils/logger";
import {SynchronizationSubject, SyncData, SyncAction} from "../sync/sync_actions";
import {CallbackHelper} from "../transport/callback_helper";
import config from "../configuration";
import {TransferHelper} from "../transport/transfer_helper";
import {NoActionStrategy} from "../sync/no_action_strategy";
import {ErrBack} from "../utils/interfaces";
import {EventMessenger} from "../connection/evented_messenger";

const debug = debugFor("syncrow:bucket:operator");
const logger = loggerFor('BucketOperator');

export interface BucketOperatorParams {
    transferConcurrency?:number,
    strategy?:SyncAction,
}

//TODO:
/**
 * 1: Change Client to SyncEngine
 * 2: Implement all BucketOperators Functionalities into SyncEngine
 * 3: Extract
 */

export class BucketOperator implements SynchronizationSubject {
    private otherParties:Array<EventMessenger>;
    private container:FileContainer;
    private transferHelper:TransferHelper;
    private callbackHelper:CallbackHelper;
    private syncStrategy:SyncAction;

    constructor(private host:string, private path:string, options:BucketOperatorParams) {
        const transferConcurrency = options.transferConcurrency ? options.transferConcurrency : config.server.transferQueueSize;
        const strategy = options.strategy ? options.strategy : new NoActionStrategy();

        this.container = new FileContainer(path);
        this.otherParties = [];

        this.transferHelper = new TransferHelper(this.container, {
            transferQueueSize: transferConcurrency,
            name: 'Server',
            preferConnecting: false
        });

        this.callbackHelper = new CallbackHelper();
        this.syncStrategy = strategy;
        this.syncStrategy.setData(this, this.container);
    }

    /**
     * @param otherParty
     */
    public addOtherParty(otherParty:EventMessenger) {
        debug(`adding other party`);

        otherParty.once(Messenger.events.died, ()=>this.removeOtherParty(otherParty));
        otherParty.once(Messenger.events.recovering, ()=>this.removeOtherParty(otherParty));

        if (otherParty.isMessengerAlive()) this.syncStrategy.synchronize(otherParty);

        this.otherParties.push(otherParty);
        this.addEventMessengerListeners(otherParty);
    }

    /**
     * Completely removes otherParty from operator
     * @param otherParty
     */
    public removeOtherParty(otherParty:EventMessenger) {
        otherParty.shutdown();
        const index = this.otherParties.indexOf(otherParty);
        this.otherParties.splice(index, 1);
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public getRemoteFileMeta(otherParty:EventMessenger, fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any {
        const id = this.callbackHelper.addCallback(callback);
        otherParty.send(Client.events.getMetaForFile, {fileName: fileName, id: id});
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     * @returns {undefined}
     */
    public pushFileToRemote(otherParty:EventMessenger, fileName:string, callback:ErrBack):any {
        this.transferHelper.sendFileToRemote(otherParty, fileName, callback);
    }

    /**
     * @param otherParty
     * @param callback
     */
    public getRemoteFileList(otherParty:EventMessenger, callback:(err:Error, fileList?:Array<string>)=>any):any {
        const id = this.callbackHelper.addCallback(callback);
        otherParty.send(Client.events.getFileList, {id: id});
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public requestRemoteFile(otherParty:EventMessenger, fileName:string, callback:ErrBack):any {
        this.transferHelper.getFileFromRemote(otherParty, fileName, callback);
    }

    private addEventMessengerListeners(otherParty:EventMessenger) {
        otherParty.on(TransferHelper.outerEvent, (event)=> this.transferHelper.consumeMessage(event.body, otherParty));

        otherParty.on(Client.events.metaDataForFile, (event)=> this.callbackHelper.getCallback(event.body.id)(null, event.body.syncData));

        otherParty.on(Client.events.fileList, (event)=> this.callbackHelper.getCallback(event.body.id)(null, event.body.fileList));

        otherParty.on(Client.events.directoryCreated, (event)=> {
            this.container.createDirectory(event.body.fileName);

            return this.broadcastEvent(event.type, {fileName: event.body.fileName}, otherParty);
        });

        otherParty.on(Client.events.fileDeleted, (event)=> {
            this.container.deleteFile(event.body.fileName);

            return this.broadcastEvent(event.type, event.body, otherParty);
        });

        otherParty.on(Client.events.fileChanged, (event)=> {
            return this.requestRemoteFile(otherParty, event.body.fileName, ()=> {
                this.broadcastEvent(event.type, event.body, otherParty);
            });
        });

        otherParty.on(Client.events.getFileList, (event)=> {
            return this.container.getFileTree((err, fileList)=> {
                if (err) {
                    return logger.error(err);
                }

                otherParty.send(Client.events.fileList, {fileList: fileList, id: event.body.id});
            });
        });

        otherParty.on(Client.events.getMetaForFile, (event)=> {
            return this.container.getFileMeta(event.body.fileName, (err, syncData)=> {
                if (err) {
                    return logger.error(err);
                }

                otherParty.send(Client.events.metaDataForFile, {syncData: syncData, id: event.body.id})
            })
        });
    }

    private broadcastEvent(eventType:string, body:any, excludeParty?:Messenger) {
        this.otherParties.forEach((otherParty)=> {
            if (excludeParty && excludeParty === otherParty) {
                return;
            }

            otherParty.send(eventType, body);
        })
    }
}
