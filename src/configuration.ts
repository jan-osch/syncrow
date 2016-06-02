/// <reference path="../typings/main.d.ts" />
import *  as fs from "fs";

const configuration = JSON.parse(fs.readFileSync(__dirname + '/../config/config.json'));

export default configuration;
