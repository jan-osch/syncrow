/// <reference path="../../typings/main.d.ts" />

import * as express from "express";
import * as bodyParser from "body-parser";
import BucketService from "../bucket/bucket_service";

const app = express();
const host = process.argv[2];
const path = process.argv[3];

const debug = require('debug')('syncrow:application');

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

app.listen(3000, function () {
    console.info("Demo Express server listening on port %d", 3000);
});

export var App = app;