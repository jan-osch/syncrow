import * as async from "async";
import * as path from "path";
import * as child_process from "child_process";
import {createPathSeries, removePath, compareDirectories, getRandomString} from "../../utils/fs_test_utils";

const START_TIMEOUT = 3000; //3 second
const TEST_DIR = path.join(__dirname, 'cli_test');

const configurationClient = {
    "listen": false,
    "remoteHost": "127.0.0.1",
    "remotePort": 2510,
    "rawFilter": [],
    "rawStrategy": "no",
    "initialToken": "fd5be39f9524e746b958d965e1f77bf6105425b017884c88767397c8d90b22f4",
    "advanced": true,
    "authenticate": true,
    "watch": true,
    "interval": 10000,
    "times": 18
};

const configurationServer = {
    "listen": true,
    "localPort": 2510,
    "externalHost": "127.0.0.1",
    "rawFilter": [],
    "rawStrategy": "pull",
    "initialToken": "fd5be39f9524e746b958d965e1f77bf6105425b017884c88767397c8d90b22f4",
    "advanced": true,
    "deleteLocal": true,
    "authenticate": true,
    "watch": true
};

let client;
let server;

describe('CLI', function () {
    this.timeout(START_TIMEOUT + 1000);
    beforeEach((done)=> {
        return async.series(
            [
                (cb)=>removePath(TEST_DIR, cb),

                (cb)=>createPathSeries(
                    [
                        {path: path.join(TEST_DIR, 'client_dir'), directory: true},
                        {
                            path: path.join(TEST_DIR, 'client_dir', '.syncrow.json'),
                            content: JSON.stringify(configurationClient)
                        },
                        {path: path.join(TEST_DIR, 'client_dir', 'aaa.txt'), content: getRandomString(4000)},
                        {path: path.join(TEST_DIR, 'client_dir', 'bbb.txt'), content: getRandomString(4000)},
                        {path: path.join(TEST_DIR, 'client_dir', 'ccc.txt'), content: getRandomString(4000)},

                        {path: path.join(TEST_DIR, 'server_dir'), directory: true},
                        {
                            path: path.join(TEST_DIR, 'server_dir', '.syncrow.json'),
                            content: JSON.stringify(configurationServer)
                        },
                    ],
                    cb
                ),

                (cb)=> {
                    client = child_process.spawn('../../../../../bin/syncrow', ['run'], {cwd: path.join(TEST_DIR, 'client_dir')});
                    server = child_process.spawn('../../../../../bin/syncrow', ['run'], {cwd: path.join(TEST_DIR, 'server_dir')});

                    return setTimeout(cb, START_TIMEOUT);
                },
                (cb)=>removePath(path.join(TEST_DIR, 'client_dir', '.syncrow.json'), cb),

                (cb)=>removePath(path.join(TEST_DIR, 'server_dir', '.syncrow.json'), cb)
            ],
            done
        )
    });

    after((done)=> {
        client.kill('SIGKILL');
        server.kill('SIGKILL');

        return removePath(TEST_DIR, done);
    });

    it('will start and synchronize two directories', (done)=> {
        return compareDirectories(path.join(TEST_DIR, 'client_dir'), path.join(TEST_DIR, 'server_dir'), done)
    });

});

