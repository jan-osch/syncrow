/// <reference path="../../typings/main.d.ts" />
import * as fs from "fs";
import {Stats} from "fs";
import {EventEmitter} from "events";
import * as async from "async";
import * as crypto from "crypto";
import * as path from "path";
import readTree = require('./read_tree');
import rimraf = require('rimraf');
import mkdirp = require('mkdirp');
import ReadableStream = NodeJS.ReadableStream;
import Logger  = require('../utils/logger');
import config from '../configuration';
import {loggerFor, debugFor} from "../utils/logger";
import {PathHelper} from "./path_helper";

const debug = debugFor("syncrow:file_container");
const logger = loggerFor('FileContainer');

// TODO add conflict resolving
// TODO refactor to remove metaComputed event - change to callback
export class FileContainer extends EventEmitter {
    static events = {
        changed: 'changed',
        deleted: 'fileDeleted',
        created: 'created',
        createdDirectory: 'createdDirectory',
        metaComputed: 'metaComputed' // TODO remove
    };
    private directoryToWatch:string;
    private watchedFiles:Object;
    private blockedFiles:Set<string>;

    static watchTimeout = config.fileContainer.watchTimeout;
    static processedFilesLimit = config.fileContainer.processedFilesLimit;
    static directoryHashConstant = config.fileContainer.directoryHashConstant;

    /**
     * Wrapper over filesystem
     * @param directoryToWatch
     */
    constructor(directoryToWatch:string) {
        super();
        this.directoryToWatch = directoryToWatch;
        this.watchedFiles = {};
        this.blockedFiles = new Set();
    }

    /**
     * @param fileName
     * @returns
     */
    public createDirectory(fileName:string) {
        return mkdirp(this.createAbsolutePath(fileName), (error)=> {
            if (error) return logger.warn(`/createDirectory - could not create directory, reason: ${error}`);
        })
    }

    /**
     *
     */
    public getListOfTrackedFilesAndBeginWatching() {
        var that = this;
        this.getFileTree((err, files)=> {
            files.forEach((file)=> {
                that.watchedFiles[file] = {};
            });
            that.beginWatching();
        });
    }

    /**
     * @returns {string[]}
     */
    public getListOfWatchedFiles():Array<string> {
        return Object.keys(this.watchedFiles);
    }

    /**
     * @param callback
     */
    public  getFileTree(callback:(err, files?:Array<string>)=>void) {
        readTree(this.directoryToWatch, {}, (err, results:Array<string>)=> {
            if (err) return callback(err);

            const fileTree = results.map(PathHelper.normalizePath);
            debug(`detected files: ${fileTree}`);

            callback(null, fileTree)
        });
    }

    /**
     * Emits a lot of events
     */
    public recomputeMetaDataForDirectory() {
        var that = this;
        this.getFileTree((err, files)=> {
            async.eachLimit(files, FileContainer.processedFilesLimit, (file:string, callback)=>that.computeFileMetaDataAndEmit(file, callback))
        })
    }

    /**
     * @param file
     * @returns {boolean}
     */
    public isFileInContainer(file:string):boolean {
        return this.watchedFiles[file] !== undefined;
    }

    /**
     * @param fileName
     */
    public deleteFile(fileName:string) {
        this.blockedFiles.add(fileName);
        logger.info(`/deleteFile - deleting: ${fileName}`);

        rimraf(this.createAbsolutePath(fileName), (error)=> {
            if (error) return logger.error(error);
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
     *
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
    } //TODO add stop

    private computeFileMetaDataAndEmit(fileName:string, callback:(err?)=>void) {
        var that = this;
        async.parallel([(parallelCallback)=> {
            that.computeHashForFileOrReturnConstantValueForDirectory(fileName, parallelCallback);

        }, (parallelCallback)=> {
            that.getModifiedDateForFile(fileName, parallelCallback);

        }], (err:Error)=> {
            if (err) return logger.warn(`computeFileMetaDataAndEmit - got error: ${err}`);

            that.emit(FileContainer.events.metaComputed, this.getMetaDataForFile(fileName));
            callback();
        });
    }

    private computeHashForFile(fileName:string, callback:(err?)=>void) {
        var hash = crypto.createHash('sha256');
        fs.createReadStream(this.createAbsolutePath(fileName)).pipe(hash);

        hash.on('finish', ()=> {
            this.saveWatchedFileProperty(fileName, 'hashCode', hash.read().toString('hex'));
            callback();
        });
    }

    private computeHashForFileOrReturnConstantValueForDirectory(fileName:string, callback:(err?)=>any) {
        var that = this;
        fs.stat(this.createAbsolutePath(fileName), (err, stats:Stats)=> {
            if (err)return callback(err);

            if (stats.isDirectory()) {
                that.saveWatchedFileProperty(fileName, 'hashCode', FileContainer.directoryHashConstant);
                return callback();
            }

            that.computeHashForFile(fileName, callback);
        });
    }

    private getModifiedDateForFile(fileName:string, callback:(err?:Error)=>void) {
        fs.stat(this.createAbsolutePath(fileName), (error:Error, stats:fs.Stats)=> {
                if (error) return callback(error);

                this.saveWatchedFileProperty(fileName, 'modifiedDate', stats.mtime);
                callback();
            }
        )
    }

    private saveWatchedFileProperty(fileName:string, key:string, value:any) {
        if (!this.watchedFiles[fileName]) {
            this.watchedFiles[fileName] = {}
        }
        this.watchedFiles[fileName][key] = value;
    }

    private createAbsolutePath(file):string {
        return PathHelper.normalizePath(path.join(this.directoryToWatch, file));
    }

    private getMetaDataForFile(fileName:string):{hashCode:string, modified:Date, name:string} {
        return {
            modified: this.watchedFiles[fileName].modifiedDate,
            hashCode: this.watchedFiles[fileName].hashCode,
            name: fileName
        };
    }

    private checkRenameEventMeaning(fileName:string) {
        var that = this;

        fs.stat(that.createAbsolutePath(fileName), (error, stats:Stats)=> {
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