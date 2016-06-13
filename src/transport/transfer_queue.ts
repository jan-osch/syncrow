/// <reference path="../../typings/main.d.ts" />

import {Messenger} from "../connection/messenger";
import {FileContainer} from "../fs_helpers/file_container";
import {TransferActions} from "./transfer_actions";
import * as async from "async";
import * as debugFor from "debug";
import {loggerFor} from "../utils/logger";

const debug = debugFor("syncrow:trasfer_queue");
const logger = loggerFor('TransferQueue');

export class TransferQueue {

    private queue:AsyncQueue;
    private name:string;

    constructor(concurrency:number, name:string='') {
        this.queue = async.queue((job:Function, callback:Function)=>job(callback), concurrency);
        this.name = name;
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

        debug(`adding job: connectAndUploadFile: ${fileName}`);
        const job = (uploadingDoneCallback) => {

            if (timingMessage) console.time(timingMessage);

            TransferActions.connectAndUploadFile(fileName, address, sourceContainer, (err)=> {
                logger.error(err);
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

        debug(`adding job: connectAndDownloadFile: ${fileName}`);
        const job = (downloadingDoneCallback)=> {

            if (timingMessage) console.time(timingMessage);

            TransferActions.connectAndDownloadFile(fileName, address, destinationContainer, (err)=> {
                logger.error(err);
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

        debug(`adding job: listenAndUploadFile ${fileName}`);
        const job = (uploadingDoneCallback)=> {

            if (timingMessage) console.time(timingMessage);

            TransferActions.listenAndUploadFile(otherParty, fileName, host, sourceContainer, (err)=> {
                logger.error(err);
                if (timingMessage)console.timeEnd(timingMessage);

                uploadingDoneCallback()
            });

        };
        this.queue.push(job);
    }

    /**
     *
     * @param fileName
     * @param host
     * @param destinationContainer
     * @param doneCallback
     * @param listeningCallback
     */
    public  addListenAndDownloadJobToQueue(fileName:string,
                                           host:string,
                                           destinationContainer:FileContainer,
                                           doneCallback:(err:Error)=>any,
                                           listeningCallback:(address:{host:string,port:number})=>any) {

        debug(`adding job: listenAndDownloadFile - fileName: ${fileName} host: ${host}`);

        const timingMessage = `${this.name} - listening and downloading file: ${fileName}`;

        const job = (downloadingDoneCallback)=> {

            console.time(timingMessage);

            TransferActions.listenAndDownloadFile(fileName, host, destinationContainer, (err)=> {
                console.timeEnd(timingMessage);
                downloadingDoneCallback(err)
            },listeningCallback);
        };

        this.queue.push(job, doneCallback);
    }
}
