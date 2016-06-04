import {AbstractSynchronizationStrategy, SyncData, StrategySubject} from "./synchronization_strategy";
import * as async from "async";
import * as _ from "lodash";
/**
 * Created by Janusz on 04.06.2016.
 */

export class AcceptNewestStrategy extends AbstractSynchronizationStrategy {

    private connected:boolean;
    private localMeta:Map<string, SyncData>;
    private remoteMeta:Map<string, SyncData>;

    /**
     * On every reconnection will accept all newest files
     */
    constructor(subject:StrategySubject) {
        super(subject);
        this.connected = false; //TODO implement some strategy of handling reconnection
        this.purgeTempData();
    }

    /**
     * @Override
     * @param fileName
     */
    public acknowledgeRemoteFileDeleted(fileName:string):any {
        this.subject.deleteLocalFile(fileName);
    }

    /**
     * @Override
     * @param fileName
     */
    public acknowledgeRemoteFileCreated(fileName:string):any {
        this.subject.requestRemoteFile(fileName);
    }

    /**
     * @Override
     * @param fileName
     */
    public acknowledgeRemoteFileChanged(fileName:string):any {
        this.subject.requestRemoteFile(fileName);
    }

    /**
     * @Override
     * @param directoryName
     */
    public acknowledgeRemoteDirectoryCreated(directoryName:string):any {
        this.subject.createLocalDirectory(directoryName);
    }

    /**
     * @Override
     */
    public acknowledgeConnectedWithRemoteParty():any {
        this.connected = true;
        this.purgeTempData();

        // async.parallel(
        //     (outerCallback)=>{
        //
        //     }
        //
        // )
        //
        //
        // });
        // this.emit(AbstractSynchronizationStrategy.events.getRemoteFileList);
    }

    private getAllFilesFromBothRemoteAndLocak(callback:(err:Error, allFiles?:Array<string>)=>any) {
        let localFiles;
        let remoteFiles;
        async.parallel(
            (parallelCallback)=>this.subject.getLocalFileList((err, fileList:Array<string>)=> {
                if (err) return parallelCallback(err);

                localFiles = fileList;
                return parallelCallback();
            }),
            (parallelCallback)=>this.subject.getRemoteFileList((err, fileList:Array<string>)=> {
                if (err) return parallelCallback(err);

                remoteFiles = fileList;
                return parallelCallback();
            }), (error:Error)=> {
                if (error) return callback(error);

                return callback(null, _.union(localFiles, remoteFiles));
            }
        )
    }

    /**
     * @Override
     */
    public acknowledgeReconnectedWithRemoteParty():any {
        this.acknowledgeConnectedWithRemoteParty();
    }

    /**
     * @Override
     */
    public acknowledgeDisconnectedWithRemoteParty():any {
        this.hasToSync = false;
        this.connected = false;
    }

    /**
     * @Override
     * @param fileMeta
     */
    public consumeRemoteFileMeta(fileMeta:SyncData):any {
        this.remoteMeta.set(fileMeta.name, fileMeta);
        this.compareMeta(fileMeta.name);
    }

    /**
     * @Override
     * @param fileMeta
     */
    public consumeLocalFileMeta(fileMeta:SyncData):any {
        this.localMeta.set(fileMeta.name, fileMeta);
        this.compareMeta(fileMeta.name);
    }

    /**
     * @Override
     * @param fileList
     */
    public consumeRemoteFileList(fileList:Array<string>):any {
        fileList.forEach(file=>this.emit(AbstractSynchronizationStrategy.events.getRemoteFileMeta));
    }

    /**
     * @Override
     * @param fileList
     */
    public consumeLocalFileList(fileList:Array<string>):any {
        fileList.forEach(file=>this.emit(AbstractSynchronizationStrategy.events.getLocalFileMeta));
    }

    private purgeTempData() {
        this.localMeta = new Map<string, SyncData>();
        this.remoteMeta = new Map<string, SyncData>();
    }

    private compareMeta(name:string) {
        if (this.localMeta.has(name) && this.remoteMeta.has(name)) {

            this.emitCommandsIfNeeded(this.localMeta.get(name), this.remoteMeta.get(name));

            this.localMeta.delete(name);
            this.remoteMeta.delete(name);
        }
    }

    private emitCommandsIfNeeded(ownMeta:SyncData, otherMeta:SyncData) {
        if (otherMeta.exists) {
            if (!ownMeta.exists) {
                if (otherMeta.isDirectory) {
                    this.emit(AbstractSynchronizationStrategy.events.createLocalDirectory, name);
                    return;
                }

                this.emit(AbstractSynchronizationStrategy.events.requestRemoteFile, name);
                return
            }

            if (otherMeta.hashCode !== ownMeta.hashCode) {
                if (otherMeta.modified.getTime() > ownMeta.modified.getTime()) {
                    this.emit(AbstractSynchronizationStrategy.events.requestRemoteFile, name);
                    return;
                }
            }
        }
    }
}
