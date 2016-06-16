/// <reference path="../../typings/main.d.ts" />

import {FileContainer} from "../fs_helpers/file_container";
import {Socket, Server, createServer, connect} from "net";
import {loggerFor, debugFor} from "../utils/logger";

const debug = debugFor("syncrow:trasfer_actions");
const logger = loggerFor('TransferActions');

export interface TransferStatusEvent {
    file:string,
    download:boolean,
    success:boolean,
    error:string,
    type:'transferStatus',
    id:string
}

//TODO add error handling on sockets
//TODO implement proper ERROR handling
export class TransferActions {

    public static events = {
        listenAndUpload: 'listenAndUpload',
        listenAndDownload: 'listenAndDownload',

        connectAndUpload: 'connectAndUpload',
        connectAndDownload: 'connectAndDownload',
    };


    //TODO
    /** 1: DODAJ TO JAKO subtyp PUSH PULL
     *
     */
    //TODO

    /**
     * Listens for other party to connect, then downloads the file from it
     * @param fileName
     * @param host
     * @param destinationContainer
     * @param doneCallback
     * @param listeningCallback
     */
    public static listenAndDownloadFile(fileName:string,
                                        host:string,
                                        destinationContainer:FileContainer,
                                        doneCallback:Function, listeningCallback:(address:{port:number, host:string})=>any) {

        debug(`executing: listenAndDownloadFile - fileName: ${fileName}, host: ${host}`);
        const filePullingServer = createServer(
            (socket)=> TransferActions.consumeFileFromSocket(socket,
                fileName,
                destinationContainer,
                ()=>TransferActions.closeServer(filePullingServer, doneCallback))
        ).listen(()=> {

            const address = {
                port: filePullingServer.address().port,
                host: host
            };

            listeningCallback(address);

        }).on('error', doneCallback);
    }

    /**
     * Listen for other party to connect, and then send the file to it
     * @param fileName
     * @param host
     * @param sourceContainer
     * @param callback
     * @param listenCallback
     */
    public static listenAndUploadFile(fileName:string,
                                      host:string,
                                      sourceContainer:FileContainer,
                                      callback:Function,
                                      listenCallback:Function) {


        debug(`executing: listenAndUploadFile - fileName: ${fileName}, host: ${host}`);
        const fileOfferingServer = createServer(
            (fileTransferSocket)=> {
                fileTransferSocket.on('end', ()=>TransferActions.closeServer(fileOfferingServer, callback));
                sourceContainer.getReadStreamForFile(fileName).pipe(fileTransferSocket);
            }
        ).listen(()=> {

            const address = {
                port: fileOfferingServer.address().port,
                host: host
            };

            listenCallback(address);
            
        }).on('error', callback);
    }

    /**
     * Connects with other party and sends the file to it
     * @param fileName
     * @param address
     * @param sourceContainer
     * @param callback
     */
    public static connectAndUploadFile(fileName:string,
                                       address:{host:string, port:number},
                                       sourceContainer:FileContainer,
                                       callback:Function) {
        debug(`connectAndUploadFile: connecting to ${address.host}:${address.port}`);
        const fileSendingSocket = connect(address, ()=> {
            fileSendingSocket.on('end', callback);

            sourceContainer.getReadStreamForFile(fileName).pipe(fileSendingSocket);
        }).on('error', callback)

    }

    /**
     * Connects with other party and downloads a file from it
     * @param fileName
     * @param address
     * @param destinationContainer
     * @param callback
     */
    public static connectAndDownloadFile(fileName:string,
                                         address:{host:string, port:number},
                                         destinationContainer:FileContainer,
                                         callback:Function) {

        debug(`connectAndDownloadFile: connecting to ${address.host}:${address.port}`);
        const fileTransferSocket = connect(address, ()=> {
            TransferActions.consumeFileFromSocket(fileTransferSocket, fileName, destinationContainer, callback);
        }).on('error', callback);
    }

    private static closeServer(server:Server, callback:Function) {
        server.close();
        callback();
    }

    private static consumeFileFromSocket(fileTransferSocket:Socket, fileName:string, destinationContainer:FileContainer, callback:Function) {
        fileTransferSocket.on('end', callback);

        destinationContainer.consumeFileStream(fileName, fileTransferSocket);
    }
}