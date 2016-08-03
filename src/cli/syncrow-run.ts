import {debugFor, loggerFor} from "../utils/logger";
import {Engine, EngineOptions} from "../client/engine";
import * as fs from "fs";
import {SyncAction} from "../sync/sync_actions";
import * as anymatch from "anymatch";
import {pullAction} from "../sync/pull_action";
import {FileContainer, FilterFunction} from "../fs_helpers/file_container";
import {ConnectionHelper} from "../connection/connection_helper";
import {TransferHelper} from "../transport/transfer_helper";
import * as async from "async";
import {EventMessenger} from "../connection/evented_messenger";
import {ProgramOptions, ProgramTypes} from "./program";
import {noAction} from "../sync/no_action";
import {pushAction} from "../sync/push_action";
import * as _ from "lodash";

const logger = loggerFor("syncrow-run");
const debug = debugFor("syncrow:cli:run");

/**
 * MAIN
 */
syncrowRun();

function syncrowRun() {
    debug('executing syncrow-run');

    const configPath = '.syncrow.json';
    const savedConfig = loadConfigFromFile(configPath);

    const preparedConfig = buildConfig(savedConfig);

    printDebugAboutConfig(preparedConfig);

    startEngine(savedConfig);
}

/**
 * @param path
 * @returns {any}
 */
function loadConfigFromFile(path:string):ProgramOptions {
    try {
        const result = JSON.parse(fs.readFileSync(path, 'utf8'));
        debug(`found configuration in file`);

        return result;
    } catch (e) {
        return {};
    }
}

/**
 * @param savedConfig
 * @returns {ProgramOptions}
 */
function buildConfig(savedConfig:ProgramOptions):ProgramOptions {
    if (savedConfig.rawFilter) {
        savedConfig.filter = createFilterFunction(savedConfig.rawFilter, '.');
    }

    savedConfig.strategy = chooseStrategy(savedConfig.rawStrategy);

    return savedConfig;
}

/**
 * @param filterStrings
 * @param baseDir
 */
function createFilterFunction(filterStrings:Array<string>, baseDir:string):FilterFunction {
    const baseLength = baseDir.length + 1;

    if (filterStrings.length > 0) {
        return (s:string) => {
            const actual = s.indexOf(baseDir) !== -1 ? s.substring(baseLength) : s;
            return anymatch(filterStrings, actual);
        }
    }

    return s => false;
}

/**
 * @param chosenConfig
 */
function startEngine(chosenConfig:ProgramOptions) {
    if (chosenConfig.type === ProgramTypes.clientListening) {
        return startEngineAsListeningClient(chosenConfig);
    }
    if (chosenConfig.type === ProgramTypes.clientConnecting) {
        return startEngineAsConnectingClient(chosenConfig)
    }
    if (chosenConfig.type === ProgramTypes.server) {
        return startEngineAsServer(chosenConfig);
    }

    throw new Error(`Invalid or missing type: ${chosenConfig.type}`);
}

function chooseStrategy(key:string):SyncAction {
    if (key === 'no') {
        return noAction;
    }
    if (key === 'pull') {
        return pullAction;
    }
    if (key === 'push') {
        return pushAction;
    }

    throw  new Error(`invalid strategy key: ${key}`);
}

function printDebugAboutConfig(finalConfig:ProgramOptions) {
    debug(`final config: ${JSON.stringify(finalConfig, null, 2)}`);
}
function startEngineAsListeningClient(options:ProgramOptions) {
    if (!options.listen) throw new Error('Listening client needs to listen');

    const container = new FileContainer('.', {filter: options.filter});

    const paramsForEntry = {
        localPort: options.localPort,
        localHost: options.externalHost,
        listen: true,
        token: options.initialToken,
        listenCallback: _.noop
    };

    const connectionHelperEntry = new ConnectionHelper(paramsForEntry);

    const paramsForTransfer = {
        localHost: options.externalHost,
        listen: true,
        authenticate: options.authenticate,
        listenCallback: (address)=>{
            logger.info(`Client listening on port: ${address.port}`);
        }
    };

    const connectionHelperForTransfer = new ConnectionHelper(paramsForTransfer);

    const transferHelper = new TransferHelper(container, connectionHelperForTransfer, {
        name: 'Client',
        preferConnecting: false
    });

    const engineOptions = buildEngineOptionsFromConfig(options);

    const engine = new Engine(container, transferHelper, engineOptions,

        (err)=> {
            ifErrorThrow(err);

            if (options.reconnect) {
                return connectionHelperEntry.setupServer(
                    (server)=> {
                        logger.info(`Client listening on port: ${server.address().port}`);

                        return getSocketAndAddToEngine(engine, connectionHelperEntry, true, ifErrorThrow)
                    }
                )
            }

            return getSocketAndAddToEngine(engine, connectionHelperEntry, false, ifErrorThrow);
        }
    );
}



function startEngineAsConnectingClient(options:ProgramOptions) {
    if (options.listen) throw new Error(`Connecting client has can't listen`);

    const container = new FileContainer('.', {filter: options.filter});

    const paramsForEntry = {
        remotePort: options.remotePort,
        remoteHost: options.remoteHost,
        listen: false,
        token: options.initialToken
    };

    const connectionHelperEntry = new ConnectionHelper(paramsForEntry);

    const paramsForTransfer = {
        localHost: options.externalHost,
        remotePort: options.remotePort,
        remoteHost: options.remoteHost,
        listen: false,
        authenticate: options.authenticate
    };

    const connectionHelperForTransfer = new ConnectionHelper(paramsForTransfer);

    const transferHelper = new TransferHelper(container, connectionHelperForTransfer, {
        name: 'Client',
        preferConnecting: true
    });

    const engineOptions = buildEngineOptionsFromConfig(options);
    const engine = new Engine(container, transferHelper, engineOptions,

        (err)=> {
            ifErrorThrow(err);

            return getSocketAndAddToEngine(engine, connectionHelperEntry, options.reconnect, ifErrorThrow);
        }
    );
}

function startEngineAsServer(options:ProgramOptions) {
    if (!options.listen) throw new Error('Server needs to listen');
    if (options.reconnect) throw new Error('Listening Server cannot allow reconnection');

    const container = new FileContainer('.', {filter: options.filter});

    const paramsForEntry = {
        localPort: options.localPort,
        localHost: options.externalHost,
        listen: options.listen,
        listenCallback: _.noop,
        token: options.initialToken
    };

    const connectionHelperEntry = new ConnectionHelper(paramsForEntry);

    const paramsForTransfer = {
        localPort: options.localPort,
        localHost: options.externalHost,
        listen: options.listen,
        listenCallback: _.noop,
        authenticate: options.authenticate,
    };

    const connectionHelperForTransfer = new ConnectionHelper(paramsForTransfer);

    const transferHelper = new TransferHelper(container, connectionHelperForTransfer, {
        name: 'Server',
        preferConnecting: false
    });

    const engineOptions = buildEngineOptionsFromConfig(options);
    const engine = new Engine(container, transferHelper, engineOptions,

        (err)=> {
            ifErrorThrow(err);
            return connectionHelperEntry.setupServer(
                ()=> {
                    if (options.listenForMultiple) {
                        return listenForMultipleConnections(engine, connectionHelperEntry, ifErrorThrow);
                    }

                    return getSocketAndAddToEngine(engine, connectionHelperEntry, false, ifErrorThrow)
                }
            );
        }
    );
}

function getSocketAndAddToEngine(engine:Engine, connectionHelper:ConnectionHelper, reconnect:boolean, callback) {
    return connectionHelper.getNewSocket(
        (err, socket)=> {
            if (err)return callback(err);

            const messenger = new EventMessenger({reconnect: reconnect}, socket, connectionHelper);
            engine.addOtherPartyMessenger(messenger);

            return callback(null, messenger);
        }
    )
}


function listenForMultipleConnections(engine:Engine, helper:ConnectionHelper, callback:ErrorCallback) {

    return async.whilst(
        ()=>true,

        (cb)=> {
            return helper.getNewSocket((err, socket)=> {
                if (err) return cb(err);

                const messenger = new EventMessenger({reconnect: false}, socket, helper);
                engine.addOtherPartyMessenger(messenger);
                return cb();
            })
        },
        callback
    )
}

function ifErrorThrow(err?:Error) {
    if (err) throw err;
}

function buildEngineOptionsFromConfig(options:ProgramOptions):EngineOptions {
    const engineOptions:EngineOptions = {};

    engineOptions.watch = !!options.skipWatching;
    engineOptions.onFirstConnection = options.strategy;
    engineOptions.onReconnection = options.strategy;

    return engineOptions;
}
