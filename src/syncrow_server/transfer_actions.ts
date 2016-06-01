/// <reference path="../../typings/main.d.ts" />


import FileContainer = require("../file_container");
import net  = require('net');
import {Socket} from "net";
import Messenger = require("../messenger");
import Client = require("../client");

const debug = require('debug')('bucketoperator');


class TransferActions {

    /**
     *
     * @param pushingParty
     * @param fileName
     * @param host
     * @param destinationContainer
     * @param callback
     */
    public static pullFileFromParty(pushingParty:Messenger,
                                    fileName:string,
                                    host:string,
                                    destinationContainer:FileContainer,
                                    callback:Function) {

        const filePullingServer = net.createServer(
            (socket)=> TransferActions.consumeFileFromSocket(socket, fileName, destinationContainer, callback)
        ).listen(()=> {

            const address = {
                port: filePullingServer.address().port,
                host: host
            };

            Client.writeEventToSocketMessenger(pushingParty, Client.events.pullFile, {
                file: fileName,
                address: address
            });

        })
    }

    /**
     *
     * @param fileName
     * @param address
     * @param sourceContainer
     * @param callback
     */
    public static pushFileToAddress(fileName:string,
                                    address:{host:string, port:number},
                                    sourceContainer:FileContainer,
                                    callback:Function) {

        net.connect(address, (fileTransferSocket)=> {
            fileTransferSocket.on('end', callback);

            sourceContainer.getReadStreamForFile(fileName).pipe(fileTransferSocket);
        })

    }

    private static consumeFileFromSocket(fileTransferSocket:Socket, fileName:string, destinationContainer:FileContainer, callback:Function) {
        fileTransferSocket.on('end', callback);

        destinationContainer.consumeFileStream(fileName, fileTransferSocket);
    }
}

export = TransferActions;
