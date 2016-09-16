import {EngineCallback} from "./listen";
import {FileContainer, FilterFunction} from "../fs_helpers/file_container";
import {ConnectionHelper} from "../connection/connection_helper";
import {TransferHelper} from "../transport/transfer_helper";
import {Engine} from "./engine";
import {SyncAction} from "../sync/sync_actions";
import {EventMessenger} from "../connection/event_messenger";
import * as async from "async";
import {debugFor} from "../utils/logger";
import ConstantConnector from "../connection/constant_connector";
import DynamicConnector from "../connection/dynamic_connector";

const debug = debugFor('syncrow:core:connect');

const AUTH_TIMEOUT = 10;

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

    const authTimeout = params.authTimeout ? params.authTimeout : AUTH_TIMEOUT;

    const container = new FileContainer(params.path, {filter: params.filter});

    const connectionHelperEntry = new ConstantConnector(authTimeout,
        params.remoteHost,
        params.remotePort,
        params.initialToken);

    const connectionHelperForTransfer = new DynamicConnector(authTimeout);

    const transferHelper = new TransferHelper(container, connectionHelperForTransfer, {
        name: 'ConnectingEngine',
        preferConnecting: true
    });

    const engine = new Engine(container, transferHelper, {sync: params.sync});

    engine.on(Engine.events.shutdown, ()=> {
        connectionHelperForTransfer.shutdown();
        connectionHelperEntry.shutdown();
    });

    debug(`starting the connect flow`);

    return async.waterfall(
        [
            (cb)=> {
                if (params.watch) return container.beginWatching(cb);

                return setImmediate(cb);
            },

            (cb)=> {
                if (params.retry) {
                    return async.retry(params.retry,
                        (retryCallback)=>connectionHelperEntry.getNewSocket({}, retryCallback),
                        cb
                    );
                }

                return connectionHelperEntry.getNewSocket({}, cb)
            },


            (socket, cb)=> {
                debug(`initial connection obtained`);

                const eventMessenger = new EventMessenger(socket);
                engine.addOtherPartyMessenger(eventMessenger);

                if (params.retry) {
                    connectAgainAfterPreviousDied(eventMessenger, engine, connectionHelperEntry);
                }

                return setImmediate(cb, null, engine);
            }
        ],
        callback
    );
}

function connectAgainAfterPreviousDied(previousMessenger:EventMessenger, engine:Engine, connectionHelper:ConnectionHelper) {
    return previousMessenger.once(EventMessenger.events.died, ()=> {

            debug(`obtaining new socket`);

            return connectionHelper.getNewSocket({}, (err, socket)=> {
                    if (err) {
                        return engine.emit(Engine.events.error, err);
                    }

                    const eventMessenger = new EventMessenger(socket);
                    engine.addOtherPartyMessenger(eventMessenger);

                    connectAgainAfterPreviousDied(eventMessenger, engine, connectionHelper);
                }
            )
        }
    )
}