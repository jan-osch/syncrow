/// <reference path="../../typings/main.d.ts" />


import fs = require("fs");
import FileContainer = require("../helpers/file_container");
import net  = require('net');

import UserService = require('./user_service');
import {Server} from "net";
import BucketOperator from "./bucket_operator";

import async = require('async');
import _= require('lodash');
import SocketMessenger = require("../transport/messenger");
import Client = require("../client/client");
import Messenger = require("../transport/messenger");

const debug = require('debug')('syncrow:bucket_service');

export default class BucketService {
    private host:string;
    private bucketOperators:Map<string,BucketOperator>;
    private bucketServerPorts:Map<string, number>;
    private bucketsList:Array<string>;
    private bucketIncomingListeners:Map<string, Server>;

    constructor(host:string, path:string) {
        this.host = host;
        this.bucketsList = this.loadBucketDirectories(path);
        this.bucketOperators = this.initializeBucketOperators(path, this.bucketsList);

        this.bucketServerPorts = new Map();
        this.bucketIncomingListeners = new Map();
        this.initializeIncomingConnectionListeners(()=> {
            debug('Bucket Service ready!')
        });
    }

    /**
     *
     * @param callback
     */
    public getBucketsList(callback) {
        callback(null, this.bucketsList);
    }

    /**
     *
     * @param login
     * @param passwordHash
     * @param bucketName
     * @param callback
     */
    public requestPortForBucket(login:string, passwordHash:string, bucketName:string, callback:Function) {
        if (!UserService.validateCredentials(login, passwordHash)) {
            return callback(new Error('Invalid Credentials'));
        }

        if (this.bucketsList.indexOf(bucketName) === -1) {
            return callback(new Error('Invalid bucket name'));
        }

        return callback(null, this.bucketServerPorts.get(bucketName));
    }

    private loadBucketDirectories(path):Array<string> {
        const buckets = fs.readdirSync(path);

        debug(`loaded ${buckets.length} buckets`);

        return buckets;
    }

    private initializeBucketOperators(basePath:string, bucketsList:Array<string>):Array<BucketOperator> {
        const result = new Map();

        bucketsList.forEach((bucketName)=> {
            result.set(bucketName, new BucketOperator(this.host, `${basePath}/${bucketName}`));
        });

        return result;
    }

    private initializeIncomingConnectionListeners(callback:(err?:Error)=>void) {
        async.each(this.bucketsList,

            (bucketName, serverListeningCallback)=> this.createListenerForBucket(bucketName, serverListeningCallback),

            callback
        );

    }

    private createListenerForBucket(bucketName:string, callback:Function) {
        const server = net.createServer(
            (incomingSocket)=> {
                const otherParty = new Messenger(null, incomingSocket);
                this.bucketOperators.get(bucketName).addOtherParty(otherParty);
            }
        ).listen(()=> {
            this.bucketServerPorts.set(bucketName, server.address().port);
            this.bucketIncomingListeners.set(bucketName, server);

            callback();
        });
    }
}