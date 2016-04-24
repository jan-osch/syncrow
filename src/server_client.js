"use strict";
const fs = require('fs');
const net = require('net');

class Client {
    constructor(directoryToWatch) {
        this.directoryToWatch = directoryToWatch;
        this.mainSocket = null;
        this.messageBuffer = {};
        this.createDirectoryWatcher(directoryToWatch);
        this.knownEvents = {};
        this.createMapOfKnownEvents();
    }

    createDirectoryWatcher(directoryToWatch) {
        return fs.watch(directoryToWatch, {recursive: true}).on('change', (event, fileName)=> {
            console.log(`file changed: ${fileName}`);
            this.emitFileChanged(fileName);
        })
    }

    emitFileChanged(fileName) {
        this.writeEventToSocket(this.mainSocket, 'changed', fileName);
    }

    connect(host, port) {
        this.mainSocket = net.connect(port, host, ()=> {
            this.mainSocket.on('data', (data)=> {
                this.consumeBytesTransferred(this.mainSocket, data);
                this.routeEvent(this.mainSocket, data)
            })
        })
    }

    routeEvent(socket, data) {
        let event = this.parseEvent(data, socket);
        if (!event) return;

        console.log(`got message ${event}`);

        if (this.knownEvents[event.type]) {
            return this.knownEvents[event.type](socket, event);
        }

        this.writeEventToSocket(socket, 'err', 'unknown event type');
    }

    parseEvent(data, socket) {
        try {
            let event = JSON.parse(data.toString());
        } catch (e) {
            this.writeEventToSocket(socket, 'err', 'bad event');
        }
    }

    static createEvent(type, body) {
        return {
            type: type,
            message: body
        }
    }

    writeEventToSocket(socket, type, message) {
        socket.write(Client.createEvent(type, message).toString());
    }

    sendFileToSocket(socket, file) {
        let fileTransferServer = net.createServer((fileTransferSocket)=> {
            fs.createReadStream(this.createAbsolutePath(file)).pipe(fileTransferSocket);
        }).listen(()=> {
            this.writeEventToSocket(socket, 'fileSocket', {file: file, address: fileTransferServer.address()});
        });
    }

    createAbsolutePath(file) {
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
        this.addEventToKnownMap('get', (socket, event)=> {
            this.sendFileToSocket(socket, event.message)
        });
        this.addEventToKnownMap('changed', (socket, event)=> {
            this.writeEventToSocket(socket, 'get', event.message);
        });
        this.addEventToKnownMap('fileSocket', (socket, event)=> {
            this.consumeFileFromNewSocket(event.message.file, event.message.address);
        });
    }

    addEventToKnownMap(key, listener) {
        this.knownEvents[key] = listener;
    }

    consumeBytesTransferred(socket, data) {
        this.
    }
}

class Server extends Client {

    constructor(directoryToWatch, mainPort) {
        super(directoryToWatch);
        this.clients = [];
        this.socketServer = this.createSocketServer(mainPort);
    }

    emitFileChanged(fileName) {
        this.clients.forEach((socket)=> {
            this.writeEventToSocket(socket, 'changed', fileName);
        });
    }

    addNewClient(socket) {
        console.info('new client connected');
        this.clients.push(socket);
        socket.on('data', (data) =>this.routeEvent(socket, data))
    }

    createSocketServer(mainPort) {
        return net.createServer((socket)=>this.addNewClient(socket)).listen(mainPort, ()=> {
            console.log(`started listening on port ${mainPort}`);
        })
    }
}


exports.Client = Client;
exports.Server = Server;