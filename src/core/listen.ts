import {FilterFunction, FileContainer} from "../fs_helpers/file_container";
import {ConnectionHelper} from "../connection/connection_helper";
import {TransferHelper} from "../transport/transfer_helper";
import {Engine} from "./engine";
import {SyncAction} from "../sync/sync_actions";
import {EventMessenger} from "../connection/event_messenger";
import * as async from "async";
import ConstantServer from "../connection/constant_server";
import DynamicServer from "../connection/dynamic_server";
import {debugFor} from "../utils/logger";

export interface EngineCallback {
    (err:Error, engine?:Engine):any
}

const debug = debugFor('syncrow:core:listen');
const AUTH_TIMEOUT = 100;

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

    const authTimeout = params.authTimeout ? params.authTimeout : AUTH_TIMEOUT;

    const container = new FileContainer(params.path, {filter: params.filter});

    const connectionHelperEntry = new ConstantServer(params.localPort,
        {
            authTimeout: authTimeout,
            constantToken: params.initialToken
        }
    );

    const connectionHelperForTransfer = new DynamicServer({
            authTimeout: authTimeout,
            generateToken: params.authenticate
        },
        params.externalHost
    );

    const transferHelper = new TransferHelper(
        container,
        connectionHelperForTransfer,
        {
            name: 'ListeningEngine',
            preferConnecting: false
        }
    );

    const engine = new Engine(container, transferHelper, {sync: params.sync});

    engine.on(Engine.events.shutdown, ()=> {
        connectionHelperForTransfer.shutdown();
        connectionHelperEntry.shutdown();
    });

    return async.waterfall(
        [
            (cb)=> {
                if (params.watch)return container.beginWatching(cb);
                return cb();
            },

            (cb)=>connectionHelperEntry.listen(cb)
        ],

        (err:Error)=> {
            if (err) return callback(err);

            listenForMultipleConnections(engine, connectionHelperEntry);
            return callback(null, engine);
        }
    )
}

function listenForMultipleConnections(engine:Engine, helper:ConnectionHelper) {
    return async.whilst(
        ()=>true,

        (cb)=> {
            return helper.getNewSocket({}, (err, socket)=> {
                if (err) {
                    engine.emit(Engine.events.error, err);
                    return cb();
                }

                engine.addOtherPartyMessenger(new EventMessenger(socket));
                return cb();
            })
        },

        (err)=> {
            console.log('HHHHHHERER')
            if (err) engine.emit(Engine.events.error, err);
        }
    )
}
