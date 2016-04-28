/// <reference path="../typings/main.d.ts" />

import fs = require('fs');
import net = require('net');
import SocketMessenger= require('./socket_messenger');
import FileContainer = require("./file_container");
import logger = require('./logger');

//TODO add support syncing after reestablishing connection
class Client {
    socketMessenger:SocketMessenger;
    fileContainer:FileContainer;
    eventActionMap:Object;
    filesToSync:Object;

    static events = {
        error: 'error',
        fileSocket: 'fileSocket',
        getFile: 'getFile',
        getMeta: 'getMeta',
        metaData: 'metaData',
        createDirectory: 'createDirectory'
    };

    constructor(directoryToWatch:string, socketMessenger:SocketMessenger) {
        this.filesToSync = {};
        this.eventActionMap = {};
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
                    logger.debug(`got event: ${eventName}`); //debug
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
            this.syncAfterConnectionReestablished();
        });
        return socketMessenger;
    }

    private syncAfterConnectionReestablished() {
        this.fileContainer.recomputeMetaDataForDirectory();
        Client.writeEventToSocketMessenger(this.socketMessenger, Client.events.getMeta);
    }

    private addSyncMetaDataFromOtherParty(syncData:{hashCode:string, modified:Date, name:string}) {
        if (this.filesToSync[syncData.name]) {
            this.compareSyncMetaData(this.filesToSync[syncData.name], syncData);
            return delete this.filesToSync[syncData.name];
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
        let event = this.parseEvent(socket, message);
        if (!event) return;

        if (this.eventActionMap[event['type']]) {
            return this.eventActionMap[event['type']](socket, event);
        }

        Client.writeEventToSocketMessenger(socket, Client.events.error, `unknown event type: ${event.type}`);
    }

    parseEvent(socket:SocketMessenger, message:string):{type:string, body?:any} {
        try {
            return JSON.parse(message.toString());
        } catch (e) {
            Client.writeEventToSocketMessenger(socket, Client.events.error, 'bad event');
        }
    }

    static createEvent(type:string, body?:any):string {
        body = body || {};
        return JSON.stringify({
            type: type,
            body: body
        });
    }

    static writeEventToSocketMessenger(socket:SocketMessenger, type:string, message?:any) {
        logger.debug(`writing to socket event: ${type} with body: ${JSON.stringify(message)}`);
        socket.writeData(Client.createEvent(type, message));
    }

    sendFileToSocket(socket:SocketMessenger, file:string) {
        let fileTransferServer = net.createServer((fileTransferSocket)=> {
            this.fileContainer.getReadStreamForFile(file).pipe(fileTransferSocket);
        }).listen(()=> {
            let address =fileTransferServer.address();
            address.host = this.socketMessenger.getOwnHost();
            Client.writeEventToSocketMessenger(socket, Client.events.fileSocket, {
                file: file,
                address: address
            });
        });
    }


    createMapOfKnownEvents() {
        this.addClientEvents();
        this.addFileContainerEvents();
    }

    private addClientEvents() {
        this.addEventToKnownMap(Client.events.getFile, (socket, event)=> {
            logger.debug(`received a getFile: ${JSON.stringify(event.body)}`);
            this.sendFileToSocket(socket, event.body)
        });
        this.addEventToKnownMap(Client.events.metaData, (socket, event)=> {
            logger.debug(`received metaData: ${JSON.stringify(event.body)}`);
            this.addSyncMetaDataFromOtherParty(event.body);
        });
        this.addEventToKnownMap(Client.events.getMeta, (socket, event)=> {
            logger.debug(`received getMeta: ${JSON.stringify(event.body)}`);
            this.fileContainer.recomputeMetaDataForDirectory();
        });
        this.addEventToKnownMap(Client.events.fileSocket, (socket, event)=> {
            logger.debug(`received fileSocket: ${JSON.stringify(event.body)}`);
            this.consumeFileFromNewSocket(event.body.file, event.body.address);
        });
        this.addEventToKnownMap(Client.events.error, (socket, event)=> {
            logger.debug(`received error message ${JSON.stringify(event.body)}`)
        });
    }

    private addFileContainerEvents() {
        this.addEventToKnownMap(FileContainer.events.created, (socket, event)=> {
            logger.debug(`received create event: ${JSON.stringify(event.body)}`);
            Client.writeEventToSocketMessenger(socket, Client.events.getFile, event.body);
        });
        this.addEventToKnownMap(FileContainer.events.createdDirectory, (socket, event)=> {
            logger.debug(`received create event: ${JSON.stringify(event.body)}`);
            this.fileContainer.createDirectory(event.body);
        });
        this.addEventToKnownMap(FileContainer.events.changed, (socket, event)=> {
            logger.debug(`received changed event: ${JSON.stringify(event.body)}`);
            Client.writeEventToSocketMessenger(socket, Client.events.getFile, event.body);
        });
        this.addEventToKnownMap(FileContainer.events.deleted, (socket, event)=> {
            logger.debug(`received a delete event: ${JSON.stringify(event.body)}`);
            this.fileContainer.deleteFile(event.body);
        });
    }

    consumeFileFromNewSocket(fileName:string, address) {
        let fileTransferClient = net.connect(address, ()=> {
            logger.info(`created new transfer socket, file: ${fileName}`);
            console.time(fileName+ ' transfer');
            fileTransferClient.on('end', ()=> {
                logger.info(`finished file transfer, file: ${fileName}`);
                console.timeEnd(fileName+ ' transfer');
            });
            this.fileContainer.consumeFileStream(fileName, fileTransferClient);
        })
    }

    private addEventToKnownMap(key:string, listener:Function) {
        this.eventActionMap[key] = listener;
    }
}

export  = Client;