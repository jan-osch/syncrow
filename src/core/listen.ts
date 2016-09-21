import {FilterFunction} from "../fs_helpers/file_container";
import {Engine} from "./engine";
import {SyncAction} from "../sync/sync_actions";
import SListen from "../facade/listen";


/**
 * @param params
 * @param {EngineCallback} callback
 */
export default function startListeningEngine(params:{
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

    console.warn('This API is deprecated please use one from facade');

    const sListen = new SListen(params);

    sListen.start((err)=> {
        if (err)return callback(err);

        return callback(null, sListen.engine);
    })
}
