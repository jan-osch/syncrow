import * as net from "net";
import * as mkdirp from "mkdirp";
import * as async from "async";
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
    ], (err)=> {
        if (err) return doneCallback(err);
    });
}

/**
 * @param path
 * @param content
 * @param directory
 * @param doneCallback
 */
export function createPath(path:string, content?:string, directory:boolean, doneCallback:ErrorCallback) {
    if (directory) {
        return createDir(path, doneCallback);
    }

    return fs.writeFile(path, content, doneCallback);
}

/**
 * @param files
 * @param doneCallback
 */
export function createPathSeries(files:Array<{path:string, content?:string, directory?:boolean}>, doneCallback:ErrorCallback) {
    async.eachSeries(files,

        (file, callback)=> createPath(file.path, file.content, file.directory, callback),

        doneCallback);
}

/**
 * @param firstFilePath
 * @param secondFilePath
 * @param doneCallback
 */
export function compareTwoFiles(firstFilePath:string, secondFilePath:string, doneCallback:(err:Error, result:{first:string, second:string})=>any) {
    async.parallel(
        {
            first: callback=>fs.readFile(firstFilePath, callback),
            second: callback=>fs.readFile(secondFilePath, callback)
        },
        
        doneCallback
    );
}

/**
 * @param dirPath
 * @param doneCallback
 */
export function createDir(dirPath:string, doneCallback:ErrorCallback) {
    mkdirp(dirPath, doneCallback);
}

/**
 * @param path
 * @param callback
 */
export function removePath(path:string, callback:ErrorCallback) {
    rimraf(path, callback);
}

