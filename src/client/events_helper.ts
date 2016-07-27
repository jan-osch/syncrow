// import {Messenger} from "../connection/messenger";
// import {debugFor} from "../utils/logger";
// import {EventEmitter} from "events";
//
// const debug = debugFor('syncrow:events');
//
// export interface Event {
//     type:string,
//     body?:any
// }
//
// export class EventsHelper extends EventEmitter {
//
//     static events = {
//         error: 'error'
//     };
//
//     constructor(public messenger:Messenger) {
//         super();
//         this.messenger.on(Messenger.events.message, (rawMessage)=>this.parseAndEmit(rawMessage));
//     }
//
//     /**
//      * @param type
//      * @param body
//      * @returns {string}
//      */
//     public static createEvent(type:string, body = {}):string {
//         return JSON.stringify({
//             type: type,
//             body: body,
//         });
//     }
//
//     /**
//      * Parses event and if error occurs, notifies the other party
//      * @param otherParty
//      * @param message
//      * @returns {Event}
//      */
//     public static parseEvent(otherParty:Messenger, message:string):Event {
//         try {
//             return JSON.parse(message.toString());
//         } catch (e) {
//             debug(`Sending error: exception during parsing message: ${message}`);
//             EventsHelper.sendEvent(otherParty, EventsHelper.events.error, {title: 'Bad event', details: message});
//         }
//     }
//
//     /**
//      * @param otherParty
//      * @param type
//      * @param message
//      */
//     public static sendEvent(otherParty:Messenger, type:string, message?:any) {
//         const event = EventsHelper.createEvent(type, message);
//         debug(`writing event: ${event}`);
//         otherParty.writeMessage(event);
//     }
//
//     /**
//      * Convenience method
//      * @param type
//      * @param message
//      */
//     public send(type:string, message?:any) {
//         EventsHelper.sendEvent(this.messenger, type, message)
//     }
//
//     private parseAndEmit(rawMessage:string) {
//         const event = EventsHelper.parseEvent(this.messenger, rawMessage);
//
//         if (this.listenerCount(event.type) == 0) {
//             return this.emit(EventsHelper.events.error, {title: `Unknown event type: ${event.type}`, details: event})
//         }
//
//         return this.emit(event.type, event);
//     }
// }