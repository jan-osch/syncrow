import {TransferQueue} from "./transfer_queue";
import {Messenger} from "../connection/messenger";
import {FileContainer} from "../fs_helpers/file_container";
import {CallbackHelper} from "./callback_helper";
import {TransferActions} from "./transfer_actions";
import {EventsHelper} from "../client/events_helper";
import {loggerFor} from "../utils/logger";
/**
 * Created by Janusz on 14.06.2016.
 */


export interface TransferHelperOptions {
    transferQueueSize?:number,
    name:string,
    preferConnecting:boolean;
}

const callbackHelper = CallbackHelper.getInstance();
const logger = loggerFor('TransferHelper');

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
        const queueSize = options.transferQueueSize ? options.transferQueueSize : 10; //TODO
        this.queue = new TransferQueue(queueSize, options.name);
        this.preferConnecting = options.preferConnecting;
        this.container = container;
    }

    public consumeMessage(transferMessage:TransferMessage) {
        if (transferMessage.command === TransferActions.events.connectAndUpload) {
            this.queue.addConnectAndUploadJobToQueue(transferMessage.fileName, {
                    host: transferMessage.host,
                    port: transferMessage.port
                },
                this.getCallbackForIdOrErrorLogger(transferMessage.id));

        } else if (transferMessage.command === TransferActions.events.connectAndDownload) {
            this.transferJobsQueue.addConnectAndDownloadJobToQueue(transferMessage.address, transferMessage.fileName,
                this.fileContainer, `client - downloading: ${transferMessage.fileName}`);
            return true;
            //TODO FILE_REQUEST_CALLBACK_STRATEGY - here after download is complete check callbaks in callback helper

        } else if (transferMessage.command === TransferActions.events.listenAndDownload) {
            this.transferJobsQueue.addListenAndDownloadJobToQueue(otherParty, transferMessage.fileName,
                otherParty.getOwnHost(), this.fileContainer, `client - downloading: ${transferMessage.fileName}`);
            return true;
            //TODO FILE_REQUEST_CALLBACK_STRATEGY - here after download is complete check callbacks

        } else if (transferMessage.command === TransferActions.events.listenAndUpload) {
            this.transferJobsQueue.addListenAndUploadJobToQueue(transferMessage.fileName, otherParty,
                this.otherParty.getOwnHost(), this.fileContainer, `client - uploading: ${transferMessage.fileName}`);
            return true;

        }
        return false;
    }

    public sendFileToRemote(otherParty:Messenger, fileName:string, callback:(err:Error)=>any) {

        if (this.preferConnecting) {
            const id = callbackHelper.addCallback(callback);
            const message:TransferMessage = {
                command: TransferActions.events.listenAndDownload,
                id: id,
                fileName: fileName
            };
            return EventsHelper.sendEvent(otherParty, TransferHelper.outerEvent, message);
        }

        this.queue.addListenAndUploadJobToQueue(fileName, otherParty.getOwnHost(), this.container, (address)=> {
            const message:TransferMessage = {
                fileName: fileName,
                command: TransferActions.events.connectAndDownload,
                host: address.host,
                port: address.port
            };

            EventsHelper.sendEvent(otherParty, TransferHelper.outerEvent, message);
        }, callback);
    }

    public getFileFromRemote(otherParty:Messenger, fileName:string, callback:(err:Error)=>any) {

        if (this.preferConnecting) {
            const id = callbackHelper.addCallback(callback);

            const message:TransferMessage = {
                fileName: fileName,
                id: id,
                command: TransferActions.events.listenAndUpload
            };

            return EventsHelper.sendEvent(otherParty, TransferHelper.outerEvent, message);
        }

        this.queue.addListenAndDownloadJobToQueue(fileName, otherParty.getOwnHost(), this.container, (address)=> {
            const message:TransferMessage = {
                fileName: fileName,
                command: TransferActions.events.connectAndUpload,
                host: address.host,
                port: address.port
            };

            EventsHelper.sendEvent(otherParty, TransferHelper.outerEvent, message);
        }, callback);
    }

    private getCallbackForIdOrErrorLogger(id:string) {
        if (id) return callbackHelper.retriveCallback(id);

        return (err)=> {
            logger.error(err)
        }
    }
}