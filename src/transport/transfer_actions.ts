import {Socket} from "net";
import {loggerFor, debugFor} from "../utils/logger";
import {ListenCallback, ConnectionHelper, ConnectionAddress} from "../connection/connection_helper";
import {Container, ErrorCallback} from "../utils/interfaces";

const debug = debugFor("syncrow:trasfer_actions");
const logger = loggerFor('TransferActions');


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
     * @param destinationContainer
     * @param connectionHelper
     * @param doneCallback
     * @param listeningCallback
     */
    public static listenAndDownloadFile(fileName:string,
                                        destinationContainer:Container,
                                        connectionHelper:ConnectionHelper,
                                        doneCallback:ErrorCallback,
                                        listeningCallback:ListenCallback) {

        debug(`executing: listenAndDownloadFile - fileName: ${fileName}`);

        return connectionHelper.getNewSocket(
            {listenCallback: listeningCallback},
            (err, socket)=> {
                if (err)return doneCallback(err);

                return TransferActions.consumeFileFromSocket(socket, fileName, destinationContainer, doneCallback)
            }
        );
    }

    /**
     * Listen for other party to connect, and then send the file to it
     * @param fileName
     * @param sourceContainer
     * @param connectionHelper
     * @param doneCallback
     * @param listenCallback
     */
    public static listenAndUploadFile(fileName:string,
                                      sourceContainer:Container,
                                      connectionHelper:ConnectionHelper,
                                      doneCallback:ErrorCallback,
                                      listenCallback:ListenCallback) {


        debug(`executing: listenAndUploadFile - fileName: ${fileName}`);

        return connectionHelper.getNewSocket(
            {listenCallback: listenCallback},
            (err, fileTransferSocket)=> {
                if (err)return doneCallback(err);

                fileTransferSocket.on('end', doneCallback);
                fileTransferSocket.on('error', doneCallback);
                sourceContainer.getReadStreamForFile(fileName).pipe(fileTransferSocket);
            }
        );
    }

    /**
     * Connects with other party and sends the file to it
     * @param fileName
     * @param address
     * @param sourceContainer
     * @param connectionHelper
     * @param doneCallback
     */
    public static connectAndUploadFile(fileName:string,
                                       address:ConnectionAddress,
                                       sourceContainer:Container,
                                       connectionHelper:ConnectionHelper,
                                       doneCallback:ErrorCallback) {

        debug(`connectAndUploadFile: connecting to ${address.remoteHost}:${address.remotePort}`);

        connectionHelper.getNewSocket(
            address,
            (err, socket)=> {
                if (err) return doneCallback(err);
                socket.on('end', doneCallback);
                socket.on('error', doneCallback);

                return sourceContainer.getReadStreamForFile(fileName).pipe(socket);
            }
        );

    }

    /**
     * Connects with other party and downloads a file from it
     * @param fileName
     * @param address
     * @param destinationContainer
     * @param connectionHelper
     * @param doneCallback
     */
    public static connectAndDownloadFile(fileName:string,
                                         address:ConnectionAddress,
                                         destinationContainer:Container,
                                         connectionHelper:ConnectionHelper,
                                         doneCallback:ErrorCallback) {

        debug(`connectAndDownloadFile: connecting to ${address.remoteHost}:${address.remotePort}`);

        connectionHelper.getNewSocket(
            address,
            (err, socket)=>TransferActions.consumeFileFromSocket(socket, fileName, destinationContainer, doneCallback)
        )
    }

    private static consumeFileFromSocket(fileTransferSocket:Socket, fileName:string, destinationContainer:Container, callback:ErrorCallback) {
        destinationContainer.consumeFileStream(fileName, fileTransferSocket, callback);
    }
}