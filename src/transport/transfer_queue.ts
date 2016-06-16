/// <reference path="../../typings/main.d.ts" />

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

    constructor(concurrency:number, name:string = '') {
        this.queue = async.queue((job:Function, callback:Function)=>job(callback), concurrency);
        this.name = name;
    }

    /**
     * @param fileName
     * @param address
     * @param sourceContainer
     * @param doneCallback
     */
    public addConnectAndUploadJobToQueue(fileName:string,
                                         address:{port:number, host:string},
                                         sourceContainer:FileContainer,
                                         doneCallback) {
        const timingMessage = `${this.name} - connecting and uploading file: ${fileName}`;
        debug(`adding job: connectAndUploadFile: ${fileName}`);
        const job = (uploadingDoneCallback) => {

            console.time(timingMessage);

            TransferActions.connectAndUploadFile(fileName, address, sourceContainer, (err)=> {
                console.timeEnd(timingMessage);

                uploadingDoneCallback(err)
            });
        };

        this.queue.push(job, doneCallback);
    }

    /**
     *
     * @param address
     * @param fileName
     * @param destinationContainer
     * @param doneCallback
     */
    public addConnectAndDownloadJobToQueue(fileName:string,
                                           address:{port:number, host:string},
                                           destinationContainer:FileContainer,
                                           doneCallback?:(err:Error)=>any) {
        debug(`adding job: connectAndDownloadFile: ${fileName}`);

        const timingMessage = `${this.name} - connecting and downloading file: ${fileName}`;

        const job = (downloadingDoneCallback)=> {

            console.time(timingMessage);

            TransferActions.connectAndDownloadFile(fileName, address, destinationContainer, (err)=> {
                console.timeEnd(timingMessage);

                downloadingDoneCallback(err);
            });
        };

        this.queue.push(job, doneCallback);
    }

    /**
     *
     * @param fileName
     * @param host
     * @param sourceContainer
     * @param listeningCallback
     * @param doneCallback
     */
    public  addListenAndUploadJobToQueue(fileName:string,
                                         host:string,
                                         sourceContainer:FileContainer,
                                         listeningCallback:(address:{host:string,port:number})=>any,
                                         doneCallback:(err:Error)=>any) {

        const timingMessage = `${this.name} - listening and uploading file: ${fileName}`;
        debug(`adding job: listenAndUploadFile ${fileName}`);
        const job = (uploadingDoneCallback)=> {

            console.time(timingMessage);

            TransferActions.listenAndUploadFile(fileName, host, sourceContainer, (err)=> {
                console.timeEnd(timingMessage);

                uploadingDoneCallback(err)
            }, listeningCallback);

        };
        this.queue.push(job, doneCallback);
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
                                           listeningCallback:(address:{host:string,port:number})=>any,
                                           doneCallback:(err:Error)=>any) {

        debug(`adding job: listenAndDownloadFile - fileName: ${fileName} host: ${host}`);

        const timingMessage = `${this.name} - listening and downloading file: ${fileName}`;

        const job = (downloadingDoneCallback)=> {

            console.time(timingMessage);

            TransferActions.listenAndDownloadFile(fileName, host, destinationContainer, (err)=> {
                console.timeEnd(timingMessage);
                downloadingDoneCallback(err)
            }, listeningCallback);
        };

        this.queue.push(job, doneCallback);
    }
}
