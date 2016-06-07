import {SynchronizationStrategy, SyncData, StrategySubject} from "./sync_strategy";
import * as async from "async";
import * as _ from "lodash";
import {debugFor, loggerFor} from "../utils/logger";

const debug = debugFor('syncrow:accept_newest_strategy');
const logger = loggerFor('AcceptNewestStrategy');

export class AcceptNewestStrategy extends SynchronizationStrategy {

    /**
     * On every reconnection will accept all newest files
     */
    constructor(subject:StrategySubject) {
        super(subject);
    }

    /**
     * @Override
     */
    public acknowledgeConnectedWithRemoteParty():any {

        this.getAllFilesFromBothSides((err, allFiles)=> {
            async.each(allFiles,
                (file, callback)=>this.synchronizeFile(file, callback),

                (err:Error)=> {
                    if (err) return logger.error(err);

                    logger.info('synchronized');
                }
            )
        })
    }

    private getAllFilesFromBothSides(callback:(err:Error, allFiles?:Array<string>)=>any) {
        let localFiles;
        let remoteFiles;
        async.parallel([
                (parallelCallback)=>this.subject.getLocalFileList((err, fileList:Array<string>)=> {
                    if (err) return parallelCallback(err);

                    localFiles = fileList;
                    return parallelCallback();
                }),
                (parallelCallback)=>this.subject.getRemoteFileList((err, fileList:Array<string>)=> {
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

    private synchronizeFile(file:string, callback:Function):any {
        debug(`synchronizing file: ${file}`);
        async.parallel({
            localMeta: (parallelCallback)=> {
                this.subject.getLocalFileMeta(file, parallelCallback)
            },
            remoteMeta: (parallelCallback)=> {
                this.subject.getRemoteFileMeta(file, parallelCallback);
            }
        }, (err, result:{localMeta:SyncData, remoteMeta:SyncData})=> {
            if (err) return callback(err);

            this.issueSubjectCommandsIfNeeded(result.localMeta, result.remoteMeta, callback);
        });
    }

    private issueSubjectCommandsIfNeeded(ownMeta:SyncData, otherMeta:SyncData, callback) {
        if (otherMeta.exists) {
            if (!ownMeta.exists) {
                if (otherMeta.isDirectory) {
                    debug(`remote: ${otherMeta.name} a directory, is missing locally and should be created`);
                    return this.subject.createLocalDirectory(otherMeta.name, callback);
                }

                debug(`remote ${otherMeta.name} a file, is missing locally and should be downloaded`);
                return this.subject.requestRemoteFile(otherMeta.name, callback);
            }

            if (otherMeta.hashCode !== ownMeta.hashCode) {
                if (otherMeta.modified.getTime() > ownMeta.modified.getTime()) {
                    debug(`remote ${otherMeta.name} a file, is in older version locally and should be downloaded`);
                    return this.subject.requestRemoteFile(otherMeta.name, callback);
                }
            }
        }
        debug(`file ${ownMeta.name} does not require any operations`);
        callback();
    }
}
