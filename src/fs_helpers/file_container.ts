import * as fs from "fs";
import * as path from "path";
import {EventEmitter} from "events";
import {loggerFor, debugFor} from "../utils/logger";
import {PathHelper} from "./path_helper";
import {SyncData} from "../sync/sync_actions";
import {FileMetaComputingQueue} from "./file_meta_queue";
import {readTree} from "./read_tree";
import * as rimraf from "rimraf";
import * as mkdirp from "mkdirp";
import * as async from "async";
import * as chokidar from "chokidar";
import {Closable} from "../utils/interfaces";
import ReadableStream = NodeJS.ReadableStream;

const debug = debugFor("syncrow:file_container");
const logger = loggerFor('FileContainer');

const WATCH_TIMEOUT = 700;
const TRANSFER_FILE_LIMIT = 1000;

export interface FilterFunction {
    (s:string):boolean;
}

export interface FileContainerOptions {
    timeout?:number;
    fileLimit?:number;
    filter?:FilterFunction;
}

export class FileContainer extends EventEmitter implements Closable {
    static events = {
        changed: 'changed',
        deleted: 'deleted',
        fileCreated: 'fileCreated',
        createdDirectory: 'createdDirectory',
    };

    private directoryToWatch:string;
    private blockedFiles:Set<string>;
    private cachedSyncData:Map<string,SyncData>;
    private fileMetaQueue:FileMetaComputingQueue;
    private filterFunction:(s:string)=>boolean;
    private watchTimeout:number;
    private watcher:fs.FSWatcher;
    private existingPaths:Set<string>;

    /**
     * Wrapper over filesystem
     * @param directoryToWatch
     * @param options
     */
    constructor(directoryToWatch:string, options:FileContainerOptions = {}) {
        super();

        const fileLimit = options.fileLimit ? options.fileLimit : TRANSFER_FILE_LIMIT;
        this.filterFunction = options.filter ? options.filter : s => false;
        this.watchTimeout = options.timeout ? options.timeout : WATCH_TIMEOUT;
        this.directoryToWatch = directoryToWatch;
        this.blockedFiles = new Set();
        this.cachedSyncData = new Map();
        this.fileMetaQueue = new FileMetaComputingQueue(fileLimit, this.directoryToWatch);
        this.existingPaths = null;
    }

    /**
     * Stops watching the directory
     */
    public shutdown() {
        debug('closing file container watcher');
        this.watcher.close();
    }

    /**
     * @param directoryName
     * @param callback
     */
    public createDirectory(directoryName:string, callback?:Function) {
        logger.info(`creating directory: ${directoryName}`);

        this.addAllParentPathsToExisting(directoryName);
        this.existingPaths.add(directoryName);
        this.blockFile(directoryName);

        return mkdirp(this.createAbsolutePath(directoryName), (error)=> {
            this.unBlockFileWithTimeout(directoryName);

            FileContainer.passErrorIfCallbackIsPresentLogOtherwise(error, callback);
        });
    }

    /**
     * @param callback
     */
    public  getFileTree(callback:(err:Error, files?:Array<string>)=>void) {
        debug(`obtaining file tree`);

        readTree(this.directoryToWatch, {filter: this.filterFunction}, (err, results:Array<string>)=> {
            if (err) return callback(err);

            const fileTree = results.map(PathHelper.normalizePath);
            debug(`detected files: ${fileTree.length}`);

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
     * @param callback
     */
    public consumeFileStream(fileName:string, readStream:ReadableStream, callback:ErrorCallback) {
        this.addAllParentPathsToExisting(fileName);
        this.existingPaths.add(fileName);
        try {
            debug(`starting to read from remote - file ${fileName} is blocked now`);

            this.blockFile(fileName);
            const writeStream = fs.createWriteStream(this.createAbsolutePath(fileName));

            writeStream.on('finish', ()=> this.unBlockFileWithTimeout(fileName));
            writeStream.on('finish', callback);

            readStream.pipe(writeStream).on('error', callback);

        } catch (error) {
            callback(error);
        }
    }

    /**
     * @param fileName
     * @returns {ReadStream}
     */
    public getReadStreamForFile(fileName:string):ReadableStream {
        try {
            return fs.createReadStream(this.createAbsolutePath(fileName)).on('error', (error)=> {
                logger.warn(`/getReadStreamForFile - could not open a read stream, reason: ${error}`);
            });

        } catch (error) {
            logger.warn(`/getReadStreamForFile - could not open a read stream, reason: ${error}`);
        }
    }

    /**
     * Starts watching and emitting commands
     * @param callback
     */
    public beginWatching(callback?:ErrorCallback) {
        return async.waterfall(
            [
                (cb)=>this.getFileTree(cb),
                (results, cb)=> {
                    this.existingPaths = new Set(results);
                    debug(`initial scan ready - watching ${results.length} paths`);
                    return setImmediate(cb);
                },
                (cb)=>this.startWatcher(cb)
            ],
            callback
        )
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

    private startWatcher(callback?:ErrorCallback) {
        this.watcher = chokidar.watch(path.resolve(this.directoryToWatch), {
            persistent: true,
            ignoreInitial: true,
            usePolling: true,
            cwd: this.directoryToWatch,
            ignored: this.filterFunction
        });

        debug(`beginning to watch a directory: ${this.directoryToWatch}`);

        this.watcher.on('add', path => {
            if (!this.existingPaths.has(path)) {
                this.existingPaths.add(path);
                this.emitEventIfFileNotBlocked(FileContainer.events.fileCreated, path)
            }
        });
        this.watcher.on('change', path => this.emitEventIfFileNotBlocked(FileContainer.events.changed, path));
        this.watcher.on('unlink', path=> {
            this.existingPaths.delete(path);
            this.emitEventIfFileNotBlocked(FileContainer.events.deleted, path)
        });
        this.watcher.on('addDir', path=> {
            if (!this.existingPaths.has(path)) {
                this.existingPaths.add(path);
                this.emitEventIfFileNotBlocked(FileContainer.events.createdDirectory, path)
            }
        });
        this.watcher.on('unlinkDir', path=> {
            this.existingPaths.delete(path);
            this.emitEventIfFileNotBlocked(FileContainer.events.deleted, path)
        });

        this.watcher.on('ready', ()=> {
            callback();
        });
        this.watcher.on('error', (err)=> {
            logger.error(`watcher emitted: ${err}`);
            callback(err);
        });
    }

    private createAbsolutePath(file):string {
        return PathHelper.normalizePath(path.join(this.directoryToWatch, file));
    }

    private blockFile(fileName:string) {
        this.blockedFiles.add(fileName);
    }

    private unBlockFileWithTimeout(fileName:string) {
        if (!this.blockedFiles.has(fileName)) return logger.error(`Attempting to unblock a file that is not blocked: ${fileName}`);

        setTimeout(()=> {
            debug(`unblocking file: ${fileName}`);
            this.blockedFiles.delete(fileName);
        }, this.watchTimeout);
    }

    private emitEventIfFileNotBlocked(event:string, fullFileName:string) {
        debug(`could emit ${event} for ${fullFileName}`);
        if (!this.blockedFiles.has(fullFileName)) {
            debug(`emitting ${event} for file: ${fullFileName}`);
            this.emit(event, fullFileName);
        }
    }

    private addAllParentPathsToExisting(path:string) {
        for (let i = path.length - 1; i > 0; i--) {
            if (path.charAt(i) === '/') {
                this.existingPaths.add(path.slice(0, i - 1));
            }
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