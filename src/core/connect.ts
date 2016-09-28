import {EngineCallback} from "./listen";
import {FilterFunction} from "../fs_helpers/file_container";
import {SyncAction} from "../sync/sync_actions";
import SConnect from "../facade/connect";
import * as util from "util";

/**
 * @param params
 * @param callback
 */
export default util.deprecate(function startConnectingEngine(params:{
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


    const sConnect = new SConnect(params);

    sConnect.start((err)=> {
        if (err)return callback(err);

        return callback(null, sConnect.engine);
    })
}, 'This API is deprecated please connect.js from facade');