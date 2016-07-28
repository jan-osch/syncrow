/// <reference path="../typings/globals/node/index.d.ts" />
import *  as fs from "fs";

const configuration:Config = JSON.parse(fs.readFileSync(__dirname + '/../config/config.json', 'utf8'));

interface Config {
    fileContainer:{
        watchTimeout:number,
        processedFilesLimit:number
    },
    client:{
        socketsLimit:number
    },
    connectionHelper:{
        reconnectionInterval:number
    },
    server:{
        transferQueueSize:number
    },
    transferHelper:{
        transferQueueSize:number
    }
}


export default configuration;
