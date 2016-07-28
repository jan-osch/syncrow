import {FileContainer} from "../fs_helpers/file_container";
import {EventedMessenger} from "../connection/evented_messenger";

export interface SyncData {
    hashCode:string;
    modified:Date;
    name:string;
    isDirectory:boolean,
    exists:boolean
}

export interface SyncActionSubject {
    getRemoteFileMeta(otherParty:EventedMessenger, fileName:string, callback:(err:Error, syncData?:SyncData)=>any):any;
    getRemoteFileList(otherParty:EventedMessenger, callback:(err:Error, fileList?:Array<string>)=>any):any;
    requestRemoteFile(otherParty:EventedMessenger, fileName:string, callback:ErrorCallback):any;
    pushFileToRemote(otherParty:EventedMessenger, fileName:string, callback:ErrorCallback):any;
}

export interface SyncActionParams {
    remoteParty:EventedMessenger;
    container:FileContainer;
    subject:SyncActionSubject;
}

export interface SyncActionFactory {
    sync(remoteParty:EventedMessenger, container:FileContainer, subject:SyncActionSubject, callback:ErrorCallback):any;
}

export interface SyncAction {
    execute(params:SyncActionParams, callback:ErrorCallback):any;
}

export function buildParams(remoteParty:EventedMessenger, container:FileContainer, subject:SyncActionSubject):SyncActionParams {
    return {
        remoteParty: remoteParty,
        container: container,
        subject: subject
    };
}
