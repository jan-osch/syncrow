/// <reference path="../../typings/main.d.ts" />
import * as async from "async";
import * as fs from "fs";
import * as crypto from "crypto";
import {SyncData} from "../sync_strategy/synchronization_strategy";
import {debugFor} from "../utils/logger";

const debug = debugFor('syncrow:file_meta_queue');

export class FileMetaComputingQueue {
    private queue:AsyncQueue<Function>;
    private basePath:string;

    /**
     * Used for computing SyncData
     * @param queueSize
     * @param basePath
     */
    constructor(queueSize:number, basePath:string) {
        this.queue = async.queue((task:Function, callback:Function)=>task(callback), queueSize);
        this.basePath = basePath;
    }

    /**
     * @param fileName
     * @param doneCallback
     */
    public computeFileMeta(fileName:string, doneCallback:(err:Error, syncData?:SyncData)=>any) {
        debug(`computing file meta for file: ${fileName}`);

        const job = (callback)=> {

            const result = {
                name: fileName,
                exists: false,
                modified: null,
                isDirectory: false,
                hashCode: ''
            };

            async.waterfall(
                [
                    (waterfallCallback)=>this.checkIfExistsAndIsDirectory(result, waterfallCallback),
                    (partial, waterfallCallback)=>this.computeHashForFile(partial, waterfallCallback)
                ], (err, result?:SyncData)=> {
                    if (err) {
                        doneCallback(err);
                        return callback();
                    }

                    doneCallback(null, result);
                    return callback();
                }
            );

        };

        this.queue.push(job);
    }

    private checkIfExistsAndIsDirectory(syncData:SyncData, callback:(error, syncData?:SyncData)=>any) {
        fs.stat(`${this.basePath}/${syncData.name}`, (err, stats:fs.Stats)=> {
            if (err) {
                syncData.exists = false;
                return callback(null, syncData);
            }

            syncData.exists = true;
            syncData.modified = stats.mtime;
            if (stats.isDirectory()) {
                debug(`${syncData.name} is a directory`);
                syncData.isDirectory = true;
            }

            return callback(null, syncData);
        });
    }


    private computeHashForFile(syncData:SyncData, callback:(error, syncData?:SyncData)=>any) {
        if (!this.shouldComputeHash(syncData)) {
            return callback(null, syncData);
        }

        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(`${this.basePath}/${syncData.name}`).pipe(hash);

        stream.on('error', (error)=> {
            callback(error);
        });

        hash.on('finish', ()=> {
            syncData.hashCode = hash.read().toString('hex');
            callback(null, syncData);
        });
    }

    private shouldComputeHash(syncData:SyncData) {
        return (syncData.exists && !syncData.isDirectory)
    }
}