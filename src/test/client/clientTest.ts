import {Client} from "../../client/client";
import * as async from "async";
import {createTestDir, createMultipleFiles, obtainTwoSockets} from "../test_utils";
import {Messenger} from "../../connection/messenger";
import {Connection} from "../../connection/connection";


describe('Client', ()=> {

    describe('it will synchronize simple file on command', ()=> {

        const contentA = 'mockFileContent  sample sample\n sample';
        const contentB = 'sample \t \n sample';
        const directoryA = 'dirA';
        const directoryB = 'dirB';
        const fileA = `${directoryA}/fileA.txt`;
        const fileB = `${directoryB}/fileB.txt`;
        let messengerA:Messenger;
        let messengerB:Messenger;

        before(function (done) {

            async.series([
                callback => createTestDir(directoryA, callback),

                callback => createTestDir(directoryB, callback),

                callback => createMultipleFiles([
                    {filePath: fileA, content: contentA},
                    {filePath: fileB, content: contentB},
                ], callback),

                callback => obtainTwoSockets((err, result)=> {
                    if (err) return callback(err);
                    messengerA = new Messenger(new Connection(result.client));
                    messengerB = new Messenger(new Connection(result.server));
                    callback();
                })
            ], done)
        });

        it('it will obtain correct fileList', function (done) {
            const clientA = new Client(directoryA, messengerA);
            const clientB = new Client(directoryB, messengerB);

            clientA.getRemoteFileList(messengerB, (err, results)=> {
                expect(err).to.equal(null);
                expect(results.length).to.equal(1);
                expect(results).to.contain(fileB);
                done();
            })
        })
    });
});