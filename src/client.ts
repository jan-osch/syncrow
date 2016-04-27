/// <reference path="../typescript-interfaces/node.d.ts" />

import fs = require('fs');
import net = require('net');
import SocketMessenger= require('./socket_messenger');
import FileContainer = require("./file_container");


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
        metaData: 'metaData'
    };

    constructor(directoryToWatch) {
        this.socketMessenger = null;
        this.filesToSync = {};
        this.eventActionMap = {};
        this.fileContainer = this.createDirectoryWatcher(directoryToWatch);
        this.createMapOfKnownEvents();
    }

    createDirectoryWatcher(directoryToWatch):FileContainer {
        var that = this;
        var fileContainer = new FileContainer(directoryToWatch);

        [FileContainer.events.changed, FileContainer.events.deleted, FileContainer.events.created]
            .forEach((eventName)=> {
                fileContainer.on(eventName, (eventContent:any)=> {
                    that.writeEventToSocketMessenger(that.socketMessenger, eventName, eventContent);
                });
            });

        fileContainer.on(FileContainer.events.metaComputed, (metaData)=> {
            that.addSyncMetaDataFromOwnContainer(metaData);
        });

        return fileContainer
    }

    public connect(host:string, port:number) {
        this.socketMessenger = new SocketMessenger(host, port);
        this.socketMessenger.on(SocketMessenger.messageEvent, (message:string)=>this.routeEvent(this.socketMessenger, message));
    }

    private syncAfterConnectionReestablished() {
        this.fileContainer.recomputeMetaDataForDirectory();
        this.writeEventToSocketMessenger(this.socketMessenger, Client.events.getMeta);
    }

    private addSyncMetaDataFromOtherParty(syncData:{hashCode:string, modified:Date, name:string}) {
        if (this.filesToSync[syncData.name]) {
            this.compareSyncMetaData(this.filesToSync[syncData.name], syncData);
            delete this.filesToSync[syncData.name];
        }
    }

    private addSyncMetaDataFromOwnContainer(syncData:{hashCode:string, modified:Date, name:string}) {
        if (this.filesToSync[syncData.name]) {
            this.compareSyncMetaData(syncData, this.filesToSync[syncData.name]);
            delete this.filesToSync[syncData.name];
        }
    }

    private compareSyncMetaData(ownMeta:{hashCode:string, modified:Date, name:string}, otherPartyMeta:{hashCode:string, modified:Date, name:string}) {
        Client.checkMetaDataFileIsTheSame(ownMeta, otherPartyMeta);
        if (otherPartyMeta.hashCode !== ownMeta.hashCode) {
            if (otherPartyMeta.modified.getTime() > ownMeta.modified.getTime()) {
                this.writeEventToSocketMessenger(this.socketMessenger, Client.events.getFile, ownMeta.name);
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

        console.log(`got message ${message}`); // debug

        if (this.eventActionMap[event['type']]) {
            return this.eventActionMap[event['type']](socket, event);
        }

        this.writeEventToSocketMessenger(socket, Client.events.error, 'unknown event type');
    }

    parseEvent(socket:SocketMessenger, message:string):Object {
        try {
            return JSON.parse(message.toString());
        } catch (e) {
            this.writeEventToSocketMessenger(socket, Client.events.error, 'bad event');
        }
    }

    static createEvent(type:string, body?:any):string {
        body = body || {};
        return JSON.stringify({
            type: type,
            body: body
        });
    }

    writeEventToSocketMessenger(socket:SocketMessenger, type:string, message?:any) {
        socket.writeData(Client.createEvent(type, message));
    }

    sendFileToSocket(socket:SocketMessenger, file:string) {
        let fileTransferServer = net.createServer((fileTransferSocket)=> {
            this.fileContainer.getReadStreamForFile(file).pipe(fileTransferSocket);
        }).listen(()=> {
            this.writeEventToSocketMessenger(socket, Client.events.fileSocket, {
                file: file,
                address: fileTransferServer.address()
            });
        });
    }


    consumeFileFromNewSocket(fileName:string, address) {
        let fileTransferClient = net.connect(address, ()=> {
            console.log('created new transfer socket');
            fileTransferClient.on('end', ()=> {
                console.log('finished file transfer');
            });
            this.fileContainer.consumeFileStream(fileName, fileTransferClient);
        })
    }

    createMapOfKnownEvents() {
        this.addEventToKnownMap(Client.events.getFile, (socket, event)=> {
            console.log(`received a getFile: ${event.body.toString()}`);
            this.sendFileToSocket(socket, event.body)
        });


        this.addEventToKnownMap(FileContainer.events.created, (socket, event)=> {
            console.log(`received create event: ${event.body.toString()}`);
            this.writeEventToSocketMessenger(socket, Client.events.getFile, event.body);
        });
        this.addEventToKnownMap(FileContainer.events.changed, (socket, event)=> {
            console.log(`received changed event: ${event.body.toString()}`);
            this.writeEventToSocketMessenger(socket, Client.events.getFile, event.body);
        });
        this.addEventToKnownMap(FileContainer.events.deleted, (socket, event)=> {
            console.log(`received a delete event: ${event.body.toString()}`);
            this.fileContainer.deleteFile(event.body);
        });

        this.addEventToKnownMap(Client.events.metaData, (socket, event)=> {
            console.log(`received metaData: ${event.body.toString()}`);
            this.addSyncMetaDataFromOtherParty(event.body);
        });
    }

    addEventToKnownMap(key:string, listener:Function) {
        this.eventActionMap[key] = listener;
    }
}

export  = Client;