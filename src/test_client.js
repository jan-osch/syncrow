"use strict";

var code = require('./server_client');

const DIRECTORY = process.argv[2];
console.log(`client watching directory: ${DIRECTORY}`);
let client = new code.Client(DIRECTORY);

client.connect('', 1234);