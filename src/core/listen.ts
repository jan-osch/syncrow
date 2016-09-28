import {FilterFunction} from "../fs_helpers/file_container";
import {SyncAction} from "../sync/sync_actions";
import SListen from "../facade/listen";
import {EngineCallback} from "../utils/interfaces";
import * as util from "util";


/**
 * @param params
 * @param {EngineCallback} callback
 */
export default util.deprecate(function (params:{
    path:string,
    localPort:number,
    externalHost:string,

    authTimeout?:number,
    filter?:FilterFunction
    initialToken?:string,
    authenticate?:boolean,
    sync?:SyncAction,
    watch?:boolean
}, callback:EngineCallback) {

    console.warn();

    const sListen = new SListen(params);

    sListen.start((err)=> {
        if (err)return callback(err);

        return callback(null, sListen.engine);
    })
}, 'This API is deprecated please use one from facade');
