/// <reference path="../../typings/main.d.ts" />

import * as express from "express";
import * as bodyParser from "body-parser";
import {BucketService} from "../bucket/bucket_service";
import {loggerFor, debugFor} from "../utils/logger";

const logger = loggerFor('ServerApplication');
const debug = debugFor('syncrow:server_application');


const app = express();
const host = process.argv[2];
const path = process.argv[3];

debug(process.argv);

const bucketService = new BucketService(host, path);

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.get('/bucket', (req, res) => {

    bucketService.getBucketsList((err, buckets)=> {
        res.json({buckets: buckets});
    })

});

app.get('/bucket/:bucketName/port', (req, res) => {
    bucketService.requestPortForBucket('', '', req.params.bucketName, (err, port)=> {
        res.json({
            host: host,
            port: port
        });
    })
});


const port = 3000;
app.listen(port, function () {
    logger.info(`Syncrow server listening on port: ${port}`)
});

export var App = app;