/// <reference path="../../typings/main.d.ts" />

import * as program from "commander";
import {debugFor, loggerFor} from "../utils/logger";
import {applicationServer} from "../server/application_server";

const logger = loggerFor("CLI");
const debug = debugFor("syncrow:cli");

program.version('0.0.1')
    .option('-h, --host <host>', 'own host for connection', '127.0.0.1')
    .option('-d, --directory <directory>', 'location where the buckets reside', '.')
    .option('-p, --port <port>', 'port to listen on', 2510)
    .parse(process.argv);


debug(`host: ${program.host}`);
debug(`port: ${program.port}`);
debug(`directory: ${program.directory}`);

applicationServer(program.host, program.port, program.directory);