import {createPathSeries, removePath} from "../test_utils";
import {expect} from "chai";
import * as sinon from "sinon";
import {FileContainer} from "../../fs_helpers/file_container";
import * as async from "async";


describe('FileContainer', ()=> {
    let sandbox;
    let reverRewire;

    beforeEach(function (done) {
        sandbox = sinon.sandbox.create();
        done();
    });

    afterEach(function (done) {
        sandbox.restore();
        done();
    });


    describe('getFileTree', ()=> {
        it('list of files from the directory', function (done) {
            const testDir = 'testDir';
            const testFiles = [
                {path: testDir, directory: true},
                {path: `${testDir}/file1.txt`, content: `ibberish`},
                {path: `${testDir}/file2.txt`, content: `jk123jj9casc`},
                {path: `${testDir}/dir`, directory: true},
            ];
            const expected = [
                'file1.txt', 'file2.txt', 'dir'
            ];

            async.series(
                [
                    (cb)=>removePath(testDir, cb),
                    (cb)=>createPathSeries(testFiles, cb),
                    (cb)=> {
                        const container = new FileContainer(testDir);
                        container.beginWatching();

                        container.getFileTree((err, files)=> {

                            expect(err).not.to.be.defined;
                            expect(files).to.have.lengthOf(expected.length);
                            expect(files).to.have.members(expected);
                            cb();
                        });
                    },
                    (cb)=>removePath(testDir, cb)
                ],
                done
            );
        });

        it('list of files from the directory, including hidden files and directories, also from deeply nested directories', function (done) {
            const testDir = 'testDir';
            const testFiles = [
                {path: testDir, directory: true},
                {path: `${testDir}/.file1.txt`, content: `ibberish`},
                {path: `${testDir}/.dir`, directory: true},
                {path: `${testDir}/.dir/.file2.txt`, content: `jk123jj9casc`},
                {path: `${testDir}/.dir/.dir1/.dir2/.dir3`, directory: true},
                {path: `${testDir}/.dir/.dir1/.dir2/.dir3/.file3.txt`, content: ''},
            ];
            const expected = [
                '.file1.txt',
                '.dir/.file2.txt',
                '.dir',
                '.dir/.dir1',
                '.dir/.dir1/.dir2',
                '.dir/.dir1/.dir2/.dir3',
                '.dir/.dir1/.dir2/.dir3/.file3.txt'
            ];

            async.series(
                [
                    (cb)=>removePath(testDir, cb),
                    (cb)=>createPathSeries(testFiles, cb),
                    (cb)=> {
                        const container = new FileContainer(testDir);
                        container.beginWatching();

                        container.getFileTree((err, files)=> {

                            expect(err).not.to.be.defined;
                            expect(files).to.have.lengthOf(expected.length);
                            expect(files).to.have.members(expected);
                            cb();
                        });
                    },
                    (cb)=>removePath(testDir, cb)
                ],
                done
            );
        });

        it('list of files from the directory, ignoring the files from filter function', function (done) {
            const testDir = 'testDir';
            const testFiles = [
                {path: testDir, directory: true},
                {path: `${testDir}/file1.txt`, content: `ibberish`},
                {path: `${testDir}/ignored`, directory: true},
                {path: `${testDir}/ignored/file3.txt`, content: ''},
                {path: `${testDir}/dir`, directory: true},
                {path: `${testDir}/dir/not_ignored.txt`, content: `jk123jj9casc`},
                {path: `${testDir}/dir/ignoredFile.txt`, content: 'jknnkjasd'},
            ];
            const expected = [
                'file1.txt',
                'dir',
                'dir/not_ignored.txt',
            ];

            function ignore(path) {
                return [`${testDir}/ignored`, `${testDir}/dir/ignoredFile.txt`].indexOf(path) !== -1;
            }

            async.series(
                [
                    (cb)=>removePath(testDir, cb),
                    (cb)=>createPathSeries(testFiles, cb),
                    (cb)=> {
                        const container = new FileContainer(testDir, {filter: ignore});
                        container.beginWatching();

                        container.getFileTree((err, files)=> {
                            expect(err).not.to.be.defined;
                            expect(files).to.have.lengthOf(expected.length);
                            expect(files).to.have.members(expected);
                            cb();
                        });
                    },
                    (cb)=>removePath(testDir, cb)
                ],
                done
            );
        });
    });

});
