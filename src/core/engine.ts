import {loggerFor, debugFor} from "../utils/logger";
import {FileContainer} from "../fs_helpers/file_container";
import {SyncData, SyncAction, SyncActionSubject, SyncActionParams} from "../sync/sync_actions";
import {CallbackHelper} from "../connection/callback_helper";
import {TransferHelper} from "../transport/transfer_helper";
import {EventMessenger} from "../connection/event_messenger";
import {Closable} from "../utils/interfaces";
import {EventEmitter} from "events";
import {noAction} from "../sync/no_action";

const debug = debugFor("syncrow:engine");
const logger = loggerFor('Engine');

const INITIAL_TIMEOUT = 10;

export interface EngineOptions {
    sync:SyncAction;
}

export class Engine extends EventEmitter implements SyncActionSubject, Closable {
    static events = {
        newFile: 'newFile',
        changedFile: 'changedFile',
        deletedPath: 'deletedPath',
        newDirectory: 'newDirectory',

        error: 'error',
        synced: 'synced',
        shutdown: 'shutdown',
    };

    static commands = {
        createDirectory: 'createDirectory',
        deletePath: 'deletePath',
        downloadChanged: 'downloadChanged',
        downloadNew: 'downloadNew',

        getMetaForFile: 'getMetaForFile',
        getFileList: 'getFileList'
    };

    private otherParties:Array<EventMessenger>;
    private callbackHelper:CallbackHelper;


    constructor(private fileContainer:FileContainer, private transferHelper:TransferHelper, private options:EngineOptions) {
        super();

        this.options.sync = this.options.sync ? this.options.sync : noAction;

        this.callbackHelper = new CallbackHelper();
        this.otherParties = [];
        this.addListenersToFileContainer(this.fileContainer);
    }

    /**
     * @param otherParty
     */
    public addOtherPartyMessenger(otherParty:EventMessenger) {
        debug('adding new other party');

        this.otherParties.push(otherParty);

        const syncParams:SyncActionParams = {remoteParty: otherParty, container: this.fileContainer, subject: this};

        otherParty.on(EventMessenger.events.died, ()=> {
            debug(`lost connection with remote party - permanently`);
            this.removeOtherParty(otherParty);
        });

        const syncCallback = (err)=> {
            if (err)return logger.error(`Syncrhonization failed: reason - ${err}`);

            this.emit(Engine.events.synced);
            return logger.info(`Synced successfully on first connection`);
        };

        setTimeout(()=>this.options.sync(syncParams, syncCallback), INITIAL_TIMEOUT);

        this.addEngineListenersToOtherParty(otherParty);
    }

    /**
     * Stops engine activity
     */
    public shutdown() {
        this.emit(Engine.events.shutdown);
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
     * @param callback
     */
    public deleteRemoteFile(otherParty:EventMessenger, fileName:string, callback:ErrorCallback):any {
        return otherParty.sendRequest(Engine.commands.deletePath, {fileName: fileName}, callback);
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
     * @param callback
     */
    public createRemoteDirectory(otherParty:EventMessenger, fileName:string, callback:ErrorCallback) {
        return otherParty.sendRequest(Engine.commands.createDirectory, {fileName: fileName}, callback);
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public getRemoteFileMeta(otherParty:EventMessenger, fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any {
        return otherParty.sendRequest(Engine.commands.getMetaForFile, {fileName: fileName}, callback);
    }

    /**
     * @param otherParty
     * @param callback
     */
    public getRemoteFileList(otherParty:EventMessenger, callback:(err:Error, fileList?:Array<string>)=>any):any {
        return otherParty.sendRequest(Engine.commands.getFileList, null, callback);
    }

    /**
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public requestRemoteFile(otherParty:EventMessenger, fileName:string, callback:ErrorCallback):any {
        this.transferHelper.getFileFromRemote(otherParty, fileName, callback);
    }

    emit(event:string, ...args:Array<any>):boolean {
        debug(`emitting: ${event} with body: ${args}`);
        return super.emit(event, args);
    }

    private addEngineListenersToOtherParty(otherParty:EventMessenger) {
        otherParty.on(TransferHelper.outerEvent, (event)=> this.transferHelper.consumeMessage(event.body, otherParty));

        otherParty.on(EventMessenger.events.error, (event)=> {
            return logger.error(`received error message ${JSON.stringify(event)}`);
        });

        otherParty.on(Engine.commands.createDirectory, (event)=> {
            this.createDirectoryEmitAndBroadcast(event.body.fileName, otherParty, (err)=> {
                return otherParty.sendResponse(event, null, err);
            });
        });

        otherParty.on(Engine.commands.deletePath, (event)=> {
            this.deletePathEmitAndBroadCast(event.body.fileName, otherParty, (err)=> {

                return otherParty.sendResponse(event, null, err);
            });
        });

        otherParty.on(Engine.commands.downloadChanged, (event)=> {
            return this.requestRemoteFile(otherParty, event.body.fileName, ()=> {
                debug(`finished downloading a changed file: ${event.body.fileName}`);

                this.emit(Engine.events.changedFile, event.body.fileName);

                return this.broadcastCommand(Engine.commands.downloadChanged, event.body, otherParty);
            });
        });

        otherParty.on(Engine.commands.downloadNew, (event)=> {
            return this.requestRemoteFile(otherParty, event.body.fileName, ()=> {
                debug(`finished downloading a new file: ${event.body.fileName}`);

                this.emit(Engine.events.newFile, event.body.fileName);

                return this.broadcastCommand(Engine.commands.downloadNew, event.body, otherParty);
            });
        });

        otherParty.on(Engine.commands.getFileList, (event)=> {
            return this.fileContainer.getFileTree((err, fileList)=> {
                if (err) {
                    logger.error(err);
                    return otherParty.sendResponse(event, null, err);
                }

                return otherParty.sendResponse(event, fileList);
            });
        });

        otherParty.on(Engine.commands.getMetaForFile, (event)=> {
            return this.fileContainer.getFileMeta(event.body.fileName, (err, syncData)=> {
                if (err) {
                    logger.error(err);
                    return otherParty.sendResponse(event, null, err);
                }

                return otherParty.sendResponse(event, syncData)
            })
        });

        debug(`finished adding listeners`);
    }

    private deletePathEmitAndBroadCast(pathName:any, otherParty:EventMessenger, callback = this.errorSink) {
        this.fileContainer.deleteFile(pathName, (err)=> {
            if (err)return callback(err);

            this.emit(Engine.events.deletedPath, pathName);
            this.broadcastCommand(Engine.events.deletedPath, pathName, otherParty);

            return callback();
        });
    }

    private createDirectoryEmitAndBroadcast(directoryName:string, otherParty:EventMessenger, callback = this.errorSink) {
        this.fileContainer.createDirectory(directoryName, (err)=> {
            if (err)return callback(err);

            this.emit(Engine.events.newDirectory, directoryName);
            this.broadcastCommand(Engine.commands.createDirectory, {fileName: directoryName}, otherParty);

            return callback();
        });
    }

    private addListenersToFileContainer(fileContainer:FileContainer) {
        fileContainer.on(FileContainer.events.changed, (eventContent)=> {
            debug(`detected file changed: ${eventContent}`);
            return this.broadcastCommand(Engine.commands.downloadChanged, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.fileCreated, (eventContent)=> {
            debug(`detected file created: ${eventContent}`);
            return this.broadcastCommand(Engine.commands.downloadNew, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.deleted, (eventContent)=> {
            debug(`detected file deleted: ${eventContent}`);
            return this.broadcastCommand(Engine.commands.deletePath, {fileName: eventContent});
        });

        fileContainer.on(FileContainer.events.createdDirectory, (eventContent)=> {
            debug(`detected directory created: ${eventContent}`);
            return this.broadcastCommand(Engine.commands.createDirectory, {fileName: eventContent});
        });
    }

    private broadcastCommand(eventType:string, body:any, excludeParty?:EventMessenger) {
        debug(`broadcasting command: ${eventType} with content: ${JSON.stringify(body)}`);
        this.otherParties.forEach((otherParty)=> {
            if (excludeParty && excludeParty === otherParty) {
                return;
            }

            return otherParty.send(eventType, body);
        })
    }

    private errorSink(err?:Error) {
        if (err) {
            logger.error(err);
            this.emit(Engine.events.error, err);
        }
    }
}
