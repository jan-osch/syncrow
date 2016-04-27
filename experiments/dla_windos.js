"use strict";
var Client = require('./../src/client');
var SocketMessenger = require("../src/socket_messenger");
var directoryToWatch = '../testdir';
console.log("client watching directory: " + directoryToWatch);
var socketMessenger = new SocketMessenger('192.168.99.1', 1234);
new Client(directoryToWatch, socketMessenger);
//# sourceMappingURL=dla_windos.js.map