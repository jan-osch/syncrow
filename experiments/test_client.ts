"use strict";
import Client = require('./../src/client');
import net = require('net');
import SocketMessenger = require("../src/socket_messenger");

const directoryToWatch = '/tmp/syncrow';
console.log(`client watching directory: ${directoryToWatch}`);

net.createServer((socket)=>{
    console.log('connected');
    let socketMessenger = new SocketMessenger(null, null, socket);
    new Client(directoryToWatch, socketMessenger);

}).listen({port: 1234});





