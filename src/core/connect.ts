import {EngineCallback} from "./listen";
import {FilterFunction} from "../fs_helpers/file_container";
import {SyncAction} from "../sync/sync_actions";
import SConnect from "../facade/connect";

/**
 * @param params
 * @param callback
 */
export default function startConnectingEngine(params:{
    path:string,
    remotePort:number,
    remoteHost:string,

    authTimeout?:number,
    filter?:FilterFunction,
    initialToken?:string,
    authenticate?:boolean,
    sync?:SyncAction,
    retry?:{
        times:number,
        interval:number
    },
    watch?:boolean}, callback:EngineCallback) {

    console.warn('This API is deprecated please use one from facade');

    const sConnect = new SConnect(params);

    sConnect.start((err)=> {
        if (err)return callback(err);

        return callback(null, sConnect.engine);
    })
}