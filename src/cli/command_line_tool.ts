import * as program from "commander";
import * as request from "request";
import {debugFor, loggerFor} from "../utils/logger";
import {Messenger} from "../connection/messenger";
import {Engine} from "../client/engine";
import * as fs from "fs";
import * as _ from "lodash";
import * as path from "path";
import {SyncAction} from "../sync/sync_actions";
import {NoActionStrategy} from "../sync/no_action";
import {PullStrategy} from "../sync/pull_action";
import {GetNewestSyncAction} from "../sync/get_newest_action";
import * as anymatch from "anymatch";

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

    if (chosenConfig.listen) {
        return listenAndStart(chosenConfig.port, chosenConfig.directory, chosenStrategy, filterFunction);
    }

    if (chosenConfig.bucket) {
        return connectWithBucketAndStart(chosenConfig.host,
            chosenConfig.port,
            chosenConfig.bucket,
            chosenConfig.directory,
            chosenStrategy,
            filterFunction);
    }

    return connectWithRetryAndStart(chosenConfig.host, chosenConfig.port, chosenConfig.directory, chosenStrategy, filterFunction)
}

interface ProgramOptions {
    host?:string,
    port?:number,
    bucket?:string,
    strategy?:string,
    directory?:string,
    init?:boolean,
    filter?:string,
    listen?:boolean,
    token?:string
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
    let strategy;
    switch (codeName) {
        case 'no':
            strategy = new NoActionStrategy();
            break;
        case 'pull':
            strategy = new PullStrategy();
            break;
        case 'newest':
            strategy = new GetNewestSyncAction();
            break;
    }
    return strategy;
}

function getPortForBucket(host, port, bucket, callback) {
    const requestUrl = `http://${host}:${port}/bucket/${bucket}/port`;
    debug(`requesting port with url: ${requestUrl}`);

    request({
        url: requestUrl,
        json: true
    }, (err, res, body) => {
        if (err) return callback(err);

        if (res.statusCode !== 200) return callback(new Error(`Invalid response code ${res.statusCode}`));

        debug(`got host: ${body.host} port: ${body.port} for bucket: ${bucket} `);

        callback(null, body.port);
    });
}
//TODO implement token

function listenAndStart(localPort:number, directory:string, strategy:SyncAction, filterFunction:(s:string) => boolean) {
    const messenger = new Messenger({
        port: localPort,
        listen: true,
        reconnect: true
    }, (err)=> {

        ifErrorThrow(err);

        logger.info('Connected');

        const client = new Engine(directory, messenger, {strategy: strategy, filter: filterFunction});
    });
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

function connectWithBucketAndStart(remoteHost:string,
                                   servicePort:number,
                                   bucketName:string,
                                   directory:string,
                                   strategy:SyncAction,
                                   filterFunction:(s:string) => boolean) {
    

    getPortForBucket(remoteHost, servicePort, bucketName,

        (err, bucketPort) => {
            ifErrorThrow(err);

            const messenger = new Messenger({
                    host: remoteHost,
                    port: bucketPort,
                    reconnect: true,
                    await: true,
                    listen: false
                },

                (err) => {
                    ifErrorThrow(err);


                    logger.info('Connected');
                    const client = new Engine(directory, messenger, {strategy: strategy, filter: filterFunction});

                    messenger.on(Messenger.events.recovering,

                        ()=> {
                            async.retry({times: 10, interval: 4000},

                                (cb)=> getPortForBucketAndObtainNewSocket(remoteHost, servicePort, bucketName, messenger, cb),

                                (err)=> {
                                    ifErrorThrow(err);
                                }
                            )
                        }
                    );
                }
            );
        }
    )
}

function getPortForBucketAndObtainNewSocket(remoteHost, servicePort, bucketName, messenger, callback) {
    getPortForBucket(remoteHost, servicePort, bucketName,

        (err, newPort)=> {
            if (err) return callback(err);

            return messenger.getAndAddNewSocket({host: remoteHost, port: newPort}, callback);
        }
    );
}

function ifErrorThrow(err?:Error) {
    if (err) throw err;
}
