
/// <reference path="../../typings/main.d.ts" />


import program = require('commander');
import net = require('net');
import fs = require('fs');
import SocketMessenger = require("../socket_messenger");
import Client = require("../client");
import logger = require('../logger');

program.version('0.0.1')
    .option('-h, --host <host>', 'host for connection', '0.0.0.0')
    .option('-p, --port <port>', 'port for connection', 1234)
    .option('-s, --server', 'start as server')
    .option('-d, --directory <directory>', 'directory to watch', '.')
    .parse(process.argv);


logger.debug(`host: ${program.host}`);
logger.debug(`port: ${program.port}`);
logger.debug(`server: ${program.server}`);
logger.debug(`directory: ${program.directory}`);

if (program.server) {
    net.createServer((socket)=> {
        logger.info('connected');
        let socketMessenger = new SocketMessenger(null, null, socket);
        new Client(program.directory, socketMessenger);

    }).listen({port: program.port}, ()=> {
        logger.info(`server listening on port: ${program.port}`)
    });

} else {
    let socketMessenger = new SocketMessenger(program.host, program.port);
    new Client(program.directory, socketMessenger);
}


