"use strict";
var Client = require('./../src/client');
var SocketMessenger = require("../src/socket_messenger");
var directoryToWatch = '../testdir';
console.log("client watching directory: " + directoryToWatch);
var socketMessenger = new SocketMessenger('0.0.0.0', 1234);
new Client(directoryToWatch, socketMessenger);
//# sourceMappingURL=test_client_2.js.map