/// <reference path="../typings/main.d.ts" />
const fs = require('fs');
const configuration = JSON.parse(fs.readFileSync(__dirname+'/../config/config.json'));

export = configuration;
