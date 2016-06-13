/// <reference path="../../typings/main.d.ts" />
import {Messenger} from "../connection/messenger";
import {debugFor} from "../utils/logger";
import {Event, eventTypes, Pull, Offer} from "./events";
import {TransferActions} from "../transport/transfer_actions";

const debug = debugFor('syncrow:events');

//TODO change this class to Event - allow static creation
export class EventsHelper {

    static events = {
        error: 'error'
    };

    /**
     * @param type
     * @param body
     * @param id
     * @returns {string}
     */
    public static createEvent(type:string, body = {}, id?:number):string {
        return JSON.stringify({
            type: type,
            body: body,
            id: id
        });
    }

    /**
     * Parses event and if error occurs, notifies the other party
     * @param otherParty
     * @param message
     * @returns {any}
     */
    public static parseEvent(otherParty:Messenger, message:string):Event {
        try {
            return JSON.parse(message.toString());
        } catch (e) {
            EventsHelper.sendEvent(otherParty, EventsHelper.events.error, 'bad event');
        }
    }

    /**
     * @param otherParty
     * @param type
     * @param message
     * @param id
     */
    public static sendEvent(otherParty:Messenger, type:string, message?:any, id?:number) {
        const event = EventsHelper.createEvent(type, message, id);
        debug(`writing event: ${event}`);
        otherParty.writeMessage(event);
    }

    /**
     * New method for better sending
     * @param otherParty
     * @param event
     */
    public static sendEventTwo(otherParty:Messenger, event:Object) {
        debug(`writing event: ${event}`);
        otherParty.writeMessage(JSON.stringify(event));
    }


    public static getNewPull(fileName:string, id:string):Pull {
        return {
            type: eventTypes.pull,
            fileName: fileName,
            id: id
        };
    }

    public static getNewOffer(fileName:string, id:string):Offer {
        return {
            type: eventTypes.offer,
            fileName: fileName,
            id: id
        };
    }

    public static getNewPullResponse(fileName:string, id:string, command?:string, host?:string, port?:number) {
        if (command !== TransferActions.events.connectAndDownload || command !== TransferActions.events.listenAndDownload) {
            throw  new Error('Invalid command type');
        }
        if (command === TransferActions.events.connectAndDownload && !host || !port) {
            throw new Error('Missing port or host for connection');
        }

        return {
            type: eventTypes.pullResponse,
            command: command,
            host: host,
            port: port
        }
    }

    public getNewReadyForTransfer(fileName:string, id:string, host:string, port:number){
        return{
            type:eventTypes.readyForTransfer,
            command: TransferActions.events.connectAndDownload
        }
    }

}


export interface PullResponse extends Event {
    fileName:string,
    command:string,
    host?:string
    port?:number
    id:string
}

export interface ReadyForTransfer extends Event {
    fileName:string,
    command:string,
    host?:string
    port?:number
    id:string
}

export interface TransferStatus extends Event {
    fileName:string,
    id:string
    success:boolean
    message?:string
}
