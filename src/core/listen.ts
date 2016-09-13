import {FilterFunction, FileContainer} from "../fs_helpers/file_container";
import {ConnectionHelper} from "../connection/connection_helper";
import {TransferHelper} from "../transport/transfer_helper";
import {Engine} from "./engine";
import {SyncAction} from "../sync/sync_actions";
import {EventMessenger} from "../connection/event_messenger";
import * as async from "async";
import ConstantServer from "../connection/constant_server";
import DynamicServer from "../connection/dynamic_server";

export interface EngineCallback {
    (err:Error, engine?:Engine):any
}

export interface ListenOptions {
    filter?:FilterFunction;
    externalHost?:string;
    initialToken?:string;
    authenticate?:boolean;
    sync?:SyncAction;
    watch?:boolean;
}

const AUTHORISATION_TIMEOUT = 40;

/**
 * @param path
 * @param {Number} port
 * @param {ListenOptions} options
 * @param {EngineCallback} callback
 */
export default function startListeningEngine(path:string, port:number, options:ListenOptions, callback:EngineCallback) {
    const container = new FileContainer(path, {filter: options.filter});

    const connectionHelperEntry = new ConstantServer(port,
        {
            authorisationTimeout: AUTHORISATION_TIMEOUT,
            constantToken: options.initialToken
        }
    );

    const connectionHelperForTransfer = new DynamicServer({
            authorisationTimeout: AUTHORISATION_TIMEOUT,
            generateToken: options.authenticate
        },
        options.externalHost
    );

    const transferHelper = new TransferHelper(
        container,
        connectionHelperForTransfer,
        {
            name: 'ListeningEngine',
            preferConnecting: false
        }
    );

    const engine = new Engine(container, transferHelper, {sync: options.sync});

    engine.on(Engine.events.shutdown, ()=> {
        connectionHelperForTransfer.shutdown();
        connectionHelperEntry.shutdown();
    });

    return async.waterfall(
        [
            (cb)=> {
                if (options.watch)return container.beginWatching(cb);
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
            if (err) engine.emit(Engine.events.error, err);
        }
    )
}
