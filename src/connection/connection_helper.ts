import {Socket} from "net";
import {Closable} from "../utils/interfaces";

export interface ConnectionAddress {
    remotePort:number;
    remoteHost:string;
    token?:string;
}

export interface ListenCallback {
    (address:ConnectionAddress):any;
}

export interface SocketCallback {
    (err:Error, socket?:Socket):any;
}

export interface ConnectionHelper extends Closable {
    getNewSocket(params:ConnectionHelperParams, callback:SocketCallback):any;
}

export interface ConnectionHelperParams {
    remotePort?:number;
    remoteHost?:string;
    localHost?:string;
    localPort?:number;
    token?:string;
    listenCallback?:ListenCallback;
}