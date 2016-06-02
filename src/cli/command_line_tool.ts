/// <reference path="../../typings/main.d.ts" />

import program = require('commander');
import net = require('net');
import fs = require('fs');
import SocketMessenger = require("../transport/messenger");
import Client = require("../client/client");
import Logger = require('../utils/logger');
import ConnectionHelper = require("../transport/connection");
import request = require("request");
import {debugFor, loggerFor} from "../utils/logger";
import {ConnectionServer} from "../transport/connection_server";
import {Messenger} from "../transport/messenger";
import {getActiveConnection, Connection} from "../transport/connection";

const logger = loggerFor("CLI");
const debug = debugFor("syncrow:cli");

program.version('0.0.2')
    .option('-h, --host <host>', 'remote host for connection', '0.0.0.0')
    .option('-p, --port <port>', 'remote port for connection')
    .option('-c, --local <local>', 'local port for listening')
    .option('-b, --bucket <bucket>', 'bucket name')
    .option('-l, --listen', 'listen for connections')
    .option('-d, --directory <directory>', 'directory to watch', '.')
    .parse(process.argv);


debug(`host: ${program.host}`);
debug(`port: ${program.port}`);
debug(`localPort: ${program.local}`);
debug(`listen: ${program.listen}`);
debug(`directory: ${program.directory}`);
debug(`bucket: ${program.bucket}`);

if (program.bucket) {
    if (!program.port) {
        throw new Error('Port required to connect');
    }

    debug(`requesting port for bucket: ${program.bucket}`);

    request({
        url: `http://${program.host}:${program.port}/bucket/${program.bucket}/port`,
        json: true
    }, (err, res, body)=> {
        if (err) throw err;
        if (res.statusCode !== 200) throw new Error(`Invalid response code ${res.statusCode}`);

        debug(`got host/port for bucket: ${program.bucket}`);

        start(body.port, body.host, false, program.directory);
    });

} else {
    start(program.port, program.host, program.listen, program.directory, program.local)
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

    const messenger = new Messenger(connection);
    new Client(program.directory, messenger);
}
