/// <reference path="../../typings/main.d.ts" />

import {getUserService} from "./user_service";
import {Server, createServer} from "net";
import {BucketOperator} from "./bucket_operator";
import {Messenger} from "../transport/messenger";
import * as fs from "fs";
import {Connection} from "../transport/connection";
import {loggerFor, debugFor} from "../helpers/logger";

const debug = debugFor("syncrow:bucket_service");
const logger = loggerFor('BucketService');

const UserService = getUserService();

export class BucketService {
    private host:string;
    private bucketOperators:Map<string,BucketOperator>;
    private bucketServerPorts:Map<string, number>;
    private bucketsList:Array<string>;
    private bucketIncomingListeners:Map<string, Server>;

    /**
     * Use as container for buckets and bucket servers
     * @param host
     * @param path
     */
    constructor(host:string, path:string) {
        this.host = host;
        this.bucketsList = this.loadBucketDirectories(path);
        this.bucketOperators = this.initializeBucketOperators(path, this.bucketsList);

        this.bucketServerPorts = new Map();
        this.bucketIncomingListeners = new Map();
        this.initializeIncomingConnectionListeners(()=> {
            logger.info(`Bucket Service ready! Controls: ${this.bucketsList.length} buckets`)
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
        const server = createServer(
            (incomingSocket)=> {
                const otherParty = new Messenger(new Connection(incomingSocket));
                this.bucketOperators.get(bucketName).addOtherParty(otherParty);
            }
        ).listen(()=> {
            this.bucketServerPorts.set(bucketName, server.address().port);
            this.bucketIncomingListeners.set(bucketName, server);

            callback();
        });
    }
}