import {FileContainer} from "../fs_helpers/file_container";
import {EventMessenger} from "../connection/event_messenger";
import * as async from "async";
import {debugFor} from "../utils/logger";

const debug = debugFor('syncrow:sync_actions');

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
    createRemoteDirectory(otherParty:EventMessenger, fileName:string);
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

/**
 * @param action
 * @returns {(params:SyncActionParams, callback:ErrorCallback)=>any}
 */
export function setDeleteLocalFiles(action:SyncAction):SyncAction {

    return (params:SyncActionParams, callback:ErrorCallback)=> {
        params.deleteLocalIfRemoteMissing = true;
        return action(params, callback);
    }

}

/**
 * @param action
 * @returns {(params:SyncActionParams, callback:ErrorCallback)=>any}
 */
export function setDeleteRemoteFiles(action:SyncAction):SyncAction {

    return (params:SyncActionParams, callback:ErrorCallback)=> {
        params.deleteRemoteIfLocalMissing = true;
        return action(params, callback);
    }

}

export interface MetaTuple {
    localMeta?:SyncData;
    remoteMeta?:SyncData;
}

/**
 * @param params
 * @param file
 * @param callback
 */
export function getMetaTupleForFile(params:SyncActionParams, file:string, callback:(err:Error, result:MetaTuple)=>any):any {
    debug(`getting file meta from both remote and local: ${file}`);

    async.parallel<MetaTuple>(
        {
            localMeta: (parallelCallback)=> {
                params.container.getFileMeta(file, parallelCallback)
            },
            remoteMeta: (parallelCallback)=> {
                params.subject.getRemoteFileMeta(params.remoteParty, file, parallelCallback);
            }
        },

        callback
    );
}

export interface FileLists {
    localList?:Array<string>;
    remoteList?:Array<string>;
}


/**
 * @param params
 * @param callback
 */
export function getFileLists(params:SyncActionParams, callback:(err:Error, result:FileLists)=>any) {

    return async.parallel(
        {
            localList: (cb)=>params.container.getFileTree(cb),
            remoteList: (cb)=>params.subject.getRemoteFileList(params.remoteParty, cb)
        },

        callback
    );
}

