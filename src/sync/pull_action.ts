import * as async from "async";
import {debugFor, loggerFor} from "../utils/logger";
import {SyncActionParams} from "./sync_actions";
import * as _ from "lodash";

const debug = debugFor('syncrow:strategy:pull');
const logger = loggerFor('PullStrategy');


/**
 * It will download all files from remote.
 * If any file remotely does not exist, but exists locally it will be deleted
 *
 * @param params
 * @param callback
 */
export function pullAction(params:SyncActionParams, callback:ErrorCallback):any {
    return async.waterfall(
        [
            (cb)=>getFileLists(params, cb),
            (list, cb)=>processFileLists(params, list, cb)
        ],

        callback
    )
}

interface FileLists {
    localFileList:Array<string>;
    remoteFileList:Array<string>;
}

function getFileLists(params:SyncActionParams, callback) {
    return async.parallel(
        {
            localFileList: (cb)=>params.container.getFileTree(cb),
            remoteFileList: (cb)=>params.subject.getRemoteFileList(params.remoteParty, cb)
        },

        callback
    );
}

function processFileLists(params:SyncActionParams, lists:FileLists, callback) {
    return async.parallel(
        [
            (cb)=>deleteLocalFilesThatAreMissingRemotely(params, lists, cb),
            (cb)=>downloadOrCreateRemoteFileList(params, lists, cb),
        ],

        callback
    )
}

function deleteLocalFilesThatAreMissingRemotely(params:SyncActionParams, lists:FileLists, callback:ErrorCallback) {
    if (!params.deleteLocalIfRemoteMissing) return callback();

    const filesMissingLocally = _.difference(lists.localFileList, lists.remoteFileList);

    return async.each(filesMissingLocally,

        (pathName, cb)=>params.container.deleteFile(pathName, cb),

        callback
    );
}

function downloadOrCreateRemoteFileList(params:SyncActionParams, lists:FileLists, callback:ErrorCallback) {
    return async.each(lists.remoteFileList,

        (file, cb)=>downloadOrCreateRemoteFile(params, file, cb),

        callback
    );
}

function downloadOrCreateRemoteFile(params:SyncActionParams, file:string, callback:ErrorCallback) {
    return async.waterfall(
        [
            (cb)=>params.subject.getRemoteFileMeta(params.remoteParty, file, cb),

            (syncData, cb)=> {
                if (syncData.isDirectory) {
                    return params.container.createDirectory(file, cb);
                }

                return params.subject.requestRemoteFile(params.remoteParty, file, cb);
            }
        ],

        callback
    );
}