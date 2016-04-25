/// <reference path="../typescript-interfaces/node.d.ts" />
/// <reference path="../typescript-interfaces/async.d.ts" />

import fs = require('fs');
import events = require('events');
import async = require('async');
import crypto = require('crypto');
import path = require('path');
import {WriteStream} from "fs";
import ReadableStream = NodeJS.ReadableStream;

class FileContainer extends events.EventEmitter {
    static events = {
        fileChanged: 'fileChanged',
        fileHashComputed: 'fileHashComputed'
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
        this.beginWatching();
    }

    private getFileTree(callback:(err, files:Array<string>)=>void) {
        callback(null, []);
    }

    public computeHashForFileTree() {
        this.getFileTree((err, fileTree)=> {
            if (err) throw err;
            fileTree.forEach(this.computeHashForFile);
        });
    }

    private computeHashForFile(fileName:string) {
        var hash = crypto.createHash('sha256');
        fs.createReadStream(this.createAbsolutePath(fileName)).pipe(hash);
        hash.on('end', ()=> {
            this.saveAndEmitComputedHash(fileName, hash);
        });
    }

    private saveAndEmitComputedHash(fileName:string, hash:crypto.Hash) {
        if (!this.watchedFiles[fileName]) {
            this.watchedFiles[fileName] = {}
        }
        this.watchedFiles[fileName].hashCode = hash.read().toString();
        this.emit(FileContainer.events.fileHashComputed, fileName)
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
            console.log(`file changed: ${fileName}`);
            if (!that.writingFiles[fileName]) {
                that.emit(FileContainer.events.fileChanged, fileName);
            }
        });
    }
}

export = FileContainer;