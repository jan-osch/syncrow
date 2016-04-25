"use strict";
var Server = require('./server');
var DIRECTORY = __dirname + '/../testdir';
console.log("server watching directory: " + DIRECTORY);
var server = new Server(DIRECTORY, 1234);
//# sourceMappingURL=test_server.js.map