import * as express from "express";
import {BucketService} from "../bucket/bucket_service";
import {debugFor} from "../utils/logger";

const debug = debugFor('syncrow:bucket_router');

export function bucketRouter(host:string, bucketService:BucketService) {
    const router = express.Router();

    router.get('/list', (req, res) => {
        debug('requested bucket list');
        bucketService.getBucketsList((err, buckets)=> {
            res.json({buckets: buckets});
        });
    });

    router.get('/:bucketName/remotePort', (req, res) => {
        debug(`requested port for ${req.params.bucketName}`);
        bucketService.requestPortForBucket('', '', req.params.bucketName, (err, port)=> {
            res.json({
                host: host,
                port: port
            });
        })
    });

    return router;
}