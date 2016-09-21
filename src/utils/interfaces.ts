import ReadableStream = NodeJS.ReadableStream;
import {Engine} from "../core/engine";

export interface Closable {
    shutdown:()=>any
}

export interface Container {
    consumeFileStream(fileName:string, readStream:ReadableStream, callback:ErrorCallback)
    getReadStreamForFile(fileName:string):ReadableStream
}

export interface ErrorCallback {
    (err?:Error):any
}

export interface EngineCallback {
    (err:Error, engine?:Engine):any
}
