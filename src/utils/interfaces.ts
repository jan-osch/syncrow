import ReadableStream = NodeJS.ReadableStream;

export interface Closable {
    shutdown:()=>any
}

export interface Container {
    consumeFileStream(fileName:string, readStream:ReadableStream, callback:ErrorCallback)
    getReadStreamForFile(fileName:string):ReadableStream
}