"use strict";
var Client = require('./client');
var DIRECTORY = '/tmp/syncrow';
console.log("client watching directory: " + DIRECTORY);
var client = new Client(DIRECTORY);
client.connect('', 1234);
//# sourceMappingURL=test_client.js.map