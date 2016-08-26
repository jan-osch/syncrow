import {createPathSeries, removePath, pathExists, createPath, getRandomString} from "../utils/test_utils";
import * as chai from "chai";
import {expect} from "chai";
import * as sinon from "sinon";
import {FileContainer} from "../fs_helpers/file_container";
import * as async from "async";
import * as sinonChai from "sinon-chai";
import * as fs from "fs";
import * as crypto from "crypto";

chai.use(sinonChai);
const fileContainerTimeout = 400;

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

    describe('emitting commands', function () {
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
                    (cb)=>setTimeout(cb, fileContainerTimeout),
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
                    (cb)=>setTimeout(cb, fileContainerTimeout),
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
                    (cb)=>setTimeout(cb, fileContainerTimeout),
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
                    (cb)=>setTimeout(cb, fileContainerTimeout),
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

    describe('consumeFileStream', function () {
        it('will write the file to destination without emitting changed commands', function (done) {
            const testDir = 'consumeFileStream';
            const fileContent = getRandomString(1024);
            const fromPath = 'from.txt';
            const toPath = 'to.txt';
            const toPathAbsolute = `${testDir}/${toPath}`;

            async.series(
                [
                    (cb)=>removePath(testDir, cb),
                    (cb)=>createPath(testDir, null, true, cb),
                    (cb)=>createPath(fromPath, fileContent, false, cb),
                    (cb)=> {
                        container = new FileContainer(testDir);
                        sandbox.spy(container, 'emit');
                        container.beginWatching(cb);
                    },
                    (cb)=> {
                        const stream = fs.createReadStream(fromPath);
                        container.consumeFileStream(toPath, stream, cb);
                    },
                    (cb)=>setTimeout(cb, fileContainerTimeout),
                    (cb)=> {
                        expect(container.emit).not.to.have.been.called;
                        expect(pathExists(toPathAbsolute)).to.equal(true);
                        expect(fs.readFileSync(toPathAbsolute, 'utf8')).to.equal(fileContent);
                        return cb();
                    },
                    (cb)=>removePath(fromPath, cb),
                    (cb)=>removePath(testDir, cb)
                ],
                done
            );
        });
    });

    describe('getReadStreamForFile', function () {
        it('will return a readStream, and during streaming will not emit "changed" event', function (done) {
            const testDir = 'consumeFileStream';
            const fileContent = getRandomString(1024);
            const fromPath = 'from.txt';
            const toPath = 'to.txt';
            const fromPathAbsolute = `${testDir}/${fromPath}`;

            async.series(
                [
                    (cb)=>removePath(testDir, cb),
                    (cb)=>createPath(testDir, null, true, cb),
                    (cb)=>createPath(fromPathAbsolute, fileContent, false, cb),
                    (cb)=> {
                        container = new FileContainer(testDir);
                        sandbox.spy(container, 'emit');
                        container.beginWatching(cb);
                    },
                    (cb)=> {
                        const stream = container.getReadStreamForFile(fromPath);
                        stream.on('end', cb);
                        stream.on('error', cb);
                        stream.pipe(fs.createWriteStream(toPath));
                    },
                    (cb)=>setTimeout(cb, fileContainerTimeout),
                    (cb)=> {
                        expect(container.emit).not.to.have.been.called;
                        expect(pathExists(toPath)).to.equal(true);
                        expect(fs.readFileSync(toPath, 'utf8')).to.equal(fileContent);
                        return cb();
                    },
                    (cb)=>removePath(toPath, cb),
                    (cb)=>removePath(testDir, cb)
                ],
                done
            );
        });
    });

    describe('getFileMeta', function () {
        it('if a file exists, will return an object with name, and exists set to true', function (done) {
            const testDir = 'getFileMeta';
            const content = getRandomString(1000);
            const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

            async.series(
                [
                    (cb)=>removePath(testDir, cb),
                    (cb)=>createPath(testDir, null, true, cb),
                    (cb)=>createPath(`${testDir}/file.txt`, content, false, cb),
                    (cb)=> {
                        container = new FileContainer(testDir);
                        container.beginWatching(cb);
                    },
                    (cb)=> {
                        container.getFileMeta('file.txt', (err, data)=> {
                            if (err)return cb(err);

                            expect(data.exists).to.equal(true);
                            expect(data.isDirectory).to.equal(false);
                            expect(data.name).to.equal('file.txt');
                            expect(data.hashCode).to.equal(expectedHash);
                            expect(data.modified).to.deep.equal(fs.statSync(`${testDir}/file.txt`).mtime);
                            cb();
                        })
                    },
                    (cb)=>removePath(testDir, cb)
                ],
                done
            );
        })

        it('if a file does not exist, will return an object with name, and exists set to false, and hash of empty string', function (done) {
            const testDir = 'getFileMeta';

            async.series(
                [
                    (cb)=>removePath(testDir, cb),
                    (cb)=>createPath(testDir, null, true, cb),
                    (cb)=> {
                        container = new FileContainer(testDir);
                        container.beginWatching(cb);
                    },
                    (cb)=> {
                        container.getFileMeta('file.txt', (err, data)=> {
                            if (err)return cb(err);

                            expect(data.exists).to.equal(false);
                            expect(data.isDirectory).to.equal(false);
                            expect(data.name).to.equal('file.txt');
                            expect(data.hashCode).to.equal('');
                            expect(data.modified).to.be.null;
                            cb();
                        })
                    },
                    (cb)=>removePath(testDir, cb)
                ],
                done
            );
        })

        it('if a file exists, and is a directory, will return correct data', function (done) {
            const testDir = 'getFileMeta';

            async.series(
                [
                    (cb)=>removePath(testDir, cb),
                    (cb)=>createPath(testDir, null, true, cb),
                    (cb)=>createPath(`${testDir}/dirA`, null, true, cb),
                    (cb)=> {
                        container = new FileContainer(testDir);
                        container.beginWatching(cb);
                    },
                    (cb)=> {
                        container.getFileMeta('dirA', (err, data)=> {
                            if (err)return cb(err);

                            expect(data.exists).to.equal(true);
                            expect(data.isDirectory).to.equal(true);
                            expect(data.name).to.equal('dirA');
                            expect(data.hashCode).to.equal('');
                            expect(data.modified).to.deep.equal(fs.statSync(`${testDir}/dirA`).mtime);
                            cb();
                        })
                    },
                    (cb)=>removePath(testDir, cb)
                ],
                done
            );
        })
    })
});
