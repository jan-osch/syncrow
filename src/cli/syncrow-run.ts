import {debugFor, loggerFor} from "../utils/logger";
import {Engine} from "../core/engine";
import * as fs from "fs";
import {SyncAction} from "../sync/sync_actions";
import {pullAction} from "../sync/pull_action";
import {ProgramOptions, configurationFileName} from "./program";
import {noAction} from "../sync/no_action";
import {pushAction} from "../sync/push_action";
import startListeningEngine from "../core/listen";
import startConnectingEngine from "../core/connect";
import {PathHelper} from "../fs_helpers/path_helper";

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
 * @returns {any}
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
    if (chosenConfig.listen) {
        return startListeningEngine(process.cwd(), chosenConfig.localPort, chosenConfig, (err, engine)=> {
            debug(`listening engine started`);
            ifErrorThrow(err);
            engine.on(Engine.events.error, ifErrorThrow);
        })
    }

    return startConnectingEngine(process.cwd(), chosenConfig.remotePort, chosenConfig.remoteHost, chosenConfig, (err, engine)=> {
        ifErrorThrow(err);
        debug(`engine connected`);
        engine.on(Engine.events.error, ifErrorThrow);
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