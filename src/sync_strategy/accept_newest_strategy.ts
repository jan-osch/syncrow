import {SynchronizationAction, SyncData} from "./sync_strategy";
import * as async from "async";
import * as _ from "lodash";
import {debugFor, loggerFor} from "../utils/logger";
import {Messenger} from "../connection/messenger";

const debug = debugFor('syncrow:accept_newest_strategy');
const logger = loggerFor('NewestStrategy');

/**
 * On every reconnection will accept all newest files
 */
export class NewestStrategy extends SynchronizationAction {


    /**
     * @Override
     */
    public synchronize(otherParty:Messenger):any {

        this.getAllFilesFromBothSides(otherParty, (err, allFiles)=> {
            async.each(allFiles,
                (file, callback)=>this.synchronizeFile(otherParty, file, callback),

                (err:Error)=> {
                    if (err) return logger.error(err);

                    logger.info('synchronized');
                }
            )
        })
    }

    private getAllFilesFromBothSides(otherParty:Messenger, callback:(err:Error, allFiles?:Array<string>)=>any) {
        let localFiles:Array<string>;
        let remoteFiles:Array<string>;
        async.parallel([
                (parallelCallback)=>this.container.getFileTree((err, fileList:Array<string>)=> {
                    if (err) return parallelCallback(err);

                    localFiles = fileList;
                    return parallelCallback();
                }),
                (parallelCallback)=>this.subject.getRemoteFileList(otherParty, (err, fileList:Array<string>)=> {
                    if (err) return parallelCallback(err);

                    remoteFiles = fileList;
                    return parallelCallback();
                })
            ], (error:Error)=> {
                if (error) return callback(error);

                return callback(null, _.union(localFiles, remoteFiles));
            }
        )
    }

    private synchronizeFile(otherParty:Messenger, file:string, callback:Function):any {
        debug(`synchronizing file: ${file}`);
        async.parallel({
            localMeta: (parallelCallback)=> {
                this.container.getFileMeta(file, parallelCallback)
            },
            remoteMeta: (parallelCallback)=> {
                this.subject.getRemoteFileMeta(otherParty, file, parallelCallback);
            }
        }, (err, result:{localMeta:SyncData, remoteMeta:SyncData})=> {
            if (err) return callback(err);

            this.issueSubjectCommandsIfNeeded(otherParty, result.localMeta, result.remoteMeta, callback);
        });
    }

    private issueSubjectCommandsIfNeeded(otherParty:Messenger, ownMeta:SyncData, otherMeta:SyncData, callback) {
        if (otherMeta.exists) {
            if (!ownMeta.exists) {
                if (otherMeta.isDirectory) {
                    debug(`remote: ${otherMeta.name} a directory, is missing locally and should be created`);
                    return this.container.createDirectory(otherMeta.name, callback);
                }

                debug(`remote ${otherMeta.name} a file, is missing locally and should be downloaded`);
                return this.subject.requestRemoteFile(otherParty, otherMeta.name, callback);
            }

            if (otherMeta.hashCode !== ownMeta.hashCode) {
                debug(`hashes do not match: ${otherMeta.hashCode} own: ${ownMeta.hashCode}`)
                if (new Date(otherMeta.modified).getTime() > new Date(ownMeta.modified).getTime()) {
                    debug(`remote ${otherMeta.name} a file, is in older version locally and should be downloaded`);
                    return this.subject.requestRemoteFile(otherParty, otherMeta.name, callback);
                }
            }
        }
        debug(`file ${ownMeta.name} does not require any operations`);
        callback();
    }
}
