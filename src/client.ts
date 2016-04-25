/// <reference path="../typescript-interfaces/node.d.ts" />

import fs = require('fs');
import net = require('net');
import SocketMessenger= require('./socket_messenger');


class Client {
    socketMessenger:SocketMessenger;
    directoryToWatch:string;
    eventActionMap:Object;
    static events = {
        error: 'error',
        changed: 'changed',
        fileSocket: 'fileSocket',
        getFile: 'getFile'
    };

    constructor(directoryToWatch) {
        this.directoryToWatch = directoryToWatch;
        this.socketMessenger = null;
        this.eventActionMap = {};
        this.createDirectoryWatcher(directoryToWatch);
        this.createMapOfKnownEvents();
    }

    createDirectoryWatcher(directoryToWatch) {
        return fs.watch(directoryToWatch, {recursive: true}).on('change', (event, fileName)=> {
            console.log(`file changed: ${fileName}`);
            this.emitFileChanged(fileName);
        })
    }

    emitFileChanged(fileName:string) {
        this.writeEventToSocketMessenger(this.socketMessenger, Client.events.changed, fileName);
    }

    public connect(host:string, port:number) {
        this.socketMessenger = new SocketMessenger(host, port);
        this.socketMessenger.on(SocketMessenger.messageEvent, (message:string)=>this.routeEvent(this.socketMessenger, message))
    }

    routeEvent(socket:SocketMessenger, message:string) {
        let event = this.parseEvent(socket, message);
        if (!event) return;

        console.log(`got message ${message}`);

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

    static createEvent(type, body):string {
        return JSON.stringify({
            type: type,
            body: body
        });
    }

    writeEventToSocketMessenger(socket:SocketMessenger, type:string, message:any) {
        socket.writeData(Client.createEvent(type, message));
    }

    sendFileToSocket(socket:SocketMessenger, file:string) {
        let fileTransferServer = net.createServer((fileTransferSocket)=> {
            fs.createReadStream(this.createAbsolutePath(file)).pipe(fileTransferSocket);
        }).listen(()=> {
            this.writeEventToSocketMessenger(socket, Client.events.fileSocket, {
                file: file,
                address: fileTransferServer.address()
            });
        });
    }

    createAbsolutePath(file):string {
        return `${this.directoryToWatch}/${file}`;
    }

    consumeFileFromNewSocket(fileName, address) {
        let fileTransferClient = net.connect(address, ()=> {
            console.log('created new transfer socket');
            fileTransferClient.on('end', ()=> {
                console.log('finished file transfer');
            });
            fileTransferClient.pipe(fs.createWriteStream(this.createAbsolutePath(fileName)));
        })
    }

    createMapOfKnownEvents() {
        this.addEventToKnownMap(Client.events.getFile, (socket, event)=> {
            console.log(`received a getFile: ${event.body.toString()}`);
            this.sendFileToSocket(socket, event.body)
        });
        this.addEventToKnownMap(Client.events.changed, (socket, event)=> {
            console.log(`received a changed: ${event.body.toString()}`);
            this.writeEventToSocketMessenger(socket, Client.events.getFile, event.body);
        });
        this.addEventToKnownMap(Client.events.fileSocket, (socket, event)=> {
            console.log(`received a fileSocket: ${event.body.toString()}`);
            this.consumeFileFromNewSocket(event.body.file, event.body.address);
        });
    }

    addEventToKnownMap(key:string, listener:Function) {
        this.eventActionMap[key] = listener;
    }
}

export  = Client;