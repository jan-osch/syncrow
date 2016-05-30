/// <reference path="../typings/main.d.ts" />

export = {
    fileContainer: {
        watchTimeout: 50,
        processedFilesLimit: 500,
        directoryHashConstant: 'directory',
        logLevel: 3
    },
    client: {
        socketsLimit: 30,
        logLevel: 3
    },
    connectionHelper: {
        reconnectionInterval: 4000,
        logLevel: 3,
    }
};