import {FileContainer, FilterFunction} from "../fs_helpers/file_container";
import {ConnectionHelper} from "../connection/connection_helper";
import {TransferHelper} from "../transport/transfer_helper";
import {Engine} from "../core/engine";
import {SyncAction} from "../sync/sync_actions";
import {EventMessenger} from "../connection/event_messenger";
import * as async from "async";
import {debugFor} from "../utils/logger";
import ConstantConnector from "../connection/constant_connector";
import DynamicConnector from "../connection/dynamic_connector";
import {Closable} from "../utils/interfaces";

const debug = debugFor('syncrow:facade:client');

const AUTH_TIMEOUT = 10;

/**
 * @param params
 * @param callback
 */
export default class Client implements Closable {
    private authTimeout:number;
    private container:FileContainer;
    private connectionHelperEntry:ConnectionHelper;
    private connectionHelperForTransfer:ConnectionHelper;
    private transferHelper:TransferHelper;
    public engine:Engine;

    constructor(private params:{
        path:string,
        remotePort:number,
        remoteHost:string,

        authTimeout?:number,
        filter?:FilterFunction,
        initialToken?:string,
        authenticate?:boolean,
        sync?:SyncAction,
        watch?:boolean,
        retry?:{
            times:number,
            interval:number
        }}) {

        this.authTimeout = params.authTimeout ? params.authTimeout : AUTH_TIMEOUT;
        this.initializeHelpers();
    }

    public start(callback) {
        debug(`starting the connect flow`);

        return async.waterfall(
            [
                (cb)=> {
                    if (this.params.watch) return this.container.beginWatching(cb);

                    return setImmediate(cb);
                },

                (cb)=> {
                    if (this.params.retry) {
                        return async.retry(this.params.retry,
                            (retryCallback)=>this.connectionHelperEntry.getNewSocket({}, retryCallback),
                            cb
                        );
                    }

                    return this.connectionHelperEntry.getNewSocket({}, cb)
                },


                (socket, cb)=> {
                    debug(`initial connection obtained`);

                    const eventMessenger = new EventMessenger(socket);
                    this.engine.addOtherPartyMessenger(eventMessenger);

                    if (this.params.retry) {
                        this.connectAgainAfterPreviousDied(eventMessenger, this.engine, this.connectionHelperEntry);
                    }

                    return setImmediate(cb);
                }
            ],
            callback
        );
    }

    /**
     */
    public shutdown() {
        this.engine.shutdown();
        this.connectionHelperEntry.shutdown();
        this.connectionHelperForTransfer.shutdown();
        this.container.shutdown();
    }

    private initializeHelpers() {
        this.container = new FileContainer(this.params.path, {filter: this.params.filter});

        this.connectionHelperEntry = new ConstantConnector(this.authTimeout,
            this.params.remoteHost,
            this.params.remotePort,
            this.params.initialToken);

        this.connectionHelperForTransfer = new DynamicConnector(this.authTimeout);

        this.transferHelper = new TransferHelper(this.container, this.connectionHelperForTransfer, {
            name: 'ConnectingEngine',
            preferConnecting: true
        });

        this.engine = new Engine(this.container, this.transferHelper, {sync: this.params.sync});
    }

    private connectAgainAfterPreviousDied(previousMessenger:EventMessenger, engine:Engine, connectionHelper:ConnectionHelper) {
        return previousMessenger.once(EventMessenger.events.died, ()=> {

                debug(`obtaining new socket`);

                return connectionHelper.getNewSocket({}, (err, socket)=> {
                        if (err) {
                            return engine.emit(Engine.events.error, err);
                        }

                        const eventMessenger = new EventMessenger(socket);
                        engine.addOtherPartyMessenger(eventMessenger);

                        this.connectAgainAfterPreviousDied(eventMessenger, engine, connectionHelper);
                    }
                )
            }
        )
    }
}