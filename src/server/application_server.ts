import * as express from "express";
import * as bodyParser from "body-parser";
import {BucketService} from "../bucket/bucket_service";
import {loggerFor, debugFor} from "../utils/logger";
import {bucketRouter} from "./bucket_router";

const logger = loggerFor('ServerApplication');
const debug = debugFor('syncrow:server_application');


export function applicationServer(host:string, port:number, path:string) {
    debug(`initializing an application server with arguments: ${arguments}`);

    const app = express();
    const bucketService = new BucketService(host, path);

    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());

    app.use('/bucket', bucketRouter(host, bucketService));

    app.listen(port, function () {
        logger.info(`Syncrow server listening on port: ${port}`)
    });
}

