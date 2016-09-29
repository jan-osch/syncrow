import {createPathSeries, removePath, pathExists, createPath, getRandomString} from "../../utils/fs_test_utils";
import * as chai from "chai";
import {expect} from "chai";
import * as sinon from "sinon";
import {FileContainer} from "../../fs_helpers/file_container";
import * as async from "async";
import * as sinonChai from "sinon-chai";
import * as fs from "fs";
import * as crypto from "crypto";
import {EventCounter} from "../../utils/event_counter";
import {PathHelper} from "../../fs_helpers/path_helper";
import * as assert from "assert";
import * as path from "path";

chai.use(sinonChai);

const FS_TIMEOUT = 400;
const TEST_DIR = path.join(__dirname, 'testDir');

describe('FileContainer', ()=> {
    let sandbox;
    let container:FileContainer;

    beforeEach(function (done) {
        sandbox = sinon.sandbox.create();
        sandbox.stub(console, 'info');

        return async.waterfall(
            [
                (cb)=>removePath(TEST_DIR, cb),
                (cb)=>createPath(TEST_DIR, null, true, cb),
            ],

            done
        )

    });

    afterEach(function () {
        sandbox.restore();
        container.shutdown();
        container = null;
    });

    after((done)=> {
        return removePath(TEST_DIR, done)
    });

    describe('getFileTree', ()=> {
        it('list of files from the directory', function (done) {

            const testFiles = [
                {path: `${TEST_DIR}/file1.txt`, content: `ibberish`},
                {path: `${TEST_DIR}/file2.txt`, content: `jk123jj9casc`},
                {path: `${TEST_DIR}/dir`, directory: true},
            ];
            const expected = [
                'file1.txt', 'file2.txt', 'dir'
            ];

            async.series(
                [
                    (cb)=>createPathSeries(testFiles, cb),
                    (cb)=> {
                        container = new FileContainer(TEST_DIR);
                        container.beginWatching(cb);
                    },
                    (cb)=> {
                        container.getFileTree((err, files)=> {
                            assert.ifError(err);
                            expect(files).to.have.lengthOf(expected.length);
                            expect(files).to.have.members(expected);
                            cb();
                        });
                    }
                ],
                done
            );
        });

        it('list of files from the directory, including hidden files and directories, also from deeply nested directories', function (done) {
            const testFiles = [
                {path: `${TEST_DIR}/.file1.txt`, content: `ibberish`},
                {path: `${TEST_DIR}/.dir`, directory: true},
                {path: `${TEST_DIR}/.dir/.file2.txt`, content: `jk123jj9casc`},
                {path: `${TEST_DIR}/.dir/.dir1/.dir2/.dir3`, directory: true},
                {path: `${TEST_DIR}/.dir/.dir1/.dir2/.dir3/.file3.txt`, content: ''},
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
                    (cb)=>createPathSeries(testFiles, cb),
                    (cb)=> {
                        container = new FileContainer(TEST_DIR);
                        container.beginWatching(cb);
                    },
                    (cb)=> {

                        container.getFileTree((err, files)=> {
                            assert.ifError(err);
                            expect(files).to.have.lengthOf(expected.length);
                            expect(files).to.have.members(expected);
                            cb();
                        });
                    },
                ],
                done
            );
        });

        it('list of files from the directory, ignoring the files from filter function', function (done) {
            const testFiles = [
                {path: `${TEST_DIR}/file1.txt`, content: `ibberish`},
                {path: `${TEST_DIR}/ignored`, directory: true},
                {path: `${TEST_DIR}/ignored/file3.txt`, content: ''},
                {path: `${TEST_DIR}/dir`, directory: true},
                {path: `${TEST_DIR}/dir/not_ignored.txt`, content: `jk123jj9casc`},
                {path: `${TEST_DIR}/dir/ignoredFile.txt`, content: 'jknnkjasd'},
            ];
            const expected = [
                'file1.txt',
                'dir',
                'dir/not_ignored.txt',
            ];

            function ignore(path) {
                const normalized = PathHelper.normalizePath(path);
                return [`${TEST_DIR}/ignored`, `${TEST_DIR}/dir/ignoredFile.txt`].indexOf(normalized) !== -1;
            }

            async.series(
                [
                    (cb)=>createPathSeries(testFiles, cb),
                    (cb)=> {
                        container = new FileContainer(TEST_DIR, {filter: ignore});
                        container.beginWatching(cb);
                    },
                    (cb)=> {
                        container.getFileTree((err, files)=> {

                            expect(files).to.have.lengthOf(expected.length);
                            expect(files).to.have.members(expected);
                            cb();
                        });
                    }
                ],
                done
            );
        });
    });

    describe('deleteFile', function () {
        it('will delete a file or directory', function (done) {
            const testFiles = [
                {path: `${TEST_DIR}/file1.txt`, content: `xxx`},
                {path: `${TEST_DIR}/dirA`, directory: true},
                {path: `${TEST_DIR}/dirA/file.txt`, content: 'xxx'},
                {path: `${TEST_DIR}/dirA/file2.txt`, content: 'xxx'},
                {path: `${TEST_DIR}/dirB`, directory: true},
                {path: `${TEST_DIR}/dirB/file2.txt`, content: 'xxx'},
                {path: `${TEST_DIR}/dirB/file3.txt`, content: 'xxx'},
            ];

            async.series(
                [
                    (cb)=>createPathSeries(testFiles, cb),
                    (cb)=> {
                        container = new FileContainer(TEST_DIR);
                        container.beginWatching(cb);
                    },
                    (cb)=>container.deleteFile('file1.txt', cb),
                    (cb)=>container.deleteFile('dirA', cb),
                    (cb)=>container.deleteFile('dirB/file2.txt', cb),
                    (cb)=> {
                        expect(pathExists(TEST_DIR)).to.be.true;
                        expect(pathExists(`${TEST_DIR}/file1.txt`)).to.be.false;
                        expect(pathExists(`${TEST_DIR}/dirA`)).to.be.false;
                        expect(pathExists(`${TEST_DIR}/dirA/file.txt`)).to.be.false;
                        expect(pathExists(`${TEST_DIR}/dirA/file2.txt`)).to.be.false;
                        expect(pathExists(`${TEST_DIR}/dirB`)).to.be.true;
                        expect(pathExists(`${TEST_DIR}/dirB/file2.txt`)).to.be.false;
                        expect(pathExists(`${TEST_DIR}/dirB/file3.txt`)).to.be.true;
                        cb();
                    }
                ],
                done
            );
        })
    });

    describe('emitting commands', function () {
        it('will emit fileCreated event with correct path', function (done) {
            let counter;
            async.series(
                [
                    (cb)=> {
                        container = new FileContainer(TEST_DIR);

                        counter = EventCounter.getCounter(container, 'fileCreated', 1);

                        sandbox.spy(container, 'emit');
                        container.beginWatching(cb);
                    },

                    (cb)=>createPath(`${TEST_DIR}/file.txt`, 'xxx', false, cb),

                    (cb)=> {
                        if (counter.hasFinished()) {
                            return setImmediate(cb)
                        }

                        return counter.on(EventCounter.events.done, cb);
                    },

                    (cb)=> {
                        expect(container.emit).to.have.been.calledOnce;
                        expect(container.emit).have.been.calledWith('fileCreated', 'file.txt');
                        return cb();
                    }
                ],
                done
            );
        });
        it('will emit fileDeleted event with correct path', function (done) {
            let counter;

            async.series(
                [
                    (cb)=>createPath(`${TEST_DIR}/file.txt`, 'xxx', false, cb),

                    (cb)=> {
                        container = new FileContainer(TEST_DIR);
                        sandbox.spy(container, 'emit');
                        counter = EventCounter.getCounter(container, 'deleted', 1);
                        container.beginWatching(cb);
                    },

                    (cb)=>removePath(`${TEST_DIR}/file.txt`, cb),

                    (cb)=> {
                        if (counter.hasFinished()) {
                            return setImmediate(cb)
                        }

                        return counter.on(EventCounter.events.done, cb);
                    },

                    (cb)=> {
                        expect(container.emit).to.have.been.calledOnce;
                        expect(container.emit).have.been.calledWith('deleted', 'file.txt');
                        return cb();
                    },
                    (cb)=>removePath(TEST_DIR, cb)
                ],
                done
            );
        });
        it('will emit createdDirectory event with correct path', function (done) {
            let counter;

            async.series(
                [
                    (cb)=> {
                        container = new FileContainer(TEST_DIR);
                        sandbox.spy(container, 'emit');
                        counter = EventCounter.getCounter(container, 'createdDirectory', 1);
                        container.beginWatching(cb);
                    },
                    (cb)=>createPath(`${TEST_DIR}/dirA`, null, true, cb),
                    (cb)=> {
                        if (counter.hasFinished()) {
                            return setImmediate(cb)
                        }

                        return counter.on(EventCounter.events.done, cb);
                    },
                    (cb)=> {
                        expect(container.emit).to.have.been.calledOnce;
                        expect(container.emit).have.been.calledWith('createdDirectory', 'dirA');
                        return cb();
                    },
                    (cb)=>removePath(TEST_DIR, cb)
                ],
                done
            );
        });
        it('will emit changed event with correct path', function (done) {
            let counter;
            async.series(
                [
                    (cb)=>createPath(`${TEST_DIR}/file.txt`, 'content\n', false, cb),
                    (cb)=> {
                        container = new FileContainer(TEST_DIR);
                        sandbox.spy(container, 'emit');
                        counter = EventCounter.getCounter(container, 'changed', 1);
                        container.beginWatching(cb);
                    },
                    (cb)=>fs.appendFile(`${TEST_DIR}/file.txt`, 'second line', cb),
                    (cb)=> {
                        if (counter.hasFinished()) {
                            return setImmediate(cb)
                        }

                        return counter.on(EventCounter.events.done, cb);
                    },
                    (cb)=> {
                        expect(container.emit).to.have.been.calledOnce;
                        expect(container.emit).have.been.calledWith('changed', 'file.txt');
                        return cb();
                    },
                    (cb)=>removePath(TEST_DIR, cb)
                ],
                done
            );
        });
    });

    describe('consumeFileStream', function () {
        it('will write the file to destination without emitting changed commands', function (done) {
            const fileContent = getRandomString(1024);
            const fromPath = 'from.txt';
            const toPath = 'to.txt';
            const toPathAbsolute = `${TEST_DIR}/${toPath}`;

            async.series(
                [
                    (cb)=>createPath(fromPath, fileContent, false, cb),
                    (cb)=> {
                        container = new FileContainer(TEST_DIR);
                        sandbox.spy(container, 'emit');
                        container.beginWatching(cb);
                    },
                    (cb)=> {
                        const stream = fs.createReadStream(fromPath);
                        container.consumeFileStream(toPath, stream, cb);
                    },
                    (cb)=>setTimeout(cb, FS_TIMEOUT),
                    (cb)=> {
                        expect(container.emit).not.to.have.been.called;
                        expect(pathExists(toPathAbsolute)).to.equal(true);
                        expect(fs.readFileSync(toPathAbsolute, 'utf8')).to.equal(fileContent);
                        return cb();
                    },
                    (cb)=>removePath(fromPath, cb),
                ],
                done
            );
        });
    });

    describe('getReadStreamForFile', function () {
        it('will return a readStream, and during streaming will not emit "changed" event', function (done) {
            const fileContent = getRandomString(1024);
            const fromPath = 'from.txt';
            const toPath = 'to.txt';
            const fromPathAbsolute = `${TEST_DIR}/${fromPath}`;

            async.series(
                [
                    (cb)=>createPath(fromPathAbsolute, fileContent, false, cb),
                    (cb)=> {
                        container = new FileContainer(TEST_DIR);
                        sandbox.spy(container, 'emit');
                        container.beginWatching(cb);
                    },
                    (cb)=> {
                        const stream = container.getReadStreamForFile(fromPath);
                        stream.on('end', cb);
                        stream.on('error', cb);
                        stream.pipe(fs.createWriteStream(toPath));
                    },
                    (cb)=>setTimeout(cb, FS_TIMEOUT),
                    (cb)=> {
                        expect(container.emit).not.to.have.been.called;
                        expect(pathExists(toPath)).to.equal(true);
                        expect(fs.readFileSync(toPath, 'utf8')).to.equal(fileContent);
                        return cb();
                    },
                    (cb)=>removePath(toPath, cb),
                ],
                done
            );
        });
    });

    describe('getFileMeta', function () {
        it('if a file exists, will return an object with name, and exists set to true', function (done) {
            const content = getRandomString(1000);
            const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

            async.series(
                [
                    (cb)=>createPath(`${TEST_DIR}/file.txt`, content, false, cb),
                    (cb)=> {
                        container = new FileContainer(TEST_DIR);
                        container.beginWatching(cb);
                    },
                    (cb)=> {
                        container.getFileMeta('file.txt', (err, data)=> {
                            if (err)return cb(err);

                            expect(data.exists).to.equal(true);
                            expect(data.isDirectory).to.equal(false);
                            expect(data.name).to.equal('file.txt');
                            expect(data.hashCode).to.equal(expectedHash);
                            expect(data.modified).to.deep.equal(fs.statSync(`${TEST_DIR}/file.txt`).mtime);
                            cb();
                        })
                    }
                ],
                done
            );
        });

        it('if a file does not exist, will return an object with name, and exists set to false, and hash of empty string', function (done) {
            async.series(
                [
                    (cb)=> {
                        container = new FileContainer(TEST_DIR);
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
                    }
                ],
                done
            );
        });

        it('if a file exists, and is a directory, will return correct data', function (done) {

            async.series(
                [
                    (cb)=>createPath(`${TEST_DIR}/dirA`, null, true, cb),
                    (cb)=> {
                        container = new FileContainer(TEST_DIR);
                        container.beginWatching(cb);
                    },
                    (cb)=> {
                        container.getFileMeta('dirA', (err, data)=> {
                            if (err)return cb(err);

                            expect(data.exists).to.equal(true);
                            expect(data.isDirectory).to.equal(true);
                            expect(data.name).to.equal('dirA');
                            expect(data.hashCode).to.equal('');
                            expect(data.modified).to.deep.equal(fs.statSync(`${TEST_DIR}/dirA`).mtime);
                            cb();
                        })
                    }
                ],
                done
            );
        })
    })
});
