import {FilterFunction, FileContainer} from "../fs_helpers/file_container";
import {ConnectionHelper} from "../connection/connection_helper";
import {TransferHelper} from "../transport/transfer_helper";
import {SyncAction} from "../sync/sync_actions";
import {EventMessenger} from "../connection/event_messenger";
import {EventEmitter} from "events";
import * as async from "async";
import ConstantServer from "../connection/constant_server";
import DynamicServer from "../connection/dynamic_server";
import {debugFor} from "../utils/logger";
import {Closable, ErrorCallback} from "../utils/interfaces";
import {Engine} from "../core/engine";

const debug = debugFor('syncrow:facade:server');
const AUTH_TIMEOUT = 100;

/**
 * @param params
 * @param {EngineCallback} callback
 */
export default class Server extends EventEmitter implements Closable {

    public static events = {
        /**
         * @event emitted when remote party connects
         */
        connection: 'connection'
    };

    public engine:Engine;

    private authTimeout:number;
    private container:FileContainer;
    private connectionHelperEntry:ConstantServer;
    private transferHelper:TransferHelper;
    private connectionHelperForTransfer:ConnectionHelper;

    constructor(private params:{
        path:string,
        localPort:number,
        externalHost:string,

        authTimeout?:number,
        filter?:FilterFunction
        initialToken?:string,
        authenticate?:boolean,
        sync?:SyncAction,
        watch?:boolean}) {
        super();
        this.authTimeout = params.authTimeout ? params.authTimeout : AUTH_TIMEOUT;

        this.initializeHelpers();
    }

    public start(callback:ErrorCallback) {
        debug(`starting the initialization flow`);

        return async.waterfall(
            [
                (cb)=> {
                    if (this.params.watch)return this.container.beginWatching(cb);
                    return setImmediate(cb);
                },

                (cb)=>this.connectionHelperEntry.listen(cb),

                (cb)=> {
                    this.listenForMultipleConnections(this.engine, this.connectionHelperEntry);
                    return setImmediate(cb);
                }
            ],
            callback
        );
    }

    public shutdown() {
        this.engine.shutdown();
        this.connectionHelperEntry.shutdown();
        this.connectionHelperForTransfer.shutdown();
        this.container.shutdown();
    };

    private initializeHelpers() {
        this.container = new FileContainer(this.params.path, {filter: this.params.filter});

        this.connectionHelperEntry = new ConstantServer(this.params.localPort,
            {
                authTimeout: this.authTimeout,
                constantToken: this.params.initialToken
            }
        );

        this.connectionHelperForTransfer = new DynamicServer({
                authTimeout: this.authTimeout,
                generateToken: this.params.authenticate
            },
            this.params.externalHost
        );

        this.transferHelper = new TransferHelper(this.container, this.connectionHelperForTransfer,
            {
                name: 'ListeningEngine',
                preferConnecting: false
            }
        );

        this.engine = new Engine(this.container, this.transferHelper, {sync: this.params.sync});
    }

    private listenForMultipleConnections(engine:Engine, helper:ConnectionHelper) {
        return async.whilst(
            ()=>true,

            (cb)=> {
                return helper.getNewSocket({}, (err, socket)=> {
                    if (err) {
                        engine.emit(Engine.events.error, err);
                        return cb();
                    }

                    const eventMessenger = new EventMessenger(socket);
                    this.emit(Server.events.connection, eventMessenger);
                    engine.addOtherPartyMessenger(eventMessenger);
                    return cb();
                })
            },

            (err)=> {
                if (err) engine.emit(Engine.events.error, err);
            }
        )
    }
}