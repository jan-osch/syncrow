import {EventEmitter} from "events";
import {FileContainer} from "../fs_helpers/file_container";
import {Messenger} from "../connection/messenger";
import {loggerFor} from "../utils/logger";


const logger = loggerFor(`SynchronizationStrategy`);

export interface SyncData {
    hashCode:string;
    modified:Date;
    name:string;
    isDirectory:boolean,
    exists:boolean
}

export interface StrategySubject {
    getRemoteFileMeta(otherParty:Messenger, fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any;
    getRemoteFileList(otherParty:Messenger, callback:(err:Error, fileList?:Array<string>)=>any):any;
    requestRemoteFile(otherParty:Messenger, fileName:string, callback:Function):any;
}

export class SynchronizationStrategy extends EventEmitter {
    protected subject:StrategySubject;
    protected container:FileContainer;

    constructor(subject:StrategySubject, container:FileContainer) {
        super();
        this.subject = subject;
        this.container = container;
    }

    /**
     * @param otherParty
     */
    public  synchronize(otherParty:Messenger) {
        logger.info(`no action needed`);
    }
}
