import {EventEmitter} from "events";

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

    requestRemoteFile(fileName:string):any;
    deleteLocalFile(fileName:string):any;
    createLocalDirectory(directoryName:string):any;

}

export abstract class AbstractSynchronizationStrategy extends EventEmitter {
    protected subject:StrategySubject;

    constructor(subject:StrategySubject) {
        super();
        this.subject = subject;
    }

    /**
     * @param fileName
     */
    public  acknowledgeRemoteFileCreated(fileName:string):any {
        return;
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
    public acknowledgeRemoteFileChanged(fileName:string):any {
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
    public acknowledgeRemoteFileDeleted(fileName:string):any {
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
    public acknowledgeRemoteDirectoryCreated(fileName:string):any {
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
    public acknowledgeConnectedWithRemoteParty(fileName:string):any {
        return;
    }

    /**
     */
    public acknowledgeReconnectedWithRemoteParty():any {
        return;
    }

    /**
     */
    public acknowledgeDisconnectedWithRemoteParty():any {
        return;
    }
}
