import {SyncAction} from "../sync/sync_actions";
import {FilterFunction} from "../fs_helpers/file_container";


export interface ProgramOptions {
    type?:string;
    remoteHost?:string;
    remotePort?:number;
    localPort?:number;
    externalHost?:string;
    strategy?:SyncAction;
    rawStrategy?:string
    filter?:FilterFunction;
    rawFilter?:Array<string>;
    listen?:boolean;
    initialToken?:string;
    listenForMultiple?:boolean;
    abort?:boolean; //abort listening if client disconnects
    deleteLocalFiles?:boolean;
    deleteRemoteFiles?:boolean;
    skipWatching?:boolean;
    authenticate?:boolean;
    reconnect?:boolean;
    times?:number;
    interval?:number;
}

export const ProgramTypes = {
    server: 'server',
    clientListening: 'clientListening',
    clientConnecting: 'clientConnecting'
};
