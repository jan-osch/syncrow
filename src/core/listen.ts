import {FilterFunction, FileContainer} from "../fs_helpers/file_container";
import {ConnectionHelper} from "../connection/connection_helper";
import {TransferHelper} from "../transport/transfer_helper";
import {Engine} from "./engine";
import {SyncAction} from "../sync/sync_actions";
import {EventMessenger} from "../connection/event_messenger";
import * as async from "async";
import * as _ from "lodash";

export interface EngineCallback {
    (err:Error, engine?:Engine):any
}

export interface ListenOptions {
    filterFunction?:FilterFunction;
    externalHost?:string;
    initialToken?:string;
    authenticate?:boolean;
    sync?:SyncAction;
    watch?:boolean;
}

/**
 * @param path
 * @param {Number} port
 * @param {ListenOptions} options
 * @param {EngineCallback} callback
 */
export default function startListeningEngine(path:string, port:number, options:ListenOptions, callback:EngineCallback) {
    const container = new FileContainer(path, {filter: options.filterFunction});

    const connectionHelperEntry = new ConnectionHelper({
        localPort: port,
        localHost: options.externalHost,
        listen: true,
        listenCallback: _.noop,
        token: options.initialToken
    });

    const connectionHelperForTransfer = new ConnectionHelper({
        localHost: options.externalHost,
        listen: true,
        listenCallback: _.noop,
        authenticate: options.authenticate
    });

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

            (cb)=>connectionHelperEntry.setupServer(cb)
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
            return helper.getNewSocket((err, socket)=> {
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
