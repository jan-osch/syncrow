import {TransferQueue} from "./transfer_queue";
import {Messenger} from "../connection/messenger";
import {FileContainer} from "../fs_helpers/file_container";
import {CallbackHelper} from "./callback_helper";
import {TransferActions} from "./transfer_actions";
import {EventsHelper} from "../client/events_helper";
/**
 * Created by Janusz on 14.06.2016.
 */


export interface TransferHelperOptions {
    transferQueueSize?:number,
    name:string,
    preferConnecting:boolean;
}

const callbackHelper = CallbackHelper.getInstance();

interface FirstStep {
    fileName:string,
    command:string,
    id:string
    port?:number,
    host?:string
}
interface SecondStep {
    fileName:string,
    command:string,
    id:string
    port?:number,
    host?:string
}

export class TransferHelper {

    static outerEvent = 'transferEvent';

    private static innerEvents = {
        firstStep: 'firstStep',
        secondStep: 'secondStep'
    };


    private queue:TransferQueue;
    private preferConnecting:boolean;

    constructor(options:TransferHelperOptions) {
        const queueSize = options.transferQueueSize ? options.transferQueueSize : 10;
        this.queue = new TransferQueue(queueSize, options.name);
        this.preferConnecting = options.preferConnecting;
    }

    public consumeEvent(transferEvent) {

    }

    public sendFileToRemote(otherParty:Messenger, sourceContainer:FileContainer, fileName:string, callback:Function, sendReport:boolean) {
        const id = callbackHelper.addCallback(callback);

        if (this.preferConnecting) {
            const firstStep:FirstStep = {
                fileName: fileName,
                id: id,
                command: TransferActions.events.listenAndDownload
            };

            return EventsHelper.sendEvent(otherParty, TransferHelper.outerEvent, firstStep);
        }

        this.queue.addListenAndUploadJobToQueue(fileName, otherParty.getOwnHost(), sourceContainer, (address)=> {
            const firstStep:FirstStep = {
                fileName: fileName,
                id: id,
                command: TransferActions.events.connectAndDownload,
                host: address.host,
                port: address.port
            };

            EventsHelper.sendEvent(otherParty, TransferHelper.outerEvent, firstStep);
        }, (err)=> {
            callbackHelper.deleteMapping(id);
            callback(err);
        });
    }

    public getFileFromRemote(otherParty:Messenger, destinationContainer:FileContainer, fileName:string, callback:Function) {

    }


}