/// <reference path="../../typings/main.d.ts" />


import fs = require("fs");
import FileContainer = require("../file_container");
import net  = require('net');

import UserService = require('./user_service');
import {Socket} from "net";

import async = require('async');
import _= require('lodash');
import SocketMessenger = require("../socket_messenger");
import Client = require("../client");

const debug = require('debug')('server:server');

class ApplicationServer {
    private port:number;
    private bucketsList:Array<string>;
    private containers:Object;
    private bucketSockets:Object;
    private bucketServers:Object;
    private bucketServerPorts:Object;
    private host:string;


    constructor(host:string, port:number, path:string) {
        this.host = host;
        this.bucketsList = this.loadBuckets(path);
        this.containers = this.initializeBuckets(path, this.bucketsList);
        this.bucketSockets = this.createBucketSocketMap(this.bucketsList)
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


        if (event.type === Client.events.getFile) {
            this.sendFileToSocket(socket, bucketName, event.body, _.noop);
        }
        if (event.type === FileContainer.events.created) {
            Client.writeEventToSocketMessenger(socket, Client.events.pullFile, event.body); //TODO implement creation of free socket for the transfer
        }
        if (event.type === FileContainer.events.createdDirectory) {
            this.containers[bucketName].createDirectory(event.body);
        }
        if (event.type === FileContainer.events.changed) {
            Client.writeEventToSocketMessenger(socket, Client.events.pullFile, event.body); //TODO same here
        }
        if (event.type === FileContainer.events.deleted) {
            this.containers[bucketName].deleteFile(event.body);
        }
        if (event.type === Client.events.fileSocket) {
            this.consumeFileFromNewSocket(this.containers[bucketName], event.body.file, event.body.address, ()=>{

            });
        }

    }

    private

    public sendFileToSocket(socket:SocketMessenger, bucketName:string, file:string, callback) {
        let fileTransferServer = net.createServer((fileTransferSocket)=> {

            fileTransferSocket.on('end', callback);

            this.containers[bucketName].getReadStreamForFile(file).pipe(fileTransferSocket);

        }).listen(()=> {
            let address = {
                port: fileTransferServer.address().port,
                host: this.host
            };

            Client.writeEventToSocketMessenger(socket, Client.events.fileSocket, {
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

const k = new ApplicationServer(90, '.');

k.requestSocketForBucket('', '', ()=> {
});

export = ApplicationServer;
