

import {getUserService} from "./user_service";
import {Server, createServer} from "net";
import * as fs from "fs";
import * as async from "async";
import {loggerFor, debugFor} from "../utils/logger";
import {Engine} from "../client/engine";
import {FileContainer} from "../fs_helpers/file_container";
import {EventMessenger} from "../connection/evented_messenger";

const debug = debugFor("syncrow:bucket:service");
const logger = loggerFor('BucketService');

const UserService = getUserService();

export class BucketService {
    private host:string;
    private bucketOperators:Map<string,Engine>;
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
        this.bucketsList = BucketService.loadBucketDirectories(path);
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
        //TODO add token here
        return callback(null, this.bucketServerPorts.get(bucketName));
    }

    private static loadBucketDirectories(path):Array<string> {
        const buckets = fs.readdirSync(path);

        debug(`loaded ${buckets.length} buckets`);

        return buckets;
    }

    private initializeBucketOperators(basePath:string, bucketsList:Array<string>):Map<string,BucketOperator> {
        const result = new Map();

        bucketsList.forEach((bucketName)=> {
            const container = new FileContainer(`${basePath}/${bucketName}`);
            const engine = new Engine(container, {
                allowReconnecting: false,
                preferConnecting: false,
            }, (err)=>logger.error(err));
            result.set(bucketName, engine);
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
                const otherParty = new EventMessenger({
                    listen: false,
                    socket: incomingSocket
                }, (err)=>logger.error(err));

                this.bucketOperators.get(bucketName).addOtherParty(otherParty);
            }
        ).listen(()=> {
            this.bucketServerPorts.set(bucketName, server.address().port);
            this.bucketIncomingListeners.set(bucketName, server);

            callback();
        });
    }
}
