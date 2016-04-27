"use strict";
var Client = require('./../src/client');
var net = require('net');
var SocketMessenger = require("../src/socket_messenger");
var directoryToWatch = '/tmp/syncrow';
console.log("client watching directory: " + directoryToWatch);
net.createServer(function (socket) {
    console.log('connected');
    var socketMessenger = new SocketMessenger(null, null, socket);
    new Client(directoryToWatch, socketMessenger);
}).listen({ port: 1234 });
//# sourceMappingURL=test_client.js.map