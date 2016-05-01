/// <reference path="../../typings/main.d.ts" />
"use strict";
var program = require('commander');
var SocketMessenger = require("../socket_messenger");
var Client = require("../client");
var Logger = require('../helpers/logger');
var ConnectionHelper = require("../helpers/connection_helper");
var logger = Logger.getNewLogger('CLI');
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
//TODO add verbose support
var connectionHelper = new ConnectionHelper(program.port, program.host, program.server);
var socketMessenger = new SocketMessenger(connectionHelper);
new Client(program.directory, socketMessenger);
//# sourceMappingURL=command_line_tool.js.map