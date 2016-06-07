import {EventEmitter} from "events";
import {FileContainer} from "../fs_helpers/file_container";
import {Messenger} from "../transport/messenger";

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
    protected otherParty:Messenger;

    constructor(subject:StrategySubject, container:FileContainer, otherParty:Messenger) {
        super();
        this.subject = subject;
        this.container = container;
        this.otherParty = otherParty;
    }

    /**
     */
    public  synchronize() {
        return;
    }
}
