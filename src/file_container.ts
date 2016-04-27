/// <reference path="../typescript-interfaces/node.d.ts" />
/// <reference path="../typescript-interfaces/async.d.ts" />
/// <reference path="../typescript-interfaces/rimraf.d.ts" />

import fs = require('fs');
import events = require('events');
import async = require('async');
import crypto = require('crypto');
import path = require('path');
import readTree = require('./read_tree');
import rimraf = require('rimraf');
import ReadableStream = NodeJS.ReadableStream;


//TODO add support for different parent directory names
class FileContainer extends events.EventEmitter {
    static events = {
        changed: 'changed',
        deleted: 'deleted',
        created: 'created',
        metaComputed: 'metaComputed'
    };
    private directoryToWatch:string;
    private watchedFiles:Object;
    private blockedFiles:Object;
    static watchTimeout = 10;

    constructor(directoryToWatch:string) {
        super();
        this.directoryToWatch = directoryToWatch;
        this.watchedFiles = {};
        this.blockedFiles = {};
        this.computeMetaAndBeginWatching();
    }

    public computeMetaAndBeginWatching() {
        var that = this;
        this.getFileTree((err, files)=> {
            files.forEach((file)=> {
                that.watchedFiles[file] = {};
            });
            that.beginWatching();
        });
    }

    public getListOfWatchedFiles():Array<string> {
        return Object.keys(this.watchedFiles);
    }

    private getFileTree(callback:(err, files:Array<string>)=>void) {
        readTree(this.directoryToWatch, {}, callback);
    }

    public recomputeMetaDataForDirectory() {
        var that = this;
        this.getFileTree((err, files)=> {
            files.forEach(that.computeFileMetaDataAndEmit, that);
        })
    }

    private computeFileMetaDataAndEmit(fileName:string) {
        var that = this;
        async.parallel([(parallelCallback)=> {
            that.computeHashForFile(fileName, parallelCallback);
        }, (parallelCallback)=> {
            that.getModifiedDateForFile(fileName, parallelCallback);
        }], (err:Error)=> {
            if (err) return console.error(err);
            that.emit(FileContainer.events.metaComputed, that.getMetaDataForFile(fileName));
        });
    }

    private computeHashForFile(fileName:string, callback:()=>void) {
        var hash = crypto.createHash('sha256');
        fs.createReadStream(this.createAbsolutePath(fileName)).pipe(hash);
        hash.on('end', ()=> {
            this.saveWatchedFileProperty(fileName, 'hashCode', hash.read().toString());
            callback();
        });
    }

    private getModifiedDateForFile(fileName:string, callback:(err?:Error)=>void) {
        fs.stat(this.createAbsolutePath(fileName), (error:Error, stats:fs.Stats)=> {
                if (error)return callback(error);

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
        return path.join(this.directoryToWatch, file);
    }

    public getMetaDataForFile(fileName:string):{hashCode:string, modified:Date, name:string} {
        return {
            modified: this.watchedFiles[fileName].modifiedDate,
            hashCode: this.watchedFiles[fileName].hashCode,
            name: fileName
        };
    }

    public deleteFile(fileName:string) {
        this.blockedFiles[fileName] = true;
        rimraf(fileName, (error)=> {
            if (error) return console.error(error);
            setTimeout(()=> {
                delete this.blockedFiles[fileName];
            }, FileContainer.watchTimeout);
        });
    }

    public consumeFileStream(fileName:string, readStream:ReadableStream) {
        var that = this;
        that.blockedFiles[fileName] = true;

        var writeStream = fs.createWriteStream(that.createAbsolutePath(fileName)).on('finish', ()=> {
            setTimeout(()=> {
                delete that.blockedFiles[fileName];
            }, FileContainer.watchTimeout);
        });

        readStream.pipe(writeStream);
    }

    public getReadStreamForFile(fileName:string):ReadableStream {
        return fs.createReadStream(this.createAbsolutePath(fileName));
    }

    private beginWatching() {
        var that = this;
        fs.watch(this.directoryToWatch, {recursive: true}).on('change', (event, fileName)=> {
            var fullFileName = that.createAbsolutePath(fileName);
            if (event === 'rename') return that.checkRenameEventMeaning(fullFileName);

            return that.emitEventIfFileNotBlocked(FileContainer.events.changed, fullFileName);
        });
    }

    private checkRenameEventMeaning(fullFileName:string) {
        var that = this;
        if (!that.watchedFiles[fullFileName]) {
            that.watchedFiles[fullFileName] = {};
            return that.emitEventIfFileNotBlocked(FileContainer.events.created, fullFileName);
        }

        fs.stat(that.createAbsolutePath(fullFileName), (err)=> {
            if (err) {
                delete that.watchedFiles[fullFileName];
                return that.emitEventIfFileNotBlocked(FileContainer.events.deleted, fullFileName);
            }

            return that.emitEventIfFileNotBlocked(FileContainer.events.changed, fullFileName);
        })
    }

    emitEventIfFileNotBlocked(event:string, fullFileName:string) {
        if (!this.blockedFiles[fullFileName]) {
            this.emit(event, fullFileName);
        }
    }
}

export = FileContainer;