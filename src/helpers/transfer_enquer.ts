/// <reference path="../../typings/main.d.ts" />

import Messenger= require('../helpers/messenger');
import FileContainer = require("../helpers/file_container");
import TransferActions = require("../helpers/transfer_actions");
import {AsyncQueue} from "async";

const debug = require('debug')('client');

import errorPrinter = require('../utils/error_printer');


export default class TransferEnqueuer {

    /**
     * @param fileName
     * @param address
     * @param sourceContainer
     * @param queue
     * @param timingMessage
     */
    public static addConnectAndUploadJobToQueue(fileName:string,
                                                address:{port:number, host:string},
                                                sourceContainer:FileContainer,
                                                queue:AsyncQueue,
                                                timingMessage?:string) {
        const job = (uploadingDoneCallback) => {

            if (timingMessage) console.time(timingMessage);

            TransferActions.connectAndUploadFile(fileName, address, sourceContainer, (err)=> {
                errorPrinter(err);
                if (timingMessage) console.timeEnd(timingMessage);

                uploadingDoneCallback()
            });
        };

        queue.push(job);
    }

    /**
     *
     * @param address
     * @param fileName
     * @param destinationContainer
     * @param queue
     * @param timingMessage
     */
    public static addConnectAndDownloadJobToQueue(address:{port:number, host:string},
                                                  fileName:string,
                                                  destinationContainer:FileContainer,
                                                  queue:AsyncQueue,
                                                  timingMessage?:string) {
        const job = (downloadingDoneCallback)=> {

            if (timingMessage) console.time(timingMessage);

            TransferActions.connectAndDownloadFile(fileName, address, destinationContainer, (err)=> {
                errorPrinter(err);
                if (timingMessage)console.timeEnd(timingMessage);

                downloadingDoneCallback()
            });

        };

        queue.push(job);
    }

    /**
     *
     * @param fileName
     * @param otherParty
     * @param host
     * @param sourceContainer
     * @param queue
     * @param timingMessage
     */
    public static addListenAndUploadJobToQueue(fileName:string,
                                               otherParty:Messenger,
                                               host:string,
                                               sourceContainer:FileContainer,
                                               queue:AsyncQueue,
                                               timingMessage?:string) {

        const job = (uploadingDoneCallback)=> {

            if (timingMessage) console.time(timingMessage);

            TransferActions.listenAndUploadFile(otherParty, fileName, host, sourceContainer, (err)=> {
                errorPrinter(err);
                if (timingMessage)console.timeEnd(timingMessage);

                uploadingDoneCallback()
            });

        };

        queue.push(job);
    }

    /**
     *
     * @param otherParty
     * @param fileName
     * @param host
     * @param destinationContainer
     * @param queue
     * @param timingMessage
     */
    public static addListenAndDownloadJobToQueue(otherParty:Messenger,
                                                 fileName:string,
                                                 host:string,
                                                 destinationContainer:FileContainer,
                                                 queue:AsyncQueue,
                                                 timingMessage?:string) {

        const job = (downloadingDoneCallback)=> {

            if (timingMessage) console.time(timingMessage);

            TransferActions.listenAndDownloadFile(otherParty, fileName, host, destinationContainer, (err)=> {
                errorPrinter(err);
                if (timingMessage)console.timeEnd(timingMessage);

                downloadingDoneCallback()
            });

        };

        queue.push(job);
    }
}
