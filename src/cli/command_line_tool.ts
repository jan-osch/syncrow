import * as program from "commander";
import {debugFor, loggerFor} from "../utils/logger";
import {Messenger} from "../connection/messenger";
import {Engine} from "../client/engine";
import * as fs from "fs";
import * as _ from "lodash";
import * as path from "path";
import {SyncAction} from "../sync/sync_actions";
import * as anymatch from "anymatch";
import {pullAction} from "../sync/pull_action";
import {FileContainer} from "../fs_helpers/file_container";
import {ConnectionHelper} from "../connection/connection_helper";
import {TransferHelper} from "../transport/transfer_helper";
import * as async from "async";
import {EventMessenger} from "../connection/evented_messenger";

const logger = loggerFor("CLI");
const debug = debugFor("syncrow:cli");

/**
 * MAIN
 */
main();

function main() {
    const configPath = '.syncrow.json';

    const defaultConfig = getDefaultConfig();
    const savedConfig = loadConfigFromFile(configPath);
    const commandLineConfig = getConfigFromCommandLine();
    const chosenConfig = chooseConfig(defaultConfig, savedConfig, commandLineConfig);

    validateConfig(chosenConfig);
    saveConfigIfNeeded(chosenConfig, configPath);
    printDebugAboutConfig(chosenConfig);

    const chosenStrategy = getStrategy(chosenConfig.strategy);
    const filterFunction = createFilterFunction(chosenConfig.filter, path.resolve(chosenConfig.directory));

    startEngine(chosenConfig);
}

interface ProgramOptions {
    remoteHost?:string;
    remotePort?:number;
    localPort?:number;
    externalHost?:string;
    strategy?:string;
    directory?:string;
    filter?:(s:string)=>boolean;
    listen?:boolean;
    initialToken?:string;
    listenForMultiple?:boolean;
    abort?:boolean;
    deleteLocalFiles?:boolean;
    deleteRemoteFiles?:boolean;
    skipWatching?:boolean;
    authenticate?:boolean;
    reconnect?:boolean;
    times?:number;
    interval?:number;
}

//TODO add initialize token

function getConfigFromCommandLine():ProgramOptions {
    program.version('0.0.2')

        .option('-h, --remoteHost <remoteHost>', 'remote remoteHost for connection') //TODO add support for getting the local public IP
        .option('-p, --remotePort <remotePort>', 'remote remotePort for connection')
        .option('-c, --local <local>', 'local remotePort for listening')
        .option('-b, --bucket <bucket>', 'bucket name')
        .option('-l, --listen', 'listen for connections')
        .option('-s, --strategy <strategy>', 'synchronization strategy (pull|no|newest) [no]')
        .option('-d, --directory <directory>', 'directory to watch')
        .option('-i, --init', 'save configuration to file')
        .option('-f, --filter <filter>', 'comma separated filter patterns')
        .option('-t, --token <token>', 'token for authorisation')
        .parse(process.argv);

    return _.pick(program, getGoodProgramKeys(program));
}

function getDefaultConfig():ProgramOptions {
    return {
        host: "0.0.0.0",
        port: 2510,
        strategy: "no",
        directory: ".",
        filter: ''
    }
}

function createFilterFunction(filterString:string, baseDir:string) {
    const patterns = filterString.split(',');
    const baseLength = baseDir.length + 1;
    if (filterString && filterString !== '') {
        return (s:string) => {
            const actual = s.indexOf(baseDir) !== -1 ? s.substring(baseLength) : s;
            return anymatch(patterns, actual);
        }
    }

    return s => false;
}

function getGoodProgramKeys(program):Array<string> {
    const keys = Object.keys(program);

    return keys.filter(e => {
        return e[0] !== '_' && ['args', 'rawArgs', 'commands', 'options'].indexOf(e) === -1;
    });
}

function loadConfigFromFile(path:string):ProgramOptions {
    try {
        const result = JSON.parse(fs.readFileSync(path, 'utf8'));

        debug(`found configuration in file`);

        return result;
    } catch (e) {
        return {};
    }
}


function chooseConfig(defaultConfig:ProgramOptions, savedConfig:ProgramOptions, commandLineConfig:ProgramOptions):ProgramOptions {
    let config = _.extend(defaultConfig, savedConfig);
    return _.extend(config, commandLineConfig);
}


function saveConfigIfNeeded(config:ProgramOptions, pathToSave) {
    if (config.init) {
        debug('Saving configuration to file');

        delete config.init;

        fs.writeFileSync(`${config.directory}/${pathToSave}`, JSON.stringify(config, null, 2));
    }
}

function printDebugAboutConfig(finalConfig:ProgramOptions) {
    debug(`host: ${finalConfig.host}`);
    debug(`port: ${finalConfig.port}`);
    debug(`listen: ${finalConfig.listen}`);
    debug(`directory: ${finalConfig.directory}`);
    debug(`bucket: ${finalConfig.bucket}`);
    debug(`strategy: ${finalConfig.strategy}`);
    debug(`filter: ${finalConfig.filter}`);
    debug(`token: ${finalConfig.token}`);
}


function validateConfig(config) {
    if (config.bucket && !config.port || !config.host) {
        throw new Error('Port required to connect');
    }
    if (config.listen && !config.port) {
        throw new Error('Local Port required to listen');
    }
    if (config.init && config.directory !== '.') {
        throw new Error('Cannot save config when directory is not current working dir');
    }
}


function getStrategy(codeName):SyncAction {
    return pullAction;
}

function startEngineAsServer(options:ProgramOptions) {
    if (!options.listen) throw new Error('Server needs to listen');

    const container = new FileContainer(options.directory, {filter: options.filter});

    const paramsForEntry = {
        localPort: options.localPort,
        localHost: options.externalHost,
        listen: options.listen,
        authenticate: options.authenticate,
        token: options.initialToken
    };

    const connectionHelperEntry = new ConnectionHelper(paramsForEntry);

    const paramsForTransfer = {
        localPort: options.localPort,
        localHost: options.externalHost,
        listen: options.listen,
        authenticate: options.authenticate,
    };

    const connectionHelperForTransfer = new ConnectionHelper(paramsForTransfer);

    const transferHelper = new TransferHelper(container, connectionHelperForTransfer,{});

    const engine = new Engine(container, transferHelper, {watch: !!options.skipWatching},

        (err)=> {
            ifErrorThrow(err);
            return connectionHelperEntry.setupServer(

                ()=> {
                    if (options.listenForMultiple) {
                        return listenForMultipleConnections(engine, connectionHelperEntry, ifErrorThrow);
                    }

                    return connectionHelperEntry.getNewSocket((err, socket)=> {
                        ifErrorThrow(err);
                        const messenger = new EventMessenger({reconnect: false}, socket, connectionHelperEntry);
                        return engine.addOtherPartyMessenger(messenger);
                    })
                }
            );
        }
    );
}


function listenForMultipleConnections(engine:Engine, helper:ConnectionHelper, callback:ErrorCallback) {

    async.whilst(()=>true,
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


function connectWithRetryAndStart(remoteHost:string,
                                  remotePort:number,
                                  directory:string,
                                  strategy:SyncAction,
                                  filterFunction:(s:string) => boolean) {

    const messenger = new Messenger({
        host: remoteHost,
        port: remotePort,
        reconnect: true,
        listen: false,
        retries: 10,
        interval: 4000
    }, (err) => {
        ifErrorThrow(err);

        logger.info('Connected');

        const client = new Engine(directory, messenger, {strategy: strategy, filter: filterFunction});
    })
}


function ifErrorThrow(err?:Error) {
    if (err) throw err;
}
