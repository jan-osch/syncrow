import {EngineCallback} from "./listen";
import {FileContainer, FilterFunction} from "../fs_helpers/file_container";
import {ConnectionHelper} from "../connection/connection_helper";
import {TransferHelper} from "../transport/transfer_helper";
import {Engine} from "../client/engine";
import {SyncAction} from "../sync/sync_actions";
import {EventMessenger} from "../connection/event_messenger";
import * as async from "async";
import {debugFor} from "./logger";

const debug = debugFor('syncrow:connect');

export interface ConnectOptions {
    filter?:FilterFunction;
    initialToken?:string;
    authenticate?:boolean;
    sync?:SyncAction;
    times?:number;
    interval?:number;
    watch?:boolean;
}

/**
 * @param {Number} remotePort
 * @param {String} remoteHost
 * @param {String} path
 * @param {ConnectOptions} options
 * @param {EngineCallback} callback
 */
export default function startConnectingEngine(remotePort:number, remoteHost:string, path:string, options:ConnectOptions, callback:EngineCallback) {
    const container = new FileContainer(path, {filter: options.filter});

    const connectionHelperEntry = new ConnectionHelper({
        remotePort: remotePort,
        remoteHost: remoteHost,
        listen: false,
        token: options.initialToken,
        interval: options.interval,
        times: options.times,
    });

    const connectionHelperForTransfer = new ConnectionHelper({
        remotePort: remotePort,
        remoteHost: remoteHost,
        listen: false,
        authenticate: options.authenticate
    });

    const transferHelper = new TransferHelper(container, connectionHelperForTransfer, {
        name: 'ConnectingEngine',
        preferConnecting: true
    });

    const engine = new Engine(container, transferHelper, {sync: options.sync});

    return async.waterfall(
        [
            (cb)=> {
                if (options.watch) return container.beginWatching(cb);
                cb();
            },

            (cb)=>connectionHelperEntry.getNewSocket(cb),

            (socket, cb)=> {
                const eventMessenger = new EventMessenger(socket);
                engine.addOtherPartyMessenger(eventMessenger);
                if (options.interval && options.times) {
                    connectAgainAfterPreviousDied(eventMessenger, engine, connectionHelperEntry);
                }
                return cb(null, engine);
            }
        ],
        callback
    );
}

function connectAgainAfterPreviousDied(previousMessenger:EventMessenger, engine:Engine, connectionHelper:ConnectionHelper) {
    previousMessenger.on(EventMessenger.events.died, ()=> {

            debug(`obtaining new socket`);

            connectionHelper.getNewSocket((err, socket)=> {
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