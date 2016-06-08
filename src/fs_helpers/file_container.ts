/// <reference path="../../typings/main.d.ts" />
import * as fs from "fs";
import * as path from "path";
import {EventEmitter} from "events";
import config from "../configuration";
import {loggerFor, debugFor} from "../utils/logger";
import {PathHelper} from "./path_helper";
import {SyncData} from "../sync_strategy/sync_strategy";
import {FileMetaComputingQueue} from "./file_meta_queue";
import {readTree} from "./read_tree";
import * as rimraf from "rimraf";
import * as mkdirp from "mkdirp";
import * as chokidar from "chokidar";
import ReadableStream = NodeJS.ReadableStream;

const debug = debugFor("syncrow:file_container");
const logger = loggerFor('FileContainer');

export class FileContainer extends EventEmitter {
    static events = {
        changed: 'changed',
        deleted: 'deleted',
        fileCreated: 'fileCreated',
        createdDirectory: 'createdDirectory',
    };

    private directoryToWatch:string;
    private watchedFiles:Set<string>;
    private blockedFiles:Set<string>;
    private cachedSyncData:Map<string,SyncData>;
    private fileMetaQueue:FileMetaComputingQueue;

    static watchTimeout = config.fileContainer.watchTimeout;

    /**
     * Wrapper over filesystem
     * @param directoryToWatch
     */
    constructor(directoryToWatch:string) {
        super();
        this.directoryToWatch = directoryToWatch;
        this.blockedFiles = new Set();
        this.watchedFiles = new Set();
        this.cachedSyncData = new Map();
        this.fileMetaQueue = new FileMetaComputingQueue(config.fileContainer.processedFilesLimit, this.directoryToWatch);
    }

    /**
     * @param directoryName
     * @param callback
     */
    public createDirectory(directoryName:string, callback?:Function) {
        logger.info(`creating directory: ${directoryName}`);

        this.blockFile(directoryName);
        return mkdirp(this.createAbsolutePath(directoryName), (error)=> {
            this.unBlockFileWithTimeout(directoryName);

            FileContainer.passErrorIfCallbackIsPresentLogOtherwise(error, callback);
        });
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
        logger.info(`deleting file: ${fileName}`);

        this.blockFile(fileName);
        rimraf(this.createAbsolutePath(fileName), (error)=> {
            this.unBlockFileWithTimeout(fileName);

            FileContainer.passErrorIfCallbackIsPresentLogOtherwise(error, callback);
        });
    }

    /**
     *
     * @param fileName
     * @param readStream
     */
    public consumeFileStream(fileName:string, readStream:ReadableStream) {
        try {
            debug(`starting to read from remote - file ${fileName} is blocked now`);

            this.blockFile(fileName);
            const writeStream = fs.createWriteStream(this.createAbsolutePath(fileName));

            writeStream.on('finish', ()=> this.unBlockFileWithTimeout(fileName));

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
    public beginWatchin2() {
        debug(`beginning to watch a directory: ${this.directoryToWatch}`);

        this.getFileTree((err, fileTree:Array<string>)=> {
            if (err) return logger.error(err);

            this.watchedFiles = new Set(fileTree);

            fs.watch(this.directoryToWatch, {recursive: true}).on('change', (event, fileName)=> {
                debug(`got event: ${event} for file: ${fileName}`);

                this.cachedSyncData.delete(fileName);

                if (event === 'rename') return this.checkRenameEventMeaning(PathHelper.normalizePath(fileName));

                return this.emitEventIfFileNotBlocked(FileContainer.events.changed, PathHelper.normalizePath(fileName));
            });
        });
    }

    public beginWatching() {
        const watcher = chokidar.watch(this.directoryToWatch, {persistent: true});
        debug(`beginning to watch a directory: ${this.directoryToWatch}`);

        watcher.on('add', path => this.emitEventIfFileNotBlocked(FileContainer.events.fileCreated, path));
        watcher.on('change', path => this.emitEventIfFileNotBlocked(FileContainer.events.changed, path));
        watcher.on('unlink', path=> this.emitEventIfFileNotBlocked(FileContainer.events.deleted, path));
        watcher.on('addDir', path=> this.emitEventIfFileNotBlocked(FileContainer.events.createdDirectory, path));
        watcher.on('unlinkDir', path=> this.emitEventIfFileNotBlocked(FileContainer.events.deleted, path));
    }

    /**
     * @param fileName
     * @param callback
     */
    public getFileMeta(fileName:string, callback:(err:Error, syncData?:SyncData)=>any) {
        if (this.cachedSyncData.has(fileName)) {
            debug(`found cached sync data for file ${fileName}`);
            return callback(null, this.cachedSyncData.get(fileName));
        }
        this.fileMetaQueue.computeFileMeta(fileName, (err, syncData)=> {
            if (!err && syncData) this.cachedSyncData.set(fileName, syncData);

            return callback(err, syncData);
        });
    }

    private createAbsolutePath(file):string { // TODO check where paths should be normalized
        return PathHelper.normalizePath(path.join(this.directoryToWatch, file));
    }

    private checkRenameEventMeaning(fileName:string) {
        fs.stat(this.createAbsolutePath(fileName), (error, stats:fs.Stats)=> {
            if (error && this.watchedFiles.has(fileName)) {
                this.watchedFiles.delete(fileName);
                return this.emitEventIfFileNotBlocked(FileContainer.events.deleted, fileName);

            } else if (error) return logger.warn(`/checkRenameEventMeaning - deleted a non-tracked file, filename: ${fileName} reason: ${error}`);

            else if (!this.watchedFiles.has(fileName)) {
                this.watchedFiles.add(fileName);

                if (stats.isDirectory())return this.emitEventIfFileNotBlocked(FileContainer.events.createdDirectory, fileName);

                return this.emitEventIfFileNotBlocked(FileContainer.events.fileCreated, fileName);
            }
            return this.emitEventIfFileNotBlocked(FileContainer.events.changed, fileName);
        });
    }

    private blockFile(fileName:string) {
        this.blockedFiles.add(fileName);
    }

    private unBlockFileWithTimeout(fileName:string) {
        if (!this.blockedFiles.has(fileName)) throw new Error('Attempting to unblock a file that is not blocked');

        setTimeout(()=> {
            debug(`uncblocking file: ${fileName}`);
            this.blockedFiles.delete(fileName);
        }, FileContainer.watchTimeout);
    }

    private emitEventIfFileNotBlocked(event:string, fullFileName:string) {
        if (!this.blockedFiles.has(fullFileName)) {
            debug(`emitting ${event} for file: ${fullFileName}`);
            this.emit(event, fullFileName);
        }
    }

    private static passErrorIfCallbackIsPresentLogOtherwise(error:Error, callback?:Function) {
        if (error) {
            if (callback) return callback(error);

            return logger.error(error);
        }

        if (callback) return callback();
    }
}