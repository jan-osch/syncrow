/// <reference path="../../typings/main.d.ts" />
"use strict";
var program = require('commander');
var net = require('net');
var SocketMessenger = require("../socket_messenger");
var Client = require("../client");
var logger = require('../logger');
program.version('0.0.1')
    .option('-h, --host <host>', 'host for connection', '0.0.0.0')
    .option('-p, --port <port>', 'port for connection', 1234)
    .option('-s, --server', 'start as server')
    .option('-d, --directory <directory>', 'directory to watch', '.')
    .parse(process.argv);
logger.debug("host: " + program.host);
logger.debug("port: " + program.port);
logger.debug("server: " + program.server);
logger.debug("directory: " + program.directory);
if (program.server) {
    net.createServer(function (socket) {
        logger.info('connected');
        var socketMessenger = new SocketMessenger(null, null, socket);
        new Client(program.directory, socketMessenger);
    }).listen({ port: program.port }, function () {
        logger.info("server listening on port: " + program.port);
    });
}
else {
    var socketMessenger = new SocketMessenger(program.host, program.port);
    new Client(program.directory, socketMessenger);
}
//# sourceMappingURL=command_line_tool.js.map