import * as express from "express";
import {BucketService} from "../bucket/bucket_service";

export function bucketRouter(host:string, bucketService:BucketService) {
    const router = express.Router();

    router.get('/list', (req, res) => {

        bucketService.getBucketsList((err, buckets)=> {
            res.json({buckets: buckets});
        });
    });

    router.get('/:bucketName/port', (req, res) => {
        bucketService.requestPortForBucket('', '', req.params.bucketName, (err, port)=> {
            res.json({
                host: host,
                port: port
            });
        })
    });

    return router;
}