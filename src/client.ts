/// <reference path="../typings/main.d.ts" />

import fs = require('fs');
import net = require('net');
import SocketMessenger= require('./messenger');
import FileContainer = require("./file_container");
import Logger = require('./helpers/logger');
import {LimitedAsyncQueue} from "./helpers/limited_async_queue";
import Configuration = require('./configuration');

let logger = Logger.getNewLogger('Client', Configuration.client.logLevel);
const debug = require('debug')('client');

//TODO add support syncing after reestablishing connection
//TODO add support for deleting offline
//TODO Strategies for offline loading
//TODO extract the common parts of client and server


class Client {
    socketMessenger:SocketMessenger;
    fileContainer:FileContainer;
    eventActionMap:Object;
    filesToSync:Object;
    socketsQueue:LimitedAsyncQueue;

    static events = {
        error: 'error',
        fileSocket: 'fileSocket',
        getFile: 'getFile',
        pullFile: 'pullFile',
        getMeta: 'getMeta',
        metaData: 'metaData',
        createDirectory: 'createDirectory'
    };

    constructor(directoryToWatch:string, socketMessenger:SocketMessenger, socketsLimit = Configuration.client.socketsLimit) {
        this.filesToSync = {};
        this.eventActionMap = {};
        this.socketsQueue = new LimitedAsyncQueue(socketsLimit);
        this.fileContainer = this.createDirectoryWatcher(directoryToWatch);
        this.createMapOfKnownEvents();
        this.socketMessenger = this.addSocketMessenger(socketMessenger);
    }

    createDirectoryWatcher(directoryToWatch):FileContainer {
        var that = this;
        var fileContainer = new FileContainer(directoryToWatch);

        [FileContainer.events.changed, FileContainer.events.deleted, FileContainer.events.created, FileContainer.events.createdDirectory]
            .forEach((eventName)=> {
                fileContainer.on(eventName, (eventContent:any)=> {
                    logger.debug(`got event: ${eventName}`);
                    Client.writeEventToSocketMessenger(that.socketMessenger, eventName, eventContent);
                });
            });

        fileContainer.on(FileContainer.events.metaComputed, (metaData)=> {
            that.addSyncMetaDataFromOwnContainer(metaData);
            Client.writeEventToSocketMessenger(that.socketMessenger, Client.events.metaData, metaData);
        });

        fileContainer.getListOfTrackedFilesAndBeginWatching();

        return fileContainer;
    }

    public addSocketMessenger(socketMessenger:SocketMessenger) {
        socketMessenger.on(SocketMessenger.events.message, (message:string)=>this.routeEvent(this.socketMessenger, message));
        socketMessenger.on(SocketMessenger.events.connected, ()=> {
            logger.info('connected with other party beginning to sync');
            this.fileContainer.recomputeMetaDataForDirectory();
        });
        socketMessenger.on(SocketMessenger.events.disconnected, ()=>logger.info('disconnected, waiting for reconnection'));
        return socketMessenger;
    }

    private addSyncMetaDataFromOtherParty(syncData:{hashCode:string, modified:Date, name:string}):void {
        if (this.filesToSync[syncData.name]) {
            this.compareSyncMetaData(this.filesToSync[syncData.name], syncData);
            delete this.filesToSync[syncData.name];
            return;

        } else if (syncData.hashCode === FileContainer.directoryHashConstant && !this.fileContainer.isFileInContainer(syncData.name)) {
            return this.fileContainer.createDirectory(syncData.name);

        } else if (!this.fileContainer.isFileInContainer(syncData.name)) {
            return this.sendGetFileEvent(syncData.name);
        }
    }

    private sendGetFileEvent(fileName:string) {
        Client.writeEventToSocketMessenger(this.socketMessenger, Client.events.getFile, fileName);
    }

    private addSyncMetaDataFromOwnContainer(syncData:{hashCode:string, modified:Date, name:string}) {
        if (this.filesToSync[syncData.name]) {
            this.compareSyncMetaData(syncData, this.filesToSync[syncData.name]);
            delete this.filesToSync[syncData.name];
        }
    }

    private compareSyncMetaData(ownMeta:{hashCode:string, modified:Date, name:string}, otherPartyMeta:{hashCode:string, modified:Date, name:string}) {
        Client.checkMetaDataFileIsTheSame(ownMeta, otherPartyMeta);
        if (otherPartyMeta.hashCode !== ownMeta.hashCode && ownMeta.hashCode) {
            if (otherPartyMeta.modified.getTime() > ownMeta.modified.getTime()) {
                this.sendGetFileEvent(ownMeta.name);
            }
        }
    }

    private static checkMetaDataFileIsTheSame(ownMeta:{hashCode:string; modified:Date; name:string}, otherPartyMeta:{hashCode:string; modified:Date; name:string}) {
        if (ownMeta.name !== otherPartyMeta.name) {
            throw new Error('comparing not matching metadata')
        }
    }

    routeEvent(socket:SocketMessenger, message:string) {
        let event = Client.parseEvent(socket, message);
        if (!event) return;

        if (this.eventActionMap[event['type']]) {
            return this.eventActionMap[event['type']](socket, event);
        }

        Client.writeEventToSocketMessenger(socket, Client.events.error, `unknown event type: ${event.type}`);
    }

    static parseEvent(socket:SocketMessenger, message:string):{type:string, body?:any} {
        try {
            return JSON.parse(message.toString());
        } catch (e) {
            Client.writeEventToSocketMessenger(socket, Client.events.error, 'bad event');
        }
    }

    static createEvent(type:string, body = {}):string {
        return JSON.stringify({
            type: type,
            body: body
        });
    }

    static writeEventToSocketMessenger(socket:SocketMessenger, type:string, message?:any) {
        socket.writeMessage(Client.createEvent(type, message));
    }

    sendFileWhenSocketIsAvailable(socket:SocketMessenger, file:string) {
        logger.debug(`/sendFileWhenSocketIsAvailable - file should be send: ${file}`);
        this.socketsQueue.add((callback)=>this.sendFileToSocket(socket, file, callback))
    }

    sendFileToSocket(socket:SocketMessenger, file:string, callback) {
        let fileTransferServer = net.createServer((fileTransferSocket)=> {
            logger.timeDebug(`transferring file ${file}`);
            fileTransferSocket.on('end', ()=> Client.handleFileTransferFinished(file, callback));

            this.fileContainer.getReadStreamForFile(file).pipe(fileTransferSocket);

        }).listen(()=> {
            let address = {
                port: fileTransferServer.address().port,
                host: this.socketMessenger.getOwnHost()
            };

            Client.writeEventToSocketMessenger(socket, Client.events.fileSocket, {
                file: file,
                address: address
            });
        });
    }

    private static handleFileTransferFinished(file:string, callback) {
        logger.timeEndDebug(`transferring file ${file}`);
        callback();
    }

    pushFileToNewSocket(address:Object, file:string, fileContainer:FileContainer, callback) {
        let fileTransferSocket = net.createConnection(address, ()=> {

            debug(`Other party connected, beginning to push the file: ${file} to socket`);

            fileTransferSocket.on('end', callback);

            fileContainer.getReadStreamForFile(file).pipe(fileTransferSocket);
        });
    }

    createMapOfKnownEvents() {
        this.addClientEvents();
        this.addFileContainerEvents();
    }

    private addClientEvents() {
        this.addEventToKnownMap(Client.events.getFile, (socket, event)=> {
            logger.debug(`/otherClientEvents - received a getFile: ${JSON.stringify(event.body)}`);
            this.sendFileWhenSocketIsAvailable(socket, event.body);
        });

        this.addEventToKnownMap(Client.events.pullFile, (socket, event)=> {
            this.pushFileToNewSocket(event.body.address, event.body.name, this.fileContainer, ()=> {
            }); //TODO proper callback
        });
        this.addEventToKnownMap(Client.events.metaData, (socket, event)=> {
            logger.debug(`/otherClientEvents - received metaData for file:${event.body.name}`);
            this.addSyncMetaDataFromOtherParty(event.body);
        });
        this.addEventToKnownMap(Client.events.getMeta, (socket, event)=> {
            logger.debug(`/otherClientEvents - received getMeta: ${JSON.stringify(event.body)}`);
            this.fileContainer.recomputeMetaDataForDirectory();
        });
        this.addEventToKnownMap(Client.events.fileSocket, (socket, event)=> {
            logger.debug(`/otherClientEvents - received fileSocket: ${JSON.stringify(event.body)}`);
            this.consumeFileFromNewSocket(event.body.file, event.body.address);
        });
        this.addEventToKnownMap(Client.events.error, (socket, event)=> {
            logger.debug(`/otherClientEvents - received error message ${JSON.stringify(event.body)}`)
        });
    }

    private addFileContainerEvents() {
        this.addEventToKnownMap(FileContainer.events.created, (socket, event)=> {
            logger.debug(`/fileContainerEvents -received create event: ${JSON.stringify(event.body)}`);
            Client.writeEventToSocketMessenger(socket, Client.events.getFile, event.body);
        });
        this.addEventToKnownMap(FileContainer.events.createdDirectory, (socket, event)=> {
            logger.debug(`/fileContainerEvents -received create event: ${JSON.stringify(event.body)}`);
            this.fileContainer.createDirectory(event.body);
        });
        this.addEventToKnownMap(FileContainer.events.changed, (socket, event)=> {
            logger.debug(`/fileContainerEvents - received changed event: ${JSON.stringify(event.body)}`);
            Client.writeEventToSocketMessenger(socket, Client.events.getFile, event.body);
        });
        this.addEventToKnownMap(FileContainer.events.deleted, (socket, event)=> {
            logger.debug(`/fileContainerEvents - received a delete event: ${JSON.stringify(event.body)}`);
            this.fileContainer.deleteFile(event.body);
        });
    }

    consumeFileFromNewSocket(fileName:string, address) {
        let fileTransferClient = net.connect(address, ()=> {
            logger.info(`/consumeFileFromNewSocket - connected with a new transfer socket, file: ${fileName}`);
            console.time(fileName + ' transfer');

            fileTransferClient.on('end', ()=> {
                logger.info(`consumeFileFromNewSocket - finished file transfer, file: ${fileName}`);
                console.timeEnd(fileName + ' transfer');
            });

            this.fileContainer.consumeFileStream(fileName, fileTransferClient);
        })
    }

    private addEventToKnownMap(key:string, listener:Function) {
        this.eventActionMap[key] = listener;
    }
}

export  = Client;