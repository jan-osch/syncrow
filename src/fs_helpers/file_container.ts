/// <reference path="../../typings/main.d.ts" />
import * as fs from "fs";
import * as path from "path";
import {EventEmitter} from "events";
import config from "../configuration";
import {loggerFor, debugFor} from "../utils/logger";
import {PathHelper} from "./path_helper";
import {SyncData} from "../sync_strategy/synchronization_strategy";
import {FileMetaComputingQueue} from "./file_meta_queue";
import {readTree} from "./read_tree";
import * as rimraf from "rimraf";
import * as mkdirp from "mkdirp";
import ReadableStream = NodeJS.ReadableStream;

const debug = debugFor("syncrow:file_container");
const logger = loggerFor('FileContainer');

export class FileContainer extends EventEmitter {
    static events = {
        changed: 'changed',
        deleted: 'deleted',
        created: 'created',
        createdDirectory: 'createdDirectory',
    };

    private directoryToWatch:string;
    private watchedFiles:Object;
    private blockedFiles:Set<string>;
    private fileMetaQueue:FileMetaComputingQueue;

    static watchTimeout = config.fileContainer.watchTimeout;

    /**
     * Wrapper over filesystem
     * @param directoryToWatch
     */
    constructor(directoryToWatch:string) {
        super();
        this.directoryToWatch = directoryToWatch;
        this.watchedFiles = {};
        this.blockedFiles = new Set();
        this.fileMetaQueue = new FileMetaComputingQueue(config.fileContainer.processedFilesLimit, this.directoryToWatch);
    }

    /**
     * @param directoryName
     * @param callback
     */
    public createDirectory(directoryName:string, callback?:Function) {
        return mkdirp(this.createAbsolutePath(directoryName), (error)=> {
            if (error) logger.warn(`/createDirectory - could not create directory, reason: ${error}`);
            if (callback)return callback();
        })
    }

    /**
     * @param callback
     */
    public  getFileTree(callback:(err, files?:Array<string>)=>void) {
        debug(`obtaining file tree`);
        readTree(this.directoryToWatch, {}, (err, results:Array<string>)=> {
            if (err) return callback(err);

            const fileTree = results.map(PathHelper.normalizePath);
            debug(`detected files: ${fileTree}`);

            callback(null, fileTree)
        });
    }

    /**
     * @param fileName
     * @param callback
     */
    public deleteFile(fileName:string, callback?:(err?:Error)=>any) {
        this.blockedFiles.add(fileName);
        logger.info(`/deleteFile - deleting: ${fileName}`);

        rimraf(this.createAbsolutePath(fileName), (error)=> {
            if (error) return callback(error);

            if (callback)callback();

            setTimeout(()=> {
                this.blockedFiles.delete(fileName);
            }, FileContainer.watchTimeout);
        });
    }

    /**
     *
     * @param fileName
     * @param readStream
     */
    public consumeFileStream(fileName:string, readStream:ReadableStream) {
        try {
            var that = this;
            that.blockedFiles.add(fileName);

            var writeStream = fs.createWriteStream(that.createAbsolutePath(fileName)).on('finish', ()=> {
                setTimeout(()=> {
                    that.blockedFiles.delete(fileName);
                }, FileContainer.watchTimeout);
            });

            readStream.pipe(writeStream);

        } catch (error) {
            logger.warn(`/consumeFileStream - could not consume a fileStream, reason: ${error}`)
        }
    }

    /**
     * @param fileName
     * @returns {ReadStream}
     */
    public getReadStreamForFile(fileName:string):ReadableStream {
        debug(`attempting to get a read stream: ${fileName} current dir ${__dirname}`);
        try {
            return fs.createReadStream(this.createAbsolutePath(fileName));
        } catch (error) {
            logger.warn(`/getReadStreamForFile - could not open a read stream, reason: ${error}`);
        }
    }


    /**
     * Starts watching and emitting events
     */
    public beginWatching() {
        debug(`beginning to watch a directory: ${this.directoryToWatch}`);
        fs.watch(this.directoryToWatch, {recursive: true}).on('change', (event, fileName)=> {
            debug(`got event: ${event} for file: ${fileName}`);

            if (event === 'rename') return this.checkRenameEventMeaning(PathHelper.normalizePath(fileName));

            return this.emitEventIfFileNotBlocked(FileContainer.events.changed, PathHelper.normalizePath(fileName));
        });
    }

    /**
     * @param fileName
     * @param callback
     */
    public getFileMeta(fileName:string, callback:(err:Error, syncData?:SyncData)=>any) {
        this.fileMetaQueue.computeFileMeta(fileName, callback);
    }

    private createAbsolutePath(file):string { // TODO check where paths should be normalized
        return PathHelper.normalizePath(path.join(this.directoryToWatch, file));
    }

    private checkRenameEventMeaning(fileName:string) {
        var that = this;

        fs.stat(that.createAbsolutePath(fileName), (error, stats:fs.Stats)=> {
            if (error && that.watchedFiles[fileName]) {
                delete that.watchedFiles[fileName];
                return that.emitEventIfFileNotBlocked(FileContainer.events.deleted, fileName);

            } else if (error) {
                return logger.warn(`/checkRenameEventMeaning - deleted a non-tracked file, filename: ${fileName} reason: ${error}`);

            } else if (!that.watchedFiles[fileName] && stats.isDirectory()) {
                that.watchedFiles[fileName] = {};
                return that.emitEventIfFileNotBlocked(FileContainer.events.createdDirectory, fileName);

            } else if (!that.watchedFiles[fileName]) {
                that.watchedFiles[fileName] = {};
                return that.emitEventIfFileNotBlocked(FileContainer.events.created, fileName);
            }

            return that.emitEventIfFileNotBlocked(FileContainer.events.changed, fileName);
        })
    }

    private emitEventIfFileNotBlocked(event:string, fullFileName:string) {
        if (!this.blockedFiles.has(fullFileName)) {
            debug(`emitting ${event} for file: ${fullFileName}`);
            this.emit(event, fullFileName);
        }
    }
}