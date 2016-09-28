import {debugFor, loggerFor} from "../utils/logger";
import {Engine} from "../core/engine";
import * as fs from "fs";
import {SyncAction} from "../sync/sync_actions";
import {pullAction} from "../sync/pull_action";
import {ProgramOptions, configurationFileName} from "./program";
import {noAction} from "../sync/no_action";
import {pushAction} from "../sync/push_action";
import {PathHelper} from "../fs_helpers/path_helper";
import SListen from "../facade/server";
import SConnect from "../facade/client";

const logger = loggerFor("syncrow-run");
const debug = debugFor("syncrow:cli:run");

/**
 * MAIN
 */
debug('executing syncrow-run');


const savedConfig = loadConfigFromFile(configurationFileName);
const preparedConfig = buildConfig(savedConfig);

printDebugAboutConfig(preparedConfig);
startEngine(savedConfig);


/**
 * @param path
 */
function loadConfigFromFile(path:string):ProgramOptions {
    try {
        const result = JSON.parse(fs.readFileSync(path, 'utf8'));
        debug(`found configuration in file`);

        return result;
    } catch (e) {
        throw new Error('Configuration file not found or invalid - run "syncrow init" to initialize')
    }
}

/**
 * @param savedConfig
 * @returns {ProgramOptions}
 */
function buildConfig(savedConfig:ProgramOptions):ProgramOptions {
    const filterStrings = savedConfig.rawFilter.concat([configurationFileName]);

    savedConfig.filter = PathHelper.createFilterFunction(filterStrings, process.cwd());

    savedConfig.sync = chooseStrategy(savedConfig.rawStrategy);

    return savedConfig;
}

/**
 * @param chosenConfig
 */
function startEngine(chosenConfig:ProgramOptions) {
    chosenConfig.path = process.cwd();
    if (chosenConfig.listen) {

        const listener = new SListen(
            {
                path: process.cwd(),
                localPort: chosenConfig.localPort,
                externalHost: chosenConfig.externalHost,
                sync: chosenConfig.sync,
                watch: chosenConfig.watch,
                filter: chosenConfig.filter,
                initialToken: chosenConfig.initialToken,
                authenticate: chosenConfig.authenticate
            });

        return listener.start((err)=> {
            debug(`listening engine started`);
            ifErrorThrow(err);
            listener.engine.on(Engine.events.error, ifErrorThrow);
        })
    }

    const connector = new SConnect({
        path: process.cwd(),
        remotePort: chosenConfig.remotePort,
        remoteHost: chosenConfig.remoteHost,
        sync: chosenConfig.sync,
        watch: chosenConfig.watch,
        filter: chosenConfig.filter,
        initialToken: chosenConfig.initialToken,
        authenticate: chosenConfig.authenticate
    });

    connector.start((err)=> {
        ifErrorThrow(err);
        debug(`engine connected`);
        connector.engine.on(Engine.events.error, ifErrorThrow);
    })
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

function ifErrorThrow(err?:Error|any) {
    if (err) {
        if (err.stack) console.error(err.stack);
        throw err;
    }
}