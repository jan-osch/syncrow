import {TransferQueue} from "./transfer_queue";
import {FileContainer} from "../fs_helpers/file_container";
import {CallbackHelper} from "./callback_helper";
import {TransferActions} from "./transfer_actions";
import {loggerFor} from "../utils/logger";
import config from "../configuration";
import {ErrBack} from "../utils/interfaces";
import {EventMessenger} from "../connection/evented_messenger";

export interface TransferHelperOptions {
    transferQueueSize?:number,
    name:string,
    preferConnecting:boolean;
}

const callbackHelper = CallbackHelper.getInstance();
const logger = loggerFor('TransferHelper');

/**
 * Private events
 */
interface TransferMessage {
    fileName:string,
    command:string,
    id?:string
    port?:number,
    host?:string
}

export class TransferHelper {

    static outerEvent = 'transferEvent';

    private queue:TransferQueue;
    private preferConnecting:boolean;
    private container:FileContainer;

    constructor(container:FileContainer, options:TransferHelperOptions) {
        const queueSize = options.transferQueueSize ? options.transferQueueSize : config.transferHelper.transferQueueSize;

        this.queue = new TransferQueue(queueSize, options.name);
        this.preferConnecting = options.preferConnecting;
        this.container = container;
    }

    /**
     * Used to handle events passed by caller
     * @param transferMessage
     * @param otherParty
     */
    public consumeMessage(transferMessage:TransferMessage, otherParty:EventMessenger) {
        if (transferMessage.command === TransferActions.events.connectAndUpload) {
            this.queue.addConnectAndUploadJobToQueue(
                transferMessage.fileName,
                {
                    host: transferMessage.host,
                    port: transferMessage.port
                },
                this.container,
                this.getCallbackForIdOrErrorLogger(transferMessage.id)
            );

        } else if (transferMessage.command === TransferActions.events.connectAndDownload) {
            this.queue.addConnectAndDownloadJobToQueue(
                transferMessage.fileName,
                {
                    host: transferMessage.host,
                    port: transferMessage.port
                },
                this.container,
                this.getCallbackForIdOrErrorLogger(transferMessage.id)
            );

        } else if (transferMessage.command === TransferActions.events.listenAndDownload) {
            return this.sendFileViaListening(transferMessage.fileName, otherParty, {id: transferMessage.id});

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
    public getFileFromRemote(otherParty:EventMessenger, fileName:string, callback:ErrBack) {

        if (this.preferConnecting) {
            const id = callbackHelper.addCallback(callback);

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
    public sendFileToRemote(otherParty:EventMessenger, fileName:string, callback:ErrBack) {

        if (this.preferConnecting) {
            const id = callbackHelper.addCallback(callback);

            const message:TransferMessage = {
                command: TransferActions.events.listenAndDownload,
                id: id,
                fileName: fileName
            };

            return otherParty.send(TransferHelper.outerEvent, message);
        }

        return this.sendFileViaListening(fileName, otherParty, {callback: callback});
    }

    private sendFileViaListening(fileName:string, remote:EventMessenger, optional:{id ?:string, callback?:ErrBack }) {
        this.queue.addListenAndUploadJobToQueue(
            fileName,
            remote.getOwnHost(),
            this.container,

            (address)=> {
                const message:TransferMessage = {
                    fileName: fileName,
                    command: TransferActions.events.connectAndDownload,
                    host: address.host,
                    port: address.port,
                    id: optional.id
                };

                remote.send(TransferHelper.outerEvent, message);
            },

            optional.callback
        );
    }


    private getFileViaListening(fileName:string, remote:EventMessenger, optional:{id?:string, callback?:ErrBack}) {
        this.queue.addListenAndDownloadJobToQueue(
            fileName,
            remote.getOwnHost(),
            this.container,

            (address)=> {
                const message:TransferMessage = {
                    fileName: fileName,
                    command: TransferActions.events.connectAndUpload,
                    host: address.host,
                    port: address.port,
                    id: optional.id
                };

                remote.send(TransferHelper.outerEvent, message);
            },

            optional.callback
        );
    }

    private getCallbackForIdOrErrorLogger(id?:string):ErrBack {
        if (id) return <ErrBack> callbackHelper.getCallback(id);

        return (err)=> {
            logger.error(err)
        }
    }
}