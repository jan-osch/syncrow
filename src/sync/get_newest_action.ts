import {SyncData, SyncActionParams} from "./sync_actions";
import * as async from "async";
import * as _ from "lodash";
import {debugFor, loggerFor} from "../utils/logger";

const debug = debugFor('syncrow:sync:newest');
const logger = loggerFor('GetNewestSyncAction');

/**
 * It compares local and remote file list,
 * if a file exists both locally and remotely and it's content is different,
 * it will sync local version to match the version(either remote or local) that has the greatest modification time

 * @param params
 * @param callback
 */
export function getNewestVerisonAction(params:SyncActionParams, callback:ErrorCallback):any {
    getAllFilesFromBothSides(params, (err, allFiles)=> {
        async.each(allFiles,
            (file, cb)=>synchronizeFile(params, file, cb),
            callback
        )
    })
}

function getAllFilesFromBothSides(params:SyncActionParams, callback:(err:Error, allFiles?:Array<string>)=>any) {
    async.parallel(
        {
            localFiles: (parallelCallback)=>params.container.getFileTree(parallelCallback),

            remoteFiles: (parallelCallback)=>params.subject.getRemoteFileList(params.remoteParty, parallelCallback),
        },

        (error:Error, result:{localFiles:Array<string>, remoteFiles:Array<string>})=> {
            if (error) return callback(error);

            return callback(null, _.union(result.localFiles, result.remoteFiles));
        }
    )
}

function synchronizeFile(params:SyncActionParams, file:string, callback:ErrorCallback):any {
    debug(`synchronizing file: ${file}`);
    async.parallel({
        localMeta: (parallelCallback)=> {
            params.container.getFileMeta(file, parallelCallback)
        },
        remoteMeta: (parallelCallback)=> {
            params.subject.getRemoteFileMeta(params.remoteParty, file, parallelCallback);
        }
    }, (err, result:{localMeta:SyncData, remoteMeta:SyncData})=> {
        if (err) return callback(err);

        issueSubjectCommandsIfNeeded(params, result.localMeta, result.remoteMeta, callback);
    });
}

function issueSubjectCommandsIfNeeded(params:SyncActionParams, ownMeta:SyncData, otherMeta:SyncData, callback) {
    if (otherMeta.exists) {
        if (!ownMeta.exists) {
            if (otherMeta.isDirectory) {
                debug(`remote: ${otherMeta.name} a directory, is missing locally and should be created`);
                return params.container.createDirectory(otherMeta.name, callback);
            }

            debug(`remote ${otherMeta.name} a file, is missing locally and should be downloaded`);
            return params.subject.requestRemoteFile(params.remoteParty, otherMeta.name, callback);
        }

        if (otherMeta.hashCode !== ownMeta.hashCode) {
            debug(`hashes do not match: ${otherMeta.hashCode} own: ${ownMeta.hashCode}`);
            if (new Date(otherMeta.modified).getTime() > new Date(ownMeta.modified).getTime()) {
                debug(`remote ${otherMeta.name} a file, is in older version locally and should be downloaded`);
                return params.subject.requestRemoteFile(params.remoteParty, otherMeta.name, callback);
            }
        }
    }
    if(params.deleteIfMissingRemotely){
        debug(`file ${ownMeta.name} does not exist remotely - it will be deleted locally`);
        return params.container.deleteFile(otherMeta.name, callback);
    }
    debug(`file ${ownMeta.name} does not require any operations`);
    return callback();
}
