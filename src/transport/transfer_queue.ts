/// <reference path="../../typings/main.d.ts" />

import {Messenger} from "./messenger";
import {FileContainer} from "../fs_helpers/file_container";
import {TransferActions} from "./transfer_actions";
import * as async from "async";
import * as debugFor from "debug";
import {loggerFor} from "../utils/logger";

const debug = debugFor("syncrow:trasfer_queue");
const logger = loggerFor('TransferQueue');

export class TransferQueue {

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

        debug(`adding job: connectAndUploadFile`);
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

        debug(`addingjob: connectAndDownloadFile`);
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

        debug(`adding job: listenAndUploadFile`);
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

        debug(`adding job: listenAndDownloadFile - fileName: ${fileName} host: ${host}`);
        const job = (downloadingDoneCallback)=> {

            if (timingMessage) console.time(timingMessage);

            TransferActions.listenAndDownloadFile(otherParty, fileName, host, destinationContainer, (err)=> {
                logger.error(err);
                if (timingMessage)console.timeEnd(timingMessage);

                downloadingDoneCallback()
            });

        };
        this.queue.push(job, callback);
    }
}
