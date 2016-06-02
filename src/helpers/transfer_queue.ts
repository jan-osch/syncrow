/// <reference path="../../typings/main.d.ts" />

import Messenger= require('../helpers/messenger');
import FileContainer = require("../helpers/file_container");
import TransferActions = require("../helpers/transfer_actions");
import async = require("async");

const debug = require('debug')('transfer:queue');

import errorPrinter = require('../utils/error_printer');


export default class TransferQueue {

    private queue:AsyncQueue;

    constructor(concurrency:number) {
        this.queue = async.queue((job:Function, callback:Function)=>job(callback), concurrency);
    }

    /**
     * @param fileName
     * @param address
     * @param sourceContainer
     * @param timingMessage
     */
    public addConnectAndUploadJobToQueue(fileName:string,
                                         address:{port:number, host:string},
                                         sourceContainer:FileContainer,
                                         timingMessage?:string) {
        const job = (uploadingDoneCallback) => {

            if (timingMessage) console.time(timingMessage);

            TransferActions.connectAndUploadFile(fileName, address, sourceContainer, (err)=> {
                errorPrinter(err);
                if (timingMessage) console.timeEnd(timingMessage);

                uploadingDoneCallback()
            });
        };

        this.queue.push(job);
    }

    /**
     *
     * @param address
     * @param fileName
     * @param destinationContainer
     * @param timingMessage
     * @param callback
     */
    public addConnectAndDownloadJobToQueue(address:{port:number, host:string},
                                           fileName:string,
                                           destinationContainer:FileContainer,
                                           timingMessage?:string,
                                           callback?:Function) {

        const job = (downloadingDoneCallback)=> {

            if (timingMessage) console.time(timingMessage);

            TransferActions.connectAndDownloadFile(fileName, address, destinationContainer, (err)=> {
                errorPrinter(err);
                if (timingMessage)console.timeEnd(timingMessage);

                downloadingDoneCallback()
            });

        };

        this.queue.push(job, callback);
    }

    /**
     *
     * @param fileName
     * @param otherParty
     * @param host
     * @param sourceContainer
     * @param timingMessage
     */
    public  addListenAndUploadJobToQueue(fileName:string,
                                         otherParty:Messenger,
                                         host:string,
                                         sourceContainer:FileContainer,
                                         timingMessage?:string) {

        const job = (uploadingDoneCallback)=> {

            if (timingMessage) console.time(timingMessage);

            TransferActions.listenAndUploadFile(otherParty, fileName, host, sourceContainer, (err)=> {
                errorPrinter(err);
                if (timingMessage)console.timeEnd(timingMessage);

                uploadingDoneCallback()
            });

        };

        this.queue.push(job);
    }

    /**
     *
     * @param otherParty
     * @param fileName
     * @param host
     * @param destinationContainer
     * @param timingMessage
     * @param callback
     */
    public  addListenAndDownloadJobToQueue(otherParty:Messenger,
                                           fileName:string,
                                           host:string,
                                           destinationContainer:FileContainer,
                                           timingMessage?:string,
                                           callback?:Function) {

        const job = (downloadingDoneCallback)=> {

            if (timingMessage) console.time(timingMessage);

            TransferActions.listenAndDownloadFile(otherParty, fileName, host, destinationContainer, (err)=> {
                errorPrinter(err);
                if (timingMessage)console.timeEnd(timingMessage);

                downloadingDoneCallback()
            });

        };

        this.queue.push(job, callback);
    }
}
