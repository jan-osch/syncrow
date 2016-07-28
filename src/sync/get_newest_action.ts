import {
    SyncAction,
    SyncData,
    SyncActionParams,
    SyncActionFactory,
    SyncActionSubject,
    buildParams
} from "./sync_strategy";
import * as async from "async";
import * as _ from "lodash";
import {debugFor, loggerFor} from "../utils/logger";
import {EventedMessenger} from "../connection/evented_messenger";
import {FileContainer} from "../fs_helpers/file_container";

const debug = debugFor('syncrow:sync:newest');
const logger = loggerFor('GetNewestSyncAction');

/**
 * On every reconnection will accept all newest files
 */
class GetNewestSyncAction implements SyncAction {
    public execute(params:SyncActionParams, callback:ErrorCallback):any {
        this.getAllFilesFromBothSides(params, (err, allFiles)=> {
            async.each(allFiles,
                (file, cb)=>this.synchronizeFile(params, file, cb),
                callback
            )
        })
    }

    private getAllFilesFromBothSides(params:SyncActionParams, callback:(err:Error, allFiles?:Array<string>)=>any) {
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

    private synchronizeFile(params:SyncActionParams, file:string, callback:ErrorCallback):any {
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

            GetNewestSyncAction.issueSubjectCommandsIfNeeded(params, result.localMeta, result.remoteMeta, callback);
        });
    }

    private static issueSubjectCommandsIfNeeded(params:SyncActionParams, ownMeta:SyncData, otherMeta:SyncData, callback) {
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
        debug(`file ${ownMeta.name} does not require any operations`);
        return callback();
    }
}

export class GetNewestActionFactory implements SyncActionFactory {
    sync(remoteParty:EventedMessenger, container:FileContainer, subject:SyncActionSubject, callback:ErrorCallback):any {
        const params = buildParams(remoteParty, container, subject);
        new GetNewestSyncAction().execute(params, callback);
    }
}