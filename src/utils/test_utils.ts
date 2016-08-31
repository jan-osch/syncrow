import * as net from "net";
import * as mkdirp from "mkdirp";
import * as async from "async";
import * as fs from "fs";
import * as rimraf from "rimraf";
import * as path from "path";
import {readTree} from "../fs_helpers/read_tree";


/**
 * @returns {Function} a cleanup function that will close the server and paired sockets
 * @param doneCallback
 */
export function obtainTwoSockets(doneCallback:(err, result?:{client:net.Socket, server:net.Socket})=>any):Function {
    let clientSocket;
    let server;

    const port = 3124; //A constant PORT is used to ensure that the cleanup function is called

    const listener = (socket)=> {
        return doneCallback(null, {client: clientSocket, server: socket});
    };

    async.series(
        [
            (callback)=> {
                server = net.createServer(listener).listen(port, callback);
            },
            (callback)=> {
                clientSocket = net.connect({port: port}, callback)
            }
        ],
        (err)=> {
            if (err)return doneCallback(err);
        }
    );

    return ()=> {
        clientSocket.end();
        server.close();
    }
}

/**
 * @param path
 * @param content
 * @param directory
 * @param doneCallback
 */
export function createPath(path:string, content:string|Buffer, directory:boolean, doneCallback:ErrorCallback) {
    if (directory) {
        return createDir(path, doneCallback);
    }
    return fs.writeFile(path, content, doneCallback);
}


export interface CreatePathArgument {
    path:string;
    content?:string|Buffer;
    directory:boolean;
}

/**
 * @param files
 * @param callback
 */
export function createPathSeries(files:Array<CreatePathArgument>, callback:ErrorCallback) {
    return async.eachSeries(files,

        (file, cb)=> createPath(file.path, file.content, file.directory, cb),

        callback
    );
}

/**
 * @param path
 * @returns {boolean}
 */
export function pathExists(path):boolean {
    try {
        fs.accessSync(path);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * @param firstFilePath
 * @param secondFilePath
 * @param callback
 */
export function compareTwoFiles(firstFilePath:string, secondFilePath:string, callback:ErrorCallback) {
    return async.waterfall(
        [
            (cb)=>getTwoFiles(firstFilePath, secondFilePath, cb),

            (results, cb)=>compareFileContents(firstFilePath, results.first, secondFilePath, results.second, cb)
        ],
        callback
    )
}

/**
 * @param dirPath
 * @param doneCallback
 */
export function createDir(dirPath:string, doneCallback:ErrorCallback) {
    return mkdirp(dirPath, doneCallback);
}


/**
 * @param path
 * @param callback
 */
export function removePath(path:string, callback:ErrorCallback) {
    return rimraf(path, callback);
}

/**
 * @param pathA
 * @param pathB
 * @param callback
 */
export function compareDirectories(pathA:string, pathB:string, callback:ErrorCallback) {

    return async.waterfall(
        [
            (seriesCallback)=> {
                return async.parallel({
                        pathA: (cb)=> readTree(pathA, {}, cb),
                        pathB: (cb)=> readTree(pathB, {}, cb)
                    },
                    seriesCallback
                )
            },
            (results, seriesCallback)=> compareFileTrees(pathA, results.pathA, pathB, results.pathB, seriesCallback)
        ],

        callback
    )
}

/**
 * @param length
 * @returns {string}
 */
export function getRandomString(length:number):string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    function getRandomChar() {
        const position = Math.floor(Math.random() * chars.length);
        return chars.charAt(position);
    }

    while (length > 0) {
        length--;
        result += getRandomChar();
    }

    return result;
}


function getTwoFiles(firstFilePath:string, secondFilePath:string, doneCallback:(err:Error, result:{first?:string, second?:string})=>any) {
    async.parallel(
        {
            first: callback=>fs.readFile(firstFilePath, callback),
            second: callback=>fs.readFile(secondFilePath, callback)
        },

        doneCallback
    );
}

function compareFileTrees(pathA:string, filesA:Array<string>, pathB:string, filesB:Array<string>, callback:ErrorCallback) {
    if (filesA.length !== filesB.length) {
        return setImmediate(callback, new Error(`File trees are not matching - ${filesA.length} and ${filesB.length}`));
    }

    return async.each(filesA,

        (file, cb)=> {
            const firstFilePath = path.join(pathA, file);
            const secondFilePath = path.join(pathB, file);

            return compareTwoFiles(firstFilePath, secondFilePath, cb);
        },

        callback
    )
}

function compareFileContents(pathA:string, contentA:string|Buffer, pathB:string, contentB:string|Buffer, callback) {
    if (Buffer.isBuffer(contentA) && Buffer.isBuffer(contentB)) {
        const buffersAreEqual = (contentA.compare(contentB) === 0);
        if (!buffersAreEqual) return setImmediate(callback, new Error(`File contents ${pathA} and ${pathB} (Buffers) do not match `));

    } else {
        const stringsAreEqual = contentA === contentB;
        if (!stringsAreEqual) return setImmediate(callback, new Error(`File contents ${pathA} and ${pathB} (Strings) do not match`))
    }

    return setImmediate(callback);
}
