import {FileContainer} from "../fs_helpers/file_container";
import {Socket, Server, createServer, connect} from "net";
import {loggerFor, debugFor} from "../utils/logger";

const debug = debugFor("syncrow:trasfer_actions");
const logger = loggerFor('TransferActions');

export type ListenCallback = (address:{port:number, host:string})=>any;

export class TransferActions {

    public static events = {
        listenAndUpload: 'listenAndUpload',
        listenAndDownload: 'listenAndDownload',

        connectAndUpload: 'connectAndUpload',
        connectAndDownload: 'connectAndDownload',
    };


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
                                        doneCallback:Function,
                                        listeningCallback:ListenCallback) {

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
     * @param doneCallback
     * @param listenCallback
     */
    public static listenAndUploadFile(fileName:string,
                                      host:string,
                                      sourceContainer:FileContainer,
                                      doneCallback:ErrorCallback,
                                      listenCallback:ListenCallback) {


        debug(`executing: listenAndUploadFile - fileName: ${fileName}, host: ${host}`);
        const fileOfferingServer = createServer(
            (fileTransferSocket)=> {
                fileTransferSocket.on('end', ()=>TransferActions.closeServer(fileOfferingServer, doneCallback));
                sourceContainer.getReadStreamForFile(fileName).pipe(fileTransferSocket);
            }
        ).listen(()=> {

            const address = {
                port: fileOfferingServer.address().port,
                host: host
            };

            listenCallback(address);

        }).on('error', doneCallback);
    }

    /**
     * Connects with other party and sends the file to it
     * @param fileName
     * @param address
     * @param sourceContainer
     * @param doneCallback
     */
    public static connectAndUploadFile(fileName:string,
                                       address:{host:string, port:number},
                                       sourceContainer:FileContainer,
                                       doneCallback:ErrorCallback) {
        debug(`connectAndUploadFile: connecting to ${address.host}:${address.port}`);
        const fileSendingSocket = connect(address, ()=> {
            fileSendingSocket.on('end', doneCallback);

            sourceContainer.getReadStreamForFile(fileName).pipe(fileSendingSocket);
        }).on('error', doneCallback)

    }

    /**
     * Connects with other party and downloads a file from it
     * @param fileName
     * @param address
     * @param destinationContainer
     * @param doneCallback
     */
    public static connectAndDownloadFile(fileName:string,
                                         address:{host:string, port:number},
                                         destinationContainer:FileContainer,
                                         doneCallback:ErrorCallback) {

        debug(`connectAndDownloadFile: connecting to ${address.host}:${address.port}`);
        const fileTransferSocket = connect(address, ()=> {
            TransferActions.consumeFileFromSocket(fileTransferSocket, fileName, destinationContainer, doneCallback);
        }).on('error', doneCallback);
    }

    private static closeServer(server:Server, callback:Function) {
        server.close();
        callback();
    }

    private static consumeFileFromSocket(fileTransferSocket:Socket, fileName:string, destinationContainer:FileContainer, callback:ErrorCallback) {
        destinationContainer.consumeFileStream(fileName, fileTransferSocket, callback);
    }
}