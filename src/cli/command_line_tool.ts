/// <reference path="../../typings/main.d.ts" />

import * as program from "commander";
import * as request from "request";
import {debugFor, loggerFor} from "../utils/logger";
import {ConnectionServer} from "../connection/connection_server";
import {Messenger} from "../connection/messenger";
import {getActiveConnection, Connection, getAbortConnection} from "../connection/connection";
import {Client} from "../client/client";
import * as fs from "fs";
import * as _ from "lodash";
import {SynchronizationStrategy} from "../sync_strategy/sync_strategy";
import {NoActionStrategy} from "../sync_strategy/no_action_strategy";
import {PullStrategy} from "../sync_strategy/pull_everything_strategy";
import {NewestStrategy} from "../sync_strategy/accept_newest_strategy";
import Program = ts.Program;

const logger = loggerFor("CLI");
const debug = debugFor("syncrow:cli");

/**
 * MAIN
 */
main();

function main() {
    const commandLineConfig = getConfigFromCommandLine();
    const savedConfig = loadConfigFromFile(`${commandLineConfig.directory}/.syncrow.json`);
    const chosenConfig = chooseConfig(commandLineConfig, savedConfig);

    validateConfig(chosenConfig);
    saveConfigIfNeeded(chosenConfig);
    printDebugAboutConfig(chosenConfig);

    const chosenStrategy = getStrategy(chosenConfig.strategy);

    if (chosenConfig.listen) {
        return listenAndStart(chosenConfig.local, chosenConfig.directory, chosenConfig);
    }

    if (chosenConfig.bucket) {
        return connectWithBucketAndStart(chosenConfig.host, chosenConfig.port, chosenConfig.bucket, chosenConfig.directory, chosenStrategy);
    }

    return connectWithRetryAndStart(chosenConfig.host, chosenConfig.port, chosenConfig.directory, chosenStrategy)
}

function getConfigFromCommandLine() {
    program.version('0.0.2')
        .option('-h, --host <host>', 'remote host for connection', '0.0.0.0')
        .option('-p, --port <port>', 'remote port for connection', 2510)
        .option('-c, --local <local>', 'local port for listening')
        .option('-b, --bucket <bucket>', 'bucket name')
        .option('-l, --listen', 'listen for connections')
        .option('-s, --strategy <strategy>', 'synchronization strategy (pull|no|newest) [no]', 'no')
        .option('-d, --directory <directory>', 'directory to watch', '.')
        .option('-i, --init', 'save configuration to file')
        .parse(process.argv);

    return program;
}

function getGoodProgramKeys(program):Array<string> {
    const keys = Object.keys(program);

    return keys.filter(e => {
        return e[0] !== '_' && ['args', 'rawArgs', 'commands', 'options'].indexOf(e) === -1;
    });
}

function loadConfigFromFile(path:string) {
    try {
        return JSON.parse(fs.readFileSync(path));
    } catch (e) {
        return;
    }
}


function chooseConfig(commandLineConfig, savedConfig) {
    if (!commandLineConfig.init && savedConfig) {
        debug(`Found a stored configuration file`);
        return savedConfig;
    }
    return commandLineConfig;
}


function saveConfigIfNeeded(config, path) {
    if (config.init) {
        debug('Saving configuration to file');

        const configurationToSave = _.pick(config, getGoodProgramKeys(config));

        configurationToSave.directory = path.resolve(configurationToSave.directory);
        delete configurationToSave.init;

        fs.writeFileSync(`${config.directory}/${path}`, JSON.stringify(configurationToSave, null, 2));
    }
}

function printDebugAboutConfig(finalConfig) {
    debug(`host: ${finalConfig.host}`);
    debug(`port: ${finalConfig.port}`);
    debug(`localPort: ${finalConfig.local}`);
    debug(`listen: ${finalConfig.listen}`);
    debug(`directory: ${finalConfig.directory}`);
    debug(`bucket: ${finalConfig.bucket}`);
    debug(`strategy: ${finalConfig.strategy}`);
}


function validateConfig(config) {
    if (config.bucket && !config.port || !config.host) {
        throw new Error('Port required to connect');
    }
    if (config.listen && !config.local) {
        throw new Error('Local Port required to listen');
    }
}


function getStrategy(codeName):SynchronizationStrategy {
    let strategy;
    switch (codeName) {
        case 'no':
            strategy = new NoActionStrategy();
            break;
        case 'pull':
            strategy = new PullStrategy();
            break;
        case 'newest':
            strategy = new NewestStrategy();
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
    }, (err, res, body)=> {
        if (err) return callback(err);

        if (res.statusCode !== 200) return callback(new Error(`Invalid response code ${res.statusCode}`));

        debug(`got host: ${body.host} port: ${body.port} for bucket: ${bucket} `);

        callback(null, body.port);
    });
}


function listenAndStart(localPort, directory, strategy) {
    new ConnectionServer(localPort, (err, connection)=> {
        ifErrorThrow(err);

        logger.info('Connected');

        const messenger = new Messenger(connection);
        const client = new Client(directory, messenger, strategy);
    });
}


function connectWithRetryAndStart(remoteHost, remotePort, directory, strategy) {
    getActiveConnection(remoteHost, remotePort, (err, connection)=> {
        ifErrorThrow(err);

        logger.info('Connected');

        const messenger = new Messenger(connection);
        const client = new Client(directory, messenger, strategy);
    })
}

function connectWithBucketAndStart(remoteHost:string,
                                   servicePort:number,
                                   bucketName:string,
                                   directory:string,
                                   strategy:SynchronizationStrategy) {
    getPortForBucket(remoteHost, servicePort, bucketName, (err, bucketPort)=> {
        ifErrorThrow(err);
        getAbortConnection(remoteHost, bucketPort, (err, connection)=> {
            ifErrorThrow(err);

            connection.on(Connection.events.disconnected, ()=> {
                getPortForBucket(remoteHost, servicePort, bucketName, (err, newBucketPort)=> {
                    const newSocket = net.connect(newBucketPort,remoteHost, ()=> {
                        connection.addSocket(newSocket);
                    }).on('error', (err)=> {
                        throw err
                    })
                });
            });

            logger.info('Connected');

            const messenger = new Messenger(connection);
            const client = new Client(directory, messenger, strategy);
        });
    })
}

function ifErrorThrow(err?:Error) {
    if (err) throw err;
}