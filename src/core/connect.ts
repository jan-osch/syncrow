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

const debug = debugFor('syncrow:cr:connect');

export interface ConnectOptions {
    filter?:FilterFunction;
    initialToken?:string;
    authenticate?:boolean;
    sync?:SyncAction;
    retry?:{
        times:number,
        interval:number
    },
    watch?:boolean;
}

const AUTHORISATION_TIMEOUT = 10;


/**
 * @param {String} path
 * @param {Number} remotePort
 * @param {String} remoteHost
 * @param {ConnectOptions} options
 * @param {EngineCallback} callback
 */
export default function startConnectingEngine(path:string, remotePort:number, remoteHost:string, options:ConnectOptions, callback:EngineCallback) {
    const container = new FileContainer(path, {filter: options.filter});

    const connectionHelperEntry = new ConstantConnector(AUTHORISATION_TIMEOUT, remoteHost, remotePort, options.initialToken);

    const connectionHelperForTransfer = new DynamicConnector(AUTHORISATION_TIMEOUT);

    const transferHelper = new TransferHelper(container, connectionHelperForTransfer, {
        name: 'ConnectingEngine',
        preferConnecting: true
    });

    const engine = new Engine(container, transferHelper, {sync: options.sync});

    engine.on(Engine.events.shutdown, ()=> {
        connectionHelperForTransfer.shutdown();
        connectionHelperEntry.shutdown();
    });

    return async.waterfall(
        [
            (cb)=> {
                if (options.watch) return container.beginWatching(cb);
                setImmediate(cb);
            },

            (cb)=> {
                if (options.retry) {
                    return async.retry(options.retry,
                        (retryCallback)=>connectionHelperEntry.getNewSocket({}, retryCallback),
                        cb
                    );
                }

                return connectionHelperEntry.getNewSocket({}, cb)
            },


            (socket, cb)=> {
                const eventMessenger = new EventMessenger(socket);
                engine.addOtherPartyMessenger(eventMessenger);
                if (options.retry) {
                    connectAgainAfterPreviousDied(eventMessenger, engine, connectionHelperEntry);
                }
                return cb(null, engine);
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