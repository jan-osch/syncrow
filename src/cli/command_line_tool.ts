/// <reference path="../../typings/main.d.ts" />

import * as program from "commander";
import * as request from "request";
import {debugFor, loggerFor} from "../utils/logger";
import {ConnectionServer} from "../connection/connection_server";
import {Messenger} from "../connection/messenger";
import {getActiveConnection, Connection} from "../connection/connection";
import {Client} from "../client/client";
import * as fs from "fs";
import * as _ from "lodash";
import * as path from "path";
import Program = ts.Program;

const logger = loggerFor("CLI");
const debug = debugFor("syncrow:cli");

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

function getGoodProgramKeys(program) {
    const keys = Object.keys(program);

    return keys.filter(e => {
        return e[0] !== '_' && ['args', 'rawArgs', 'commands', 'options'].indexOf(e) === -1;
    });
}

function loadConfigFromFile(path:string) {
    try {
        return JSON.parse(fs.readFileSync(path));
    } catch (e) {
        return {};
    }
}
const savedConfig = loadConfigFromFile(`${program.directory}/.syncrow.json`);
let finalConfig;

if (savedConfig && !program.init) {
    debug(`Found a stored configuration file`);
    finalConfig = savedConfig;

} else {
    finalConfig = program;
}

if (finalConfig.init) {
    debug('Saving configuration to file');
    const configurationToSave = _.pick(finalConfig, getGoodProgramKeys(program));
    configurationToSave.directory  = path.resolve(configurationToSave.directory);
    fs.writeFileSync(`${finalConfig.directory}/.syncrow.json`,JSON.stringify(configurationToSave));
}

debug(`host: ${finalConfig.host}`);
debug(`port: ${finalConfig.port}`);
debug(`localPort: ${finalConfig.local}`);
debug(`listen: ${finalConfig.listen}`);
debug(`directory: ${finalConfig.directory}`);
debug(`bucket: ${finalConfig.bucket}`);
debug(`strategy: ${finalConfig.strategy}`);

if (finalConfig.bucket) {
    if (!finalConfig.port) {
        throw new Error('Port required to connect');
    }

    debug(`requesting port for bucket: ${finalConfig.bucket}`);

    request({
        url: `http://${finalConfig.host}:${finalConfig.port}/bucket/${finalConfig.bucket}/port`,
        json: true
    }, (err, res, body)=> {
        if (err) throw err;
        if (res.statusCode !== 200) throw new Error(`Invalid response code ${res.statusCode}`);

        debug(`got host/port for bucket: ${finalConfig.bucket}`);

        start(body.port, body.host, false, finalConfig.directory);
    });

} else {
    start(finalConfig.port, finalConfig.host, finalConfig.listen, finalConfig.directory, finalConfig.local)
}

function start(port:number, host:string, listen:boolean, directory:string, localPort?:number) {

    if (listen) {
        new ConnectionServer(localPort, handleConnectionObtained);
    } else {
        getActiveConnection(host, port, handleConnectionObtained)
    }
}

function handleConnectionObtained(err:Error, connection?:Connection) {
    if (err) throw err;

    logger.info(`Syncrow connected`);

    const messenger = new Messenger(connection);
    new Client(finalConfig.directory, messenger);
}
