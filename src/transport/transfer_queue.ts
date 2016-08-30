import {TransferActions} from "./transfer_actions";
import * as async from "async";
import * as debugFor from "debug";
import {ConnectionAddress, ConnectionHelper, ListenCallback} from "../connection/connection_helper";
import {Container} from "../utils/interfaces";

const debug = debugFor("syncrow:trasfer_queue");

export class TransferQueue {

    private queue:AsyncQueue<Function>;
    private name:string;

    constructor(concurrency:number, name:string = '') {
        this.queue = async.queue((job:Function, callback:Function)=>job(callback), concurrency);
        this.name = name;
    }

    /**
     * @param fileName
     * @param address
     * @param sourceContainer
     * @param connectionHelper
     * @param doneCallback
     */
    public addConnectAndUploadJobToQueue(fileName:string,
                                         address:ConnectionAddress,
                                         sourceContainer:Container,
                                         connectionHelper:ConnectionHelper,
                                         doneCallback:ErrorCallback) {
        const timingMessage = `${this.name} - connecting and uploading file: ${fileName}`;
        debug(`adding job: connectAndUploadFile: ${fileName}`);
        const job = (uploadingDoneCallback) => {

            console.time(timingMessage);

            return TransferActions.connectAndUploadFile(fileName, address, sourceContainer, connectionHelper,
                (err)=> {
                    console.timeEnd(timingMessage);

                    return uploadingDoneCallback(err)
                }
            );
        };

        this.queue.push(job, doneCallback);
    }

    /**
     *
     * @param address
     * @param fileName
     * @param destinationContainer
     * @param connectionHelper
     * @param doneCallback
     */
    public addConnectAndDownloadJobToQueue(fileName:string,
                                           address:ConnectionAddress,
                                           destinationContainer:Container,
                                           connectionHelper:ConnectionHelper,
                                           doneCallback?:ErrorCallback) {

        debug(`adding job: connectAndDownloadFile: ${fileName}`);

        const timingMessage = `${this.name} - connecting and downloading file: ${fileName}`;

        const job = (downloadingDoneCallback)=> {

            console.time(timingMessage);

            return TransferActions.connectAndDownloadFile(fileName, address, destinationContainer, connectionHelper,
                (err)=> {
                    console.timeEnd(timingMessage);

                    return downloadingDoneCallback(err);
                }
            );
        };

        this.queue.push(job, doneCallback);
    }

    /**
     *
     * @param fileName
     * @param sourceContainer
     * @param connectionHelper
     * @param listeningCallback
     * @param doneCallback
     */
    public  addListenAndUploadJobToQueue(fileName:string,
                                         sourceContainer:Container,
                                         connectionHelper:ConnectionHelper,
                                         listeningCallback:ListenCallback,
                                         doneCallback:ErrorCallback) {

        const timingMessage = `${this.name} - listening and uploading file: ${fileName}`;
        debug(`adding job: listenAndUploadFile ${fileName}`);

        const job = (uploadingDoneCallback)=> {

            console.time(timingMessage);

            return TransferActions.listenAndUploadFile(fileName, sourceContainer, connectionHelper,
                (err)=> {
                    console.timeEnd(timingMessage);

                    return uploadingDoneCallback(err)
                },
                listeningCallback
            );

        };

        this.queue.push(job, doneCallback);
    }

    /**
     *
     * @param fileName
     * @param destinationContainer
     * @param connectionHelper
     * @param doneCallback
     * @param listeningCallback
     */
    public  addListenAndDownloadJobToQueue(fileName:string,
                                           destinationContainer:Container,
                                           connectionHelper:ConnectionHelper,
                                           listeningCallback:ListenCallback,
                                           doneCallback:ErrorCallback) {

        debug(`adding job: listenAndDownloadFile - fileName: ${fileName}`);

        const timingMessage = `${this.name} - listening and downloading file: ${fileName}`;

        const job = (downloadingDoneCallback)=> {

            console.time(timingMessage);

            return TransferActions.listenAndDownloadFile(fileName, destinationContainer, connectionHelper,

                (err)=> {
                    console.timeEnd(timingMessage);
                    return downloadingDoneCallback(err)
                },

                listeningCallback
            );
        };

        return this.queue.push(job, doneCallback);
    }
}
