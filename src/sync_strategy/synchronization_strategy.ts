import {EventEmitter} from "events";
import * as _ from "lodash";

export interface SyncData {
    hashCode:string;
    modified:Date;
    name:string;
    isDirectory:boolean,
    exists:boolean
}

export interface StrategySubject {
    getLocalFileMeta(fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any;
    getRemoteFileMeta(fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any;
    getLocalFileList(callback:(err:Error, fileList?:Array<string>)=>any):any;
    getRemoteFileList(callback:(err:Error, fileList?:Array<string>)=>any):any;

    requestRemoteFile(fileName:string, callback:Function):any;
    deleteLocalFile(fileName:string, callback:Function):any;
    createLocalDirectory(directoryName:string, callback:Function):any;
}

export abstract class SynchronizationStrategy extends EventEmitter {
    protected subject:StrategySubject;

    constructor(subject:StrategySubject) {
        super();
        this.subject = subject;
    }

    /**
     * @param fileName
     */
    public acknowledgeLocalFileCreated(fileName:string):any {
        return;
    }


    /**
     * @param fileName
     */
    public acknowledgeLocalFileChanged(fileName:string):any {
        return;
    }


    /**
     * @param fileName
     */
    public acknowledgeLocalFileDeleted(fileName:string):any {
        return;
    }


    /**
     * @param fileName
     */
    public acknowledgeLocalDirectoryCreated(fileName:string):any {
        return;
    }

    /**
     * @param fileName
     */
    public acknowledgeConnectedWithRemoteParty():any {
        return;
    }

    /**
     */
    public acknowledgeReconnectingWithRemoteParty():any {
        return;
    }

    /**
     */
    public acknowledgeDisconnectedWithRemoteParty():any {
        return;
    }

    public acknowledgeRemoteFileDeleted(fileName:string):any {
        this.subject.deleteLocalFile(fileName, _.noop);
    }

    /**
     * @param fileName
     */
    public acknowledgeRemoteFileCreated(fileName:string):any {
        this.subject.requestRemoteFile(fileName, _.noop);
    }

    /**
     * @param fileName
     */
    public acknowledgeRemoteFileChanged(fileName:string):any {
        this.subject.requestRemoteFile(fileName, _.noop);
    }

    /**
     * @param directoryName
     */
    public acknowledgeRemoteDirectoryCreated(directoryName:string):any {
        this.subject.createLocalDirectory(directoryName, _.noop);
    }
}
