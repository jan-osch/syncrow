"use strict";

import Client= require('./../src/client');
import SocketMessenger = require("../src/socket_messenger");

let directoryToWatch ='../testdir';
console.log(`client watching directory: ${directoryToWatch}`);

let socketMessenger = new SocketMessenger('192.168.99.1', 1234);

new Client(directoryToWatch, socketMessenger);