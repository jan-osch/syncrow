import {Client} from "../../client/client";
import * as async from "async";
import {createDir, createPathSeries, obtainTwoSockets} from "../test_utils";
import {Messenger} from "../../connection/messenger";
import {Connection} from "../../connection/connection";
import * as sinon from "sinon";
import {EventEmitter} from "events";
import {expect} from "chai";
import * as rimraf from "rimraf";
import * as _ from "lodash";


xdescribe('Client', ()=> {

    xdescribe('it will synchronize simple file on command', ()=> {

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
                callback => createDir(directoryA, callback),

                callback => createDir(directoryB, callback),

                callback => createPathSeries([
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

    describe('Return a correct file list', ()=> {
        const testDir = 'testDir';
        const testFiles = [
            {filePath: `${testDir}/dirA/file1.txt`, content: `ibberish`},
            {filePath: `${testDir}/dirA/dirAA/file2.txt`, content: `jk123jj9casc`},
            {filePath: `${testDir}/.driB/.file.txt`, content: ``},
            {filePath: `${testDir}/new_directory/file.txt.xyz`, content: `random content`},
            {filePath: `${testDir}/.hidden_file`, content: 'hidden_content'},
            {filePath: `${testDir}/deep_dir/even_deeper/very_deep/.hidden_deep/.hidden_file`, content: '\wdjkasd'}
        ];

        const expectedFiles = testFiles.map(file => file.filePath.replace(`${testDir}/`, ''));

        let expectedDirs = [];

        expectedFiles.forEach(file=> {
            for (let i = 0; i < file.length; i++) {
                if (file.charAt(i) === '/') {
                    expectedDirs.push(file.substr(0, i));
                }
            }
        });

        expectedDirs = _.uniq(expectedDirs);

        before(function (done) {
            async.series([
                callback => createDir(testDir, callback),
                callback => createPathSeries(testFiles, callback),
            ], done)
        });

        after(function (done) {
            rimraf(testDir, done);
        });


        it('will obtain correct file list', function (done) {
            const mockMessenger = new EventEmitter();
            mockMessenger.isMessengerAlive = sinon.stub().returns(false);

            mockMessenger.writeMessage = (message)=> {
                const parsed = JSON.parse(message);
                expect(parsed.type).to.equal('fileList');
                expectedFiles.forEach(file => expect(parsed.body.fileList).contains(file));
                expectedDirs.forEach(dir => expect(parsed.body.fileList).contains(dir));

                done();
            };

            new Client(testDir, mockMessenger);
            const mockGetFileListMessage = JSON.stringify({type: 'getFileList', body: 'mockBody'});
            mockMessenger.emit('message', mockGetFileListMessage);
        })
    });

});