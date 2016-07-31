/// <reference path="../typings/globals/node/index.d.ts" />
/// <reference path="../typings/index.d.ts" />

export const Config ={
    fileContainer:{
        watchTimeout:100,
        processedFilesLimit:300
    },
    client:{
        socketsLimit:300
    },
    connectionHelper:{
        reconnectionInterval:3000
    },
    server:{
        transferQueueSize:1000
    },
    transferHelper:{
        transferQueueSize:1999
    }
};


