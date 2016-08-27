import {TransferQueue} from "./transfer_queue";
import {CallbackHelper} from "../connection/callback_helper";
import {TransferActions} from "./transfer_actions";
import {loggerFor} from "../utils/logger";
import {EventMessenger} from "../connection/event_messenger";
import {ConnectionHelper, ConnectionAddress} from "../connection/connection_helper";
import {Container} from "../utils/interfaces";

const TRANSFER_CONCURRENCY = 500;

export interface TransferHelperOptions {
    transferQueueSize?:number,
    name:string,
    preferConnecting:boolean;

}

const logger = loggerFor('TransferHelper');

/**
 * Private commands
 */
interface TransferMessage {
    fileName:string;
    command:string;
    id?:string;
    address?:ConnectionAddress;
}

export class TransferHelper {

    static outerEvent = 'transferEvent';

    private queue:TransferQueue;
    private preferConnecting:boolean;
    private container:Container;
    private callbackHelper:CallbackHelper;

    constructor(container:Container, private connectionHelper:ConnectionHelper, options:TransferHelperOptions) {
        const queueSize = options.transferQueueSize ? options.transferQueueSize : TRANSFER_CONCURRENCY;

        this.queue = new TransferQueue(queueSize, options.name);
        this.preferConnecting = options.preferConnecting;
        this.container = container;
        this.callbackHelper = new CallbackHelper();
    }

    /**
     * Used to handle commands passed by caller
     * @param transferMessage
     * @param otherParty
     */
    public consumeMessage(transferMessage:TransferMessage, otherParty:EventMessenger) {
        if (transferMessage.command === TransferActions.events.connectAndUpload) {
            this.queue.addConnectAndUploadJobToQueue(
                transferMessage.fileName,
                transferMessage.address,
                this.container,
                this.connectionHelper,
                this.getCallbackForIdOrErrorLogger(transferMessage.id)
            );

        } else if (transferMessage.command === TransferActions.events.connectAndDownload) {
            this.queue.addConnectAndDownloadJobToQueue(
                transferMessage.fileName,
                transferMessage.address,
                this.container,
                this.connectionHelper,
                this.getCallbackForIdOrErrorLogger(transferMessage.id)
            );

        } else if (transferMessage.command === TransferActions.events.listenAndDownload) {
            return this.getFileViaListening(transferMessage.fileName, otherParty, {id: transferMessage.id});

        } else if (transferMessage.command === TransferActions.events.listenAndUpload) {
            return this.sendFileViaListening(transferMessage.fileName, otherParty, {id: transferMessage.id});
        }
    }

    /**
     * Downloads a file from remote
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public getFileFromRemote(otherParty:EventMessenger, fileName:string, callback:ErrorCallback) {

        if (this.preferConnecting) {
            const id = this.callbackHelper.addCallback(callback);

            const message:TransferMessage = {
                fileName: fileName,
                id: id,
                command: TransferActions.events.listenAndUpload
            };

            return otherParty.send(TransferHelper.outerEvent, message);
        }

        return this.getFileViaListening(fileName, otherParty, {callback: callback});
    }

    /**
     * Uploads a file to remote
     * @param otherParty
     * @param fileName
     * @param callback
     */
    public sendFileToRemote(otherParty:EventMessenger, fileName:string, callback:ErrorCallback) {

        if (this.preferConnecting) {
            const id = this.callbackHelper.addCallback(callback);

            const message:TransferMessage = {
                command: TransferActions.events.listenAndDownload,
                id: id,
                fileName: fileName
            };

            return otherParty.send(TransferHelper.outerEvent, message);
        }

        return this.sendFileViaListening(fileName, otherParty, {callback: callback});
    }

    private sendFileViaListening(fileName:string, remote:EventMessenger, optional:{id ?:string, callback?:ErrorCallback }) {
        this.queue.addListenAndUploadJobToQueue(
            fileName,
            this.container,
            this.connectionHelper,

            (address)=> {
                const message:TransferMessage = {
                    fileName: fileName,
                    command: TransferActions.events.connectAndDownload,
                    address: address,
                    id: optional.id
                };

                remote.send(TransferHelper.outerEvent, message);
            },

            optional.callback
        );
    }


    private getFileViaListening(fileName:string, remote:EventMessenger, optional:{id?:string, callback?:ErrorCallback}) {
        this.queue.addListenAndDownloadJobToQueue(
            fileName,
            this.container,
            this.connectionHelper,

            (address)=> {
                const message:TransferMessage = {
                    fileName: fileName,
                    command: TransferActions.events.connectAndUpload,
                    address: address,
                    id: optional.id
                };

                remote.send(TransferHelper.outerEvent, message);
            },

            optional.callback
        );
    }

    private getCallbackForIdOrErrorLogger(id?:string):ErrorCallback {
        if (id) return <ErrorCallback> this.callbackHelper.getCallback(id);

        return (err)=> {
            logger.error(err)
        }
    }
}