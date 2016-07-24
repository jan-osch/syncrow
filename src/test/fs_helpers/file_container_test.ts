import {createPathSeries, removePath, pathExists, createPath} from "../test_utils";
import * as chai from "chai";
import {expect} from "chai";
import * as sinon from "sinon";
import {FileContainer} from "../../fs_helpers/file_container";
import * as async from "async";
import * as sinonChai from "sinon-chai";
import * as fs from "fs";

chai.use(sinonChai);


describe('FileContainer', ()=> {
    let sandbox;
    let container:FileContainer;

    beforeEach(function () {
        sandbox = sinon.sandbox.create();
        sandbox.stub(console, 'info');
    });

    afterEach(function () {
        sandbox.restore();
        container.shutdown();
        container = null;
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
                        container = new FileContainer(testDir);
                        container.beginWatching(cb);
                    },
                    (cb)=> {
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
                        container = new FileContainer(testDir);
                        container.beginWatching(cb);
                    },
                    (cb)=> {

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
                        container = new FileContainer(testDir, {filter: ignore});
                        container.beginWatching(cb);
                    },
                    (cb)=> {
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

    describe('deleteFile', function () {
        it('will delete a file or directory', function (done) {
            const testDir = 'testDir';
            const testFiles = [
                {path: testDir, directory: true},
                {path: `${testDir}/file1.txt`, content: `xxx`},
                {path: `${testDir}/dirA`, directory: true},
                {path: `${testDir}/dirA/file.txt`, content: 'xxx'},
                {path: `${testDir}/dirA/file2.txt`, content: 'xxx'},
                {path: `${testDir}/dirB`, directory: true},
                {path: `${testDir}/dirB/file2.txt`, content: 'xxx'},
                {path: `${testDir}/dirB/file3.txt`, content: 'xxx'},
            ];

            async.series(
                [
                    (cb)=>removePath(testDir, cb),
                    (cb)=>createPathSeries(testFiles, cb),
                    (cb)=> {
                        container = new FileContainer(testDir);
                        container.beginWatching(cb);
                    },
                    (cb)=>container.deleteFile('file1.txt', cb),
                    (cb)=>container.deleteFile('dirA', cb),
                    (cb)=>container.deleteFile('dirB/file2.txt', cb),
                    (cb)=> {
                        expect(pathExists(testDir)).to.be.true;
                        expect(pathExists(`${testDir}/file1.txt`)).to.be.false;
                        expect(pathExists(`${testDir}/dirA`)).to.be.false;
                        expect(pathExists(`${testDir}/dirA/file.txt`)).to.be.false;
                        expect(pathExists(`${testDir}/dirA/file2.txt`)).to.be.false;
                        expect(pathExists(`${testDir}/dirB`)).to.be.true;
                        expect(pathExists(`${testDir}/dirB/file2.txt`)).to.be.false;
                        expect(pathExists(`${testDir}/dirB/file3.txt`)).to.be.true;
                        cb();
                    },
                    (cb)=>removePath(testDir, cb)
                ],
                done
            );
        })
    });

    describe('emitting events', function () {
        it('will emit fileCreated event with correct path', function (done) {
            const testDir = 'emittingEvents';
            async.series(
                [
                    (cb)=>removePath(testDir, cb),
                    (cb)=>createPath(testDir, null, true, cb),
                    (cb)=> {
                        container = new FileContainer(testDir);
                        sandbox.spy(container, 'emit');
                        container.beginWatching(cb);
                    },
                    (cb)=>createPath(`${testDir}/file.txt`, 'xxx', false, cb),
                    (cb)=>setTimeout(cb, 500),
                    (cb)=> {
                        expect(container.emit).to.have.been.calledOnce;
                        expect(container.emit).have.been.calledWith('fileCreated', 'file.txt');
                        return cb();
                    },
                    (cb)=>removePath(testDir, cb)
                ],
                done
            );
        });
        it('will emit fileDeleted event with correct path', function (done) {
            const testDir = 'emittingEvents';
            async.series(
                [
                    (cb)=>removePath(testDir, cb),
                    (cb)=>createPath(testDir, null, true, cb),
                    (cb)=>createPath(`${testDir}/file.txt`, 'xxx', false, cb),
                    (cb)=> {
                        container = new FileContainer(testDir);
                        sandbox.spy(container, 'emit');
                        container.beginWatching(cb);
                    },
                    (cb)=>removePath(`${testDir}/file.txt`, cb),
                    (cb)=>setTimeout(cb, 500),
                    (cb)=> {
                        expect(container.emit).to.have.been.calledOnce;
                        expect(container.emit).have.been.calledWith('deleted', 'file.txt');
                        return cb();
                    },
                    (cb)=>removePath(testDir, cb)
                ],
                done
            );
        });
        it('will emit createdDirectory event with correct path', function (done) {
            const testDir = 'emittingEvents';
            async.series(
                [
                    (cb)=>removePath(testDir, cb),
                    (cb)=>createPath(testDir, null, true, cb),
                    (cb)=> {
                        container = new FileContainer(testDir);
                        sandbox.spy(container, 'emit');
                        container.beginWatching(cb);
                    },
                    (cb)=>createPath(`${testDir}/dirA`, null, true, cb),
                    (cb)=>setTimeout(cb, 500),
                    (cb)=> {
                        expect(container.emit).to.have.been.calledOnce;
                        expect(container.emit).have.been.calledWith('createdDirectory', 'dirA');
                        return cb();
                    },
                    (cb)=>removePath(testDir, cb)
                ],
                done
            );
        });
        it('will emit changed event with correct path', function (done) {
            const testDir = 'emittingEvents';
            async.series(
                [
                    (cb)=>removePath(testDir, cb),
                    (cb)=>createPath(testDir, null, true, cb),
                    (cb)=>createPath(`${testDir}/file.txt`, 'content\n', false, cb),
                    (cb)=> {
                        container = new FileContainer(testDir);
                        sandbox.spy(container, 'emit');
                        container.beginWatching(cb);
                    },
                    (cb)=>fs.appendFile(`${testDir}/file.txt`, 'second line', cb),
                    (cb)=>setTimeout(cb, 500),
                    (cb)=> {
                        expect(container.emit).to.have.been.calledOnce;
                        expect(container.emit).have.been.calledWith('changed', 'file.txt');
                        return cb();
                    },
                    (cb)=>removePath(testDir, cb)
                ],
                done
            );
        });

    });

});
