/// <reference path="../../typings/main.d.ts" />

import program = require('commander');
import net = require('net');
import fs = require('fs');
import SocketMessenger = require("../helpers/messenger");
import Client = require("../client/client");
import Logger = require('../helpers/logger');
import ConnectionHelper = require("../helpers/connection_helper");

let logger = Logger.getNewLogger('CLI');

program.version('0.0.1')
    .option('-h, --host <host>', 'host for connection', '0.0.0.0')
    .option('-p, --port <port>', 'port for connection', 1234)
    .option('-s, --bucket', 'start as bucket')
    .option('-d, --directory <directory>', 'directory to watch', '.')
    .parse(process.argv);


logger.debug(`host: ${program.host}`);
logger.debug(`port: ${program.port}`);
logger.debug(`server: ${program.server}`);
logger.debug(`directory: ${program.directory}`);

//TODO add verbose support

let connectionHelper = new ConnectionHelper(program.port, program.host, program.server);
let socketMessenger = new SocketMessenger(connectionHelper);
new Client(program.directory, socketMessenger);

