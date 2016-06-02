/// <reference path="../../typings/main.d.ts" />


import FileContainer = require("./file_container");
import net  = require('net');
import {Socket, Server} from "net";
import EventsHelper from "./events_helper";
import Messenger = require("./messenger");
import Client = require("../client/client");

const debug = require('debug')('bucketoperator');


class TransferActions {

    /**
     * Listens for other party to connect, then downloads the file from it
     * @param pushingParty
     * @param fileName
     * @param host
     * @param destinationContainer
     * @param callback
     */
    public static listenAndDownloadFile(pushingParty:Messenger,
                                        fileName:string,
                                        host:string,
                                        destinationContainer:FileContainer,
                                        callback:Function) {

        const filePullingServer = net.createServer(

            (socket)=> TransferActions.consumeFileFromSocket(socket,
                fileName,
                destinationContainer,
                ()=>TransferActions.closeServer(filePullingServer, callback))

        ).listen(()=> {

            const address = {
                port: filePullingServer.address().port,
                host: host
            };

            EventsHelper.writeEventToOtherParty(pushingParty, Client.events.connectAndUpload, {
                file: fileName,
                address: address
            });

        })
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

        net.connect(address, (fileSendingSocket)=> {
            fileSendingSocket.on('end', callback);

            sourceContainer.getReadStreamForFile(fileName).pipe(fileSendingSocket);
        })

    }

    /**
     * Listen for other party to connect, and then send the file to it
     * @param otherParty
     * @param fileName
     * @param host
     * @param sourceContainer
     * @param callback
     */
    public static listenAndUploadFile(otherParty:Messenger,
                                      fileName:string,
                                      host:string,
                                      sourceContainer:FileContainer,
                                      callback:Function) {

        const fileOfferingServer = net.createServer(

            (fileTransferSocket)=> {
                fileTransferSocket.on('end', ()=>TransferActions.closeServer(fileOfferingServer, callback));
                sourceContainer.getReadStreamForFile(fileName).pipe(fileTransferSocket);
            }

        ).listen(()=> {

            const address = {
                port: fileOfferingServer.address().port,
                host: host
            };

            EventsHelper.writeEventToOtherParty(otherParty, Client.events.fileOffer, {
                file: fileName,
                address: address
            });
        })
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

        net.connect(address, (fileTransferSocket)=> {
            TransferActions.consumeFileFromSocket(fileTransferSocket, fileName, destinationContainer, callback);
        });
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

export = TransferActions;
