import {FileContainer} from "../fs_helpers/file_container";
import {EventMessenger} from "../connection/evented_messenger";

export interface SyncData {
    hashCode:string;
    modified:Date;
    name:string;
    isDirectory:boolean;
    exists:boolean;
}

export interface SyncActionSubject {
    getRemoteFileMeta(otherParty:EventMessenger, fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any;
    getRemoteFileList(otherParty:EventMessenger, callback:(err:Error, fileList?:Array<string>)=>any):any;
    requestRemoteFile(otherParty:EventMessenger, fileName:string, callback:ErrorCallback):any;
    pushFileToRemote(otherParty:EventMessenger, fileName:string, callback:ErrorCallback):any;
    deleteRemoteFile(otherParty:EventMessenger, fileName:string):any;
}

export interface SyncActionParams {
    remoteParty:EventMessenger;
    container:FileContainer;
    subject:SyncActionSubject;
    deleteLocalIfRemoteMissing?:boolean;
    deleteRemoteIfLocalMissing?:boolean;
}

export interface SyncAction {
    (params:SyncActionParams, callback:ErrorCallback):any;
}
