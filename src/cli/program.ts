import {SyncAction} from "../sync/sync_actions";
import {FilterFunction} from "../fs_helpers/file_container";

export interface ProgramOptions {
    path:string; //path to watch
    listen?:boolean; //Listen or connect

    /**
     * For connecting
     */
    remoteHost?:string;
    remotePort?:number;


    /**
     * For listening
     */
    localPort?:number;
    externalHost?:string;//This should be external IP/domain hostname


    sync?:SyncAction; //Action that will be taken on each new connection
    rawStrategy?:string //string code that denotes each action
    deleteLocal?:boolean; //Flag tor SyncAction - will delete local files when they are missing remotely
    deleteRemote?:boolean; //Flag for SyncAction - will delete remote files when they are missing locally

    filter?:FilterFunction; //function that will filter out files that should not be watched/transferred
    rawFilter?:Array<string>; //Array of anymatch patterns that will construct filter

    initialToken?:string; //Token for first connection
    authenticate?:boolean; //flag that will enable authentication of all sockets

    /**
     * Reconnect params
     */
    reconnect?:boolean;
    times?:number;
    interval?:number;


    watch?:boolean //Watch local filesystem
}

export const configurationFileName = '.syncrow.json';
