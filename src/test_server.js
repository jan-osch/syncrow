"use strict";
const code = require('./server_client');

new code.Server(__dirname + '/../testdir', 1234);