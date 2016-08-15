import {SyncAction} from "../sync/sync_actions";
import {FilterFunction} from "../fs_helpers/file_container";

export interface ProgramOptions {
    listen?:boolean;

    remoteHost?:string;
    remotePort?:number;

    localPort?:number;
    externalHost?:string;

    sync?:SyncAction;
    rawStrategy?:string

    filter?:FilterFunction;
    rawFilter?:Array<string>;


    initialToken?:string;

    deleteLocal?:boolean;

    deleteRemote?:boolean;

    authenticate?:boolean;
    reconnect?:boolean;

    times?:number;

    interval?:number;

    watch?:boolean
}


export const configurationFileName = '.syncrow.json';
