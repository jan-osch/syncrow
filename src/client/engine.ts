import {loggerFor, debugFor, Closable} from "../utils/logger";
import {Messenger} from "../connection/messenger";
import {FileContainer} from "../fs_helpers/file_container";
import {SyncData, SyncAction, SyncActionSubject, SyncActionParams} from "../sync/sync_actions";
import {CallbackHelper} from "../transport/callback_helper";
import {TransferHelper} from "../transport/transfer_helper";
import {EventMessenger} from "../connection/evented_messenger";
import * as _ from "lodash";
import {noAction} from "../sync/no_action";

const debug = debugFor("syncrow:client:engine");
const logger = loggerFor('Engine');

export interface EngineOptions {
    watch?:boolean;
    onFirstConnection?:SyncAction;
    onReconnection?:SyncAction;
    allowReconnecting?:boolean;
}

export class Engine implements SyncActionSubject, Closable {

    static events = {
        fileChanged: 'fileChanged',
        fileCreated: 'fileCreated',
        fileDeleted: 'fileDeleted',
        directoryCreated: 'directoryCreated',

        getFileList: 'getFileList',
        getMetaForFile: 'getMetaTupleForFile',
        metaDataForFile: 'metaDataForFile',
        fileList: 'fileList'
    };

    private otherParties:Array<EventMessenger>;
    private callbackHelper:CallbackHelper;
    private options:EngineOptions;

    constructor(private fileContainer:FileContainer, private transferHelper:TransferHelper, options:EngineOptions, callback:ErrorCallback) {
        this.options = Engine.prepareOptions(options);
        this.callbackHelper = new CallbackHelper();
        this.otherParties = [];
        this.addListenersToFileContainer(this.fileContainer);

        if (!this.options.watch) {
            this.fileContainer.beginWatching(callback);
        } else {
            callback();
        }
    }

    /**
     * @param otherParty
     */
    public addOtherPartyMessenger(otherParty:EventMessenger) {
        this.otherParties.push(otherParty);

        const syncParams:SyncActionParams = {remoteParty: otherParty, container: this.fileContainer, subject: this};

        otherParty.on(Messenger.events.recovering, ()=> {
            debug(`lost connection with remote party - recovering`);
            if (!this.options.allowReconnecting) {
                return this.removeOtherParty(otherParty);
            }
        });

        otherParty.on(Messenger.events.died, ()=> {
            debug(`lost connection with remote party - permanently`);
            this.removeOtherParty(otherParty);
        });

        otherParty.on(Messenger.events.reconnected, ()=> {
            debug(`reconnected with remote party`);
            this.options.onReconnection(syncParams, (err)=> {
                if (err)return logger.error(err);

                return logger.info(`Synced successfully on reconnection`);
            })
        });

        this.options.onFirstConnection(syncParams,
            (err)=> {
                if (err)return logger.error(err);

                return logger.info(`Synced successfully on first connection`);
            }
        );

        this.addEngineListenersToOtherParty(otherParty);
    }

    /**
     * Stops engine activity
     */
    public shutdown() {
        this.otherParties.forEach(otherParty => this.removeOtherParty(otherParty));
        this.fileContainer.shutdown();
    }

    /**
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
     */
    public deleteRemoteFile(otherParty:EventMessenger, fileName:string):any {
        return otherParty.send(Engine.events.fileDeleted, {fileName: fileName});
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public pushFileToRemote(otherParty:EventMessenger, fileName:string, callback:ErrorCallback):any {
        this.transferHelper.sendFileToRemote(otherParty, fileName, callback);
    }

    /**
     * @param otherParty
     * @param fileName
     */
    public createRemoteDirectory(otherParty:EventMessenger, fileName:string) {
        return otherParty.send(Engine.events.directoryCreated, {fileName:fileName});
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public getRemoteFileMeta(otherParty:EventMessenger, fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any {
        const id = this.callbackHelper.addCallback(callback);
        otherParty.send(Engine.events.getMetaForFile, {fileName: fileName, id: id});
    }

    /**
     * @param otherParty
     * @param callback
     */
    public getRemoteFileList(otherParty:EventMessenger, callback:(err:Error, fileList?:Array<string>)=>any):any {
        const id = this.callbackHelper.addCallback(callback);
        otherParty.send(Engine.events.getFileList, {id: id});
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public requestRemoteFile(otherParty:EventMessenger, fileName:string, callback:ErrorCallback):any {
        this.transferHelper.getFileFromRemote(otherParty, fileName, callback);
    }

    private static prepareOptions(options:EngineOptions):EngineOptions {
        return _.extend(
            {
                onFirstConnection: noAction,
                onReconnection: noAction
            },
            options
        );
    }

    private addEngineListenersToOtherParty(otherParty:EventMessenger) {
        otherParty.on(EventMessenger.error, (event)=> {
            return logger.error(`received error message ${JSON.stringify(event.body)}`);
        });

        otherParty.on(TransferHelper.outerEvent, (event)=> this.transferHelper.consumeMessage(event.body, otherParty));

        otherParty.on(Engine.events.metaDataForFile, (event)=> this.callbackHelper.getCallback(event.body.id)(null, event.body.syncData));

        otherParty.on(Engine.events.fileList, (event)=> this.callbackHelper.getCallback(event.body.id)(null, event.body.fileList));

        otherParty.on(Engine.events.directoryCreated, (event)=> {
            this.fileContainer.createDirectory(event.body.fileName);

            return this.broadcastEvent(event.type, {fileName: event.body.fileName}, otherParty);
        });

        otherParty.on(Engine.events.fileDeleted, (event)=> {
            this.fileContainer.deleteFile(event.body.fileName);

            return this.broadcastEvent(event.type, event.body, otherParty);
        });

        otherParty.on(Engine.events.fileChanged, (event)=> {
            return this.requestRemoteFile(otherParty, event.body.fileName, ()=> {
                return this.broadcastEvent(event.type, event.body, otherParty);
            });
        });

        otherParty.on(Engine.events.getFileList, (event)=> {
            return this.fileContainer.getFileTree((err, fileList)=> {
                if (err) {
                    return logger.error(err);
                }

                return otherParty.send(Engine.events.fileList, {fileList: fileList, id: event.body.id});
            });
        });

        otherParty.on(Engine.events.getMetaForFile, (event)=> {
            return this.fileContainer.getFileMeta(event.body.fileName, (err, syncData)=> {
                if (err) {
                    return logger.error(err);
                }

                return otherParty.send(Engine.events.metaDataForFile, {syncData: syncData, id: event.body.id})
            })
        });
    }

    private addListenersToFileContainer(fileContainer:FileContainer) {
        fileContainer.on(FileContainer.events.changed, (eventContent)=> {
            debug(`detected file changed: ${eventContent}`);
            return this.broadcastEvent(Engine.events.fileChanged, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.fileCreated, (eventContent)=> {
            debug(`detected file created: ${eventContent}`);
            return this.broadcastEvent(Engine.events.fileChanged, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.deleted, (eventContent)=> {
            debug(`detected file deleted: ${eventContent}`);
            return this.broadcastEvent(Engine.events.fileDeleted, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.createdDirectory, (eventContent)=> {
            return this.broadcastEvent(Engine.events.directoryCreated, {fileName: eventContent});
        });
    }

    private broadcastEvent(eventType:string, body:any, excludeParty?:Messenger) {
        this.otherParties.forEach((otherParty)=> {
            if (excludeParty && excludeParty === otherParty) {
                return;
            }

            return otherParty.send(eventType, body);
        })
    }
}
