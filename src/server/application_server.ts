/// <reference path="../../typings/main.d.ts" />


import fs = require("fs");
import FileContainer = require("../helpers/file_container");
import net  = require('net');

import UserService = require('./user_service');
import {Socket, Server} from "net";

import async = require('async');
import _= require('lodash');
import SocketMessenger = require("../helpers/messenger");
import Client = require("../client/client");

const debug = require('debug')('server:server');

class BucketWrapper {
    private port:number;
    private bucketsList:Array<string>;
    private containers:Object;
    private bucketSockets:Object;
    private bucketServers:Object; //TODO change to map string:Server
    private bucketServerPorts:Object;
    private host:string;


    constructor(host:string, port:number, path:string) {
        this.host = host;
        this.bucketsList = this.loadBuckets(path);
        this.containers = this.initializeBuckets(path, this.bucketsList);
        this.bucketSockets = this.createBucketSocketMap(this.bucketsList);


        //TODO add call to initialize sever buckets - > and async other operations
    }

    private loadBuckets(path):Array<string> {
        const buckets = fs.readdirSync(path);

        debug(`loaded ${buckets.length} buckets`);

        return buckets;
    }

    private initializeBuckets(basePath:string, bucketsList:Array<string>):Array<FileContainer> {
        this.containers = {};

        bucketsList.forEach((bucketName)=> {
            this.containers[bucketName] = new FileContainer(`${basePath}/${bucketName}`);
        })
    }

    public getBucketsList(callback:Function) {
        callback(null, this.bucketsList);
    }

    private createBucketSocketMap(bucketsList:Array<string>) {
        const result = {};

        bucketsList.forEach((bucket)=> {
            result[bucket] = [];
        });

        return result;
    }

    public requestSocketForBucket(login:string, passwordHash:string, bucketName:string, callback:Function) {
        if (!UserService.validateCredentials(login, passwordHash)) {
            return callback(new Error('Invalid Credentials'));
        }

        if (this.bucketsList.indexOf(bucketName) === -1) {
            return callback(new Error('Invalid bucket name'));
        }

        return callback(null, this.bucketServerPorts[bucketName]);
    }

    private initializeBucketServers(bucketsList:Array<string>, callback:(err?:Error)=>void) {
        this.bucketServers = {};
        this.bucketServerPorts = {};

        async.each(bucketsList,

            (bucketName, serverListeningCallback)=> {
                const server = net.createServer((socket)=>this.addListenersToSocket(socket, bucketName))
                    .listen(()=> {
                        const port = server.address().port;
                        debug(`socket server for bucket: ${bucketName} is listening for new connetion on port ${port}`);

                        this.bucketServers[bucketName] = server;
                        this.bucketServerPorts[bucketName] = port;

                        serverListeningCallback();
                    });
            },

            callback
        );

    }

    private addListenersToSocket(socket:Socket, bucketName:string) {
        const socketMessenger = new SocketMessenger(null, socket);

        this.bucketSockets[bucketName].push(socketMessenger);

        socketMessenger.once(SocketMessenger.events.disconnected, ()=> {
            debug(`socket disconnected for bucket: ${bucketName}`);

            const index = this.bucketSockets[bucketName].indexOf(socketMessenger);
            this.bucketSockets[bucketName].splice(index, 1);
        });

        socketMessenger.on(SocketMessenger.events.message, (message)=>this.handleEvent(socketMessenger, bucketName, message))


    }

    private handleEvent(socket:SocketMessenger, bucketName:string, message:string) {
        let event = Client.parseEvent(socket, message);


        if (event.type === Client.events.listenAndUpload) {
            this.sendFileToSocket(socket, bucketName, event.body, _.noop);
        }
        if (event.type === FileContainer.events.created) {
            this.pullFileFromParty(socket, event.body, this.containers[bucketName], _.noop);
        }
        if (event.type === FileContainer.events.createdDirectory) {
            this.containers[bucketName].directoryCreated(event.body);
        }
        if (event.type === FileContainer.events.changed) {
            this.pullFileFromParty(socket, event.body, this.containers[bucketName], _.noop);
        }
        if (event.type === FileContainer.events.fileDeleted) {
            this.containers[bucketName].deleteFile(event.body);
        }
        if (event.type === Client.events.fileSocket) {
            this.consumeFileFromNewSocket(this.containers[bucketName], event.body.file, event.body.address, ()=> {

            });
        }
    }

    private pullFileFromParty(otherParty:SocketMessenger, fileName:string, destinationContainer:FileContainer, callback:Function) {
        const filePullingServer = net.createServer(
            (socket)=> BucketWrapper.consumeFileFromSocket(socket, fileName, destinationContainer, callback)
        ).listen(()=> {

            Client.writeEventToOtherParty(otherParty, Client.events.connectAndUpload, {
                file: fileName,
                address: this.getOwnSocketServerAddress(filePullingServer)
            });

        })
    }

    private static consumeFileFromSocket(fileTransferSocket:Socket, fileName:string, destinationContainer:FileContainer, callback:Function) {
        fileTransferSocket.on('end', callback);

        destinationContainer.consumeFileStream(fileName, fileTransferSocket);
    }

    private getOwnSocketServerAddress(socketServer:Server):{port:number, host:string} {
        return {
            port: socketServer.address().port,
            host: this.host
        };
    }

    public sendFileToSocket(otherParty:SocketMessenger, bucketName:string, file:string, callback) {
        let fileTransferServer = net.createServer((fileTransferSocket)=> {

            fileTransferSocket.on('end', callback);

            this.containers[bucketName].getReadStreamForFile(file).pipe(fileTransferSocket);

        }).listen(()=> {
            let address = {
                port: fileTransferServer.address().port,
                host: this.host
            };

            Client.writeEventToOtherParty(otherParty, Client.events.fileSocket, {
                file: file,
                address: address
            });
        });
    }


    consumeFileFromNewSocket(container:FileContainer, fileName:string, address:Object, callback:Function) {
        let fileTransferClient = net.connect(address, ()=> {
            debug(`/consumeFileFromNewSocket - connected with a new transfer socket, file: ${fileName}`);

            fileTransferClient.on('end', ()=> {
                debug(`consumeFileFromNewSocket - finished file transfer, file: ${fileName}`);
                callback();
            });

            container.consumeFileStream(fileName, fileTransferClient);
        })
    }
}

export = BucketWrapper;
