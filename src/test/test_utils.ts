import * as net from "net";
import * as mkdirp from "mkdirp";
import * as async from "async";
import * as path from "path";
import * as fs from "fs";
import * as rimraf from "rimraf";

/**
 * @param doneCallback
 */
export function obtainTwoSockets(doneCallback:(err, result?:{client:net.Socket, server:net.Socket})=>any) {
    let clientSocket;
    const port = 3124;
    const listener = (socket)=> {
        return doneCallback(null, {client: clientSocket, server: socket});
    };

    async.series([
        (callback)=> {
            net.createServer(listener).listen(port, callback);
        },
        (callback)=> {
            clientSocket = net.connect({port: port}, callback)
        }
    ], (err)=>{
        if(err) return doneCallback(err);
    });
}

/**
 * @param filePath
 * @param content
 * @param doneCallback
 */
export function createFile(filePath:string, content:string, doneCallback:ErrorCallback) {
    async.series([
        callback =>mkdirp(path.dirname(filePath), callback),
        callback => fs.writeFile(filePath, content, callback),
    ], doneCallback)
}

/**
 * @param files
 * @param doneCallback
 */
export function createMultipleFiles(files:Array<{filePath:string, content:string}>, doneCallback:ErrorCallback) {
    async.each(files,

        (file, callback)=> createFile(file.filePath, file.content, callback),

        doneCallback);
}

/**
 * @param firstFilePath
 * @param secondFilePath
 * @param doneCallback
 */
export function compareTwoFiles(firstFilePath:string, secondFilePath:string, doneCallback:(err:Error, result:{matching:boolean, reason?:string})=>any) {
    async.parallel({
        first: callback=>fs.readFile(firstFilePath, callback),
        second: callback=>fs.readFile(secondFilePath, callback)
    }, (err, fetchedContents:{first:string, second:string})=> {
        if (err) return doneCallback(null, {matching: false, reason: err});

        if (fetchedContents.first === fetchedContents.second) return doneCallback(null, {matching: true});
        return doneCallback(null, {matching: false, reason: 'Content not matching'});
    });
}

/**
 * @param dirPath
 * @param doneCallback
 */
export function createTestDir(dirPath:string, doneCallback:ErrorCallback) {
    async.series([
        (callback)=>rimraf(dirPath, callback),
        (callback)=>mkdirp(dirPath, callback),
    ], doneCallback);
}
