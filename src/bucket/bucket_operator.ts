import {FileContainer} from "../fs_helpers/file_container";
import {EventsHelper} from "../client/events_helper";
import {Messenger} from "../connection/messenger";
import {Client} from "../client/client";
import {loggerFor, debugFor} from "../utils/logger";
import {StrategySubject, SyncData, SynchronizationStrategy} from "../sync_strategy/sync_strategy";
import {CallbackHelper} from "../transport/callback_helper";
import config from "../configuration";
import {TransferHelper} from "../transport/transfer_helper";
import {NoActionStrategy} from "../sync_strategy/no_action_strategy";

const debug = debugFor("syncrow:bucket:operator");
const logger = loggerFor('BucketOperator');

export interface BucketOperatorParams {
    transferConcurrency?:number,
    strategy?:SynchronizationStrategy,
}

export class BucketOperator implements StrategySubject {
    private otherParties:Array<Messenger>;
    private container:FileContainer;
    private otherPartiesMessageListeners:Array<Function>;
    private transferHelper:TransferHelper;
    private callbackHelper:CallbackHelper;
    private syncStrategy:SynchronizationStrategy;

    constructor(private host:string, private path:string, options:BucketOperatorParams) {
        const transferConcurrency = options.transferConcurrency ? options.transferConcurrency : config.server.transferQueueSize;
        const strategy = options.strategy ? options.strategy : new NoActionStrategy();

        this.container = new FileContainer(path);
        this.otherParties = [];
        this.otherPartiesMessageListeners = [];

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
     * @param fileName
     * @param callback
     * @returns {undefined}
     */
    public pushFileToRemote(otherParty:Messenger, fileName:string, callback:ErrorCallback):any {
        this.transferHelper.sendFileToRemote(otherParty, fileName, callback);
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
     */
    public requestRemoteFile(otherParty:Messenger, fileName:string, callback:ErrorCallback):any {
        this.transferHelper.getFileFromRemote(otherParty, fileName, callback);
    }

    private handleEvent(otherParty:Messenger, message:string) {
        const event = EventsHelper.parseEvent(otherParty, message);

        debug(`got event from other party: ${JSON.stringify(event, null, 2)}`);

        if (event.type === TransferHelper.outerEvent) {
            return this.transferHelper.consumeMessage(event.body, otherParty);

        } else if (event.type === Client.events.metaDataForFile) {
            return this.callbackHelper.getCallback(event.body.id)(null, event.body.syncData);

        } else if (event.type === Client.events.fileList) {
            return this.callbackHelper.getCallback(event.body.id)(null, event.body.fileList);

        } else if (event.type === Client.events.directoryCreated) {
            this.container.createDirectory(event.body.fileName);

            return this.broadcastEvent(event.type, {fileName: event.body.fileName}, otherParty);

        } else if (event.type === Client.events.fileDeleted) {
            this.container.deleteFile(event.body.fileName);

            return this.broadcastEvent(event.type, event.body, otherParty);

        } else if (event.type === Client.events.fileChanged) {
            return this.requestRemoteFile(otherParty, event.body.fileName, ()=> {
                this.broadcastEvent(event.type, event.body, otherParty);
            })

        } else if (event.type === Client.events.getFileList) {
            return this.container.getFileTree((err, fileList)=> {
                if (err) return logger.error(err);

                EventsHelper.sendEvent(otherParty, Client.events.fileList,
                    {fileList: fileList, id: event.body.id}
                );
            });

        } else if (event.type === Client.events.getMetaForFile) {
            return this.container.getFileMeta(event.body.fileName, (err, syncData)=> {
                if (err)return logger.error(err);

                EventsHelper.sendEvent(otherParty,
                    Client.events.metaDataForFile,
                    {syncData: syncData, id: event.body.id}
                )
            });

        } else if (event.type === EventsHelper.events.error) {
            return logger.warn(`received error message ${JSON.stringify(event.body)}`);
        }

        EventsHelper.sendEvent(otherParty, EventsHelper.events.error, `unknown event type: ${event.type}`);
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
