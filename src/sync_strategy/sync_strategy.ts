import {EventEmitter} from "events";
import {FileContainer} from "../fs_helpers/file_container";
import {Messenger} from "../connection/messenger";
import * as _ from "lodash";

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
    requestRemoteFile(otherParty:Messenger, fileName:string, callback:ErrorCallback):any;
    pushFileToRemote(otherParty:Messenger, fileName:string, callback:ErrorCallback):any;
}

export class SynchronizationStrategy extends EventEmitter {
    protected subject:StrategySubject;
    protected container:FileContainer;

    constructor() {
        super();
    }

    /**
     * Used to inject properties by clients
     * @param subject
     * @param container
     */
    public setData(subject:StrategySubject, container:FileContainer) {
        this.subject = subject;
        this.container = container;
    }

    /**
     * @param otherParty
     * @param callback
     */
    public synchronize(otherParty:Messenger, callback:Function = _.noop) {
        throw new Error('unimplemented');
    }
}
