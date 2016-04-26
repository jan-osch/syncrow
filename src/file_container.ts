/// <reference path="../typescript-interfaces/node.d.ts" />
/// <reference path="../typescript-interfaces/async.d.ts" />

import fs = require('fs');
import events = require('events');
import async = require('async');
import crypto = require('crypto');
import path = require('path');
import readTree = require('./read_tree');
import {WriteStream} from "fs";
import ReadableStream = NodeJS.ReadableStream;

class FileContainer extends events.EventEmitter {
    static events = {
        fileChanged: 'fileChanged',
        fileDeleted: 'fileDeleted',
        fileCreated: 'fileCreated',
        fileMetaComputed: 'fileMetaComputed'
    };
    private directoryToWatch:string;
    private watchedFiles:Object;
    private writingFiles:Object;
    static watchTimeout = 10;

    constructor(directoryToWatch:string) {
        super();
        this.directoryToWatch = directoryToWatch;
        this.watchedFiles = {};
        this.writingFiles = {};
        this.computeMetaAndBeginWatching();
    }

    public computeMetaAndBeginWatching() {
        var that = this;
        this.getFileTree((err, files)=> {
            files.forEach((file)=> {
                that.watchedFiles[file] = {};
            });
            that.computeMetaDataForFilesList(files);
            that.beginWatching();
        });
    }

    private getFileTree(callback:(err, files:Array<string>)=>void) {
        readTree(this.directoryToWatch, {}, callback);
    }

    public recomputeMetaDataForDirectory() {
        var that = this;
        this.getFileTree((err, files)=> {
            that.computeMetaDataForFilesList(files);
        })
    }

    private computeMetaDataForFilesList(files:Array<string>) {
        files.forEach(this.computeFileMetaDataAndEmit, this);
    }

    private computeFileMetaDataAndEmit(fileName:string) {
        var that = this;
        async.parallel([(parallelCallback)=> {
            that.computeHashForFile(fileName, parallelCallback);
        }, (parallelCallback)=> {
            that.getModifiedDateForFile(fileName, parallelCallback);
        }], (err:Error)=> {
            if (err) return console.error(err);
            that.emit(FileContainer.events.fileMetaComputed, that.getMetaDataForFile(fileName));
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

    public getMetaDataForFile(fileName:string):{hashCode:string, modified:Date} {
        return this.watchedFiles[fileName];
    }

    public getWriteStreamForFile(fileName:string):WriteStream {
        var that = this;
        that.writingFiles[fileName] = true;
        return fs.createWriteStream(that.createAbsolutePath(fileName)).on('finish', ()=> {
            setTimeout(()=> {
                that.writingFiles[fileName] = false;
            }, FileContainer.watchTimeout);
        })
    }

    public getReadStreamForFile(fileName:string) {
        return fs.createReadStream(this.createAbsolutePath(fileName));
    }

    private beginWatching() {
        var that = this;
        fs.watch(this.directoryToWatch, {recursive: true}).on('change', (event, fileName)=> {
            if (event === 'rename') return that.checkRenameEventMeaning(fileName);

            return that.emit(FileContainer.events.fileChanged, fileName);
        });
    }

    private checkRenameEventMeaning(fileName:string) {
        var that = this;
        if (!that.watchedFiles[fileName]) {
            that.watchedFiles[fileName] = {};
            return that.emit(FileContainer.events.fileCreated, fileName);
        }

        fs.stat(that.createAbsolutePath(fileName), (err)=> {
            if (err) return that.emit(FileContainer.events.fileDeleted, fileName);

            return that.emit(FileContainer.events.fileChanged, fileName);
        })
    }
}

export = FileContainer;