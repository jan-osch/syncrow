/// <reference path="../../typings/main.d.ts" />

import program = require('commander');
import net = require('net');
import fs = require('fs');
import SocketMessenger = require("../helpers/messenger");
import Client = require("../client/client");
import Logger = require('../helpers/logger');
import ConnectionHelper = require("../helpers/connection");
import request = require("request");

let logger = Logger.getNewLogger('CLI');

const debug = require("debug")("syncrow:cli");
//TODO add support for direct connection

program.version('0.0.2')
    .option('-h, --host <host>', 'host for connection', '0.0.0.0')
    .option('-p, --port <port>', 'port for connection')
    .option('-b, --bucket <bucket>', 'bucket name')
    .option('-l, --listen', 'listen for connections')
    .option('-d, --directory <directory>', 'directory to watch', '.')
    .parse(process.argv);


debug(`host: ${program.host}`);
debug(`port: ${program.port}`);
debug(`listen: ${program.listen}`);
debug(`directory: ${program.directory}`);
debug(`bucket: ${program.bucket}`);

if (program.bucket) {
    if(!program.port){
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
    start(program.port, program.host, program.listen, program.directory)
}


function start(port:number, host:string, listen:boolean, directory:string) {
    let connectionHelper = new ConnectionHelper(port, host, listen);
    let socketMessenger = new SocketMessenger(connectionHelper);
    new Client(directory, socketMessenger);
}

