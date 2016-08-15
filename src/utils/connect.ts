import {EngineCallback} from "./listen";
import {FileContainer, FilterFunction} from "../fs_helpers/file_container";
import {ConnectionHelper} from "../connection/connection_helper";
import {TransferHelper} from "../transport/transfer_helper";
import {Engine} from "../client/engine";
import {SyncAction} from "../sync/sync_actions";
import {EventMessenger} from "../connection/event_messenger";

export interface ConnectOptions {
    filter?:FilterFunction;
    initialToken?:string;
    authenticate?:boolean;
    sync:SyncAction;
    times:number;
    interval:number;
}

/**
 * @param {Number} remotePort
 * @param {String} remoteHost
 * @param {String} path
 * @param {ConnectOptions} options
 * @param {EngineCallback} callback
 */
function connect(remotePort:number, remoteHost:string, path:string, options:ConnectOptions, callback:EngineCallback) {
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

    connectionHelperEntry.getNewSocket(
        (err, socket)=> {
            if (err) return callback(err);

            const eventMessenger = new EventMessenger(socket);
            engine.addOtherPartyMessenger(eventMessenger);
            if (options.interval && options.times) {
                connectAgainAfterPreviousDied(eventMessenger, engine, connectionHelperEntry);
            }

            return callback(null, engine);
        }
    )
}

function connectAgainAfterPreviousDied(previousMessenger:EventMessenger, engine:Engine, connectionHelper:ConnectionHelper) {
    previousMessenger.on(EventMessenger.events.died, ()=> {

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