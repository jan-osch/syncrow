var test_utils_1 = require("./test_utils");
var chai = require("chai");
var chai_1 = require("chai");
var sinon = require("sinon");
var file_container_1 = require("../fs_helpers/file_container");
var async = require("async");
var sinonChai = require("sinon-chai");
var fs = require("fs");
var crypto = require("crypto");
chai.use(sinonChai);
var fileContainerTimeout = 400;
describe('FileContainer', function () {
    var sandbox;
    var container;
    beforeEach(function () {
        sandbox = sinon.sandbox.create();
        sandbox.stub(console, 'info');
    });
    afterEach(function () {
        sandbox.restore();
        container.shutdown();
        container = null;
    });
    describe('getFileTree', function () {
        it('list of files from the directory', function (done) {
            var testDir = 'testDir';
            var testFiles = [
                { path: testDir, directory: true },
                { path: testDir + "/file1.txt", content: "ibberish" },
                { path: testDir + "/file2.txt", content: "jk123jj9casc" },
                { path: testDir + "/dir", directory: true },
            ];
            var expected = [
                'file1.txt', 'file2.txt', 'dir'
            ];
            async.series([
                function (cb) { return test_utils_1.removePath(testDir, cb); },
                function (cb) { return test_utils_1.createPathSeries(testFiles, cb); },
                function (cb) {
                    container = new file_container_1.FileContainer(testDir);
                    container.beginWatching(cb);
                },
                function (cb) {
                    container.getFileTree(function (err, files) {
                        chai_1.expect(err).not.to.be.defined;
                        chai_1.expect(files).to.have.lengthOf(expected.length);
                        chai_1.expect(files).to.have.members(expected);
                        cb();
                    });
                },
                function (cb) { return test_utils_1.removePath(testDir, cb); }
            ], done);
        });
        it('list of files from the directory, including hidden files and directories, also from deeply nested directories', function (done) {
            var testDir = 'testDir';
            var testFiles = [
                { path: testDir, directory: true },
                { path: testDir + "/.file1.txt", content: "ibberish" },
                { path: testDir + "/.dir", directory: true },
                { path: testDir + "/.dir/.file2.txt", content: "jk123jj9casc" },
                { path: testDir + "/.dir/.dir1/.dir2/.dir3", directory: true },
                { path: testDir + "/.dir/.dir1/.dir2/.dir3/.file3.txt", content: '' },
            ];
            var expected = [
                '.file1.txt',
                '.dir/.file2.txt',
                '.dir',
                '.dir/.dir1',
                '.dir/.dir1/.dir2',
                '.dir/.dir1/.dir2/.dir3',
                '.dir/.dir1/.dir2/.dir3/.file3.txt'
            ];
            async.series([
                function (cb) { return test_utils_1.removePath(testDir, cb); },
                function (cb) { return test_utils_1.createPathSeries(testFiles, cb); },
                function (cb) {
                    container = new file_container_1.FileContainer(testDir);
                    container.beginWatching(cb);
                },
                function (cb) {
                    container.getFileTree(function (err, files) {
                        chai_1.expect(err).not.to.be.defined;
                        chai_1.expect(files).to.have.lengthOf(expected.length);
                        chai_1.expect(files).to.have.members(expected);
                        cb();
                    });
                },
                function (cb) { return test_utils_1.removePath(testDir, cb); }
            ], done);
        });
        it('list of files from the directory, ignoring the files from filter function', function (done) {
            var testDir = 'testDir';
            var testFiles = [
                { path: testDir, directory: true },
                { path: testDir + "/file1.txt", content: "ibberish" },
                { path: testDir + "/ignored", directory: true },
                { path: testDir + "/ignored/file3.txt", content: '' },
                { path: testDir + "/dir", directory: true },
                { path: testDir + "/dir/not_ignored.txt", content: "jk123jj9casc" },
                { path: testDir + "/dir/ignoredFile.txt", content: 'jknnkjasd' },
            ];
            var expected = [
                'file1.txt',
                'dir',
                'dir/not_ignored.txt',
            ];
            function ignore(path) {
                return [(testDir + "/ignored"), (testDir + "/dir/ignoredFile.txt")].indexOf(path) !== -1;
            }
            async.series([
                function (cb) { return test_utils_1.removePath(testDir, cb); },
                function (cb) { return test_utils_1.createPathSeries(testFiles, cb); },
                function (cb) {
                    container = new file_container_1.FileContainer(testDir, { filter: ignore });
                    container.beginWatching(cb);
                },
                function (cb) {
                    container.getFileTree(function (err, files) {
                        chai_1.expect(err).not.to.be.defined;
                        chai_1.expect(files).to.have.lengthOf(expected.length);
                        chai_1.expect(files).to.have.members(expected);
                        cb();
                    });
                },
                function (cb) { return test_utils_1.removePath(testDir, cb); }
            ], done);
        });
    });
    describe('deleteFile', function () {
        it('will delete a file or directory', function (done) {
            var testDir = 'testDir';
            var testFiles = [
                { path: testDir, directory: true },
                { path: testDir + "/file1.txt", content: "xxx" },
                { path: testDir + "/dirA", directory: true },
                { path: testDir + "/dirA/file.txt", content: 'xxx' },
                { path: testDir + "/dirA/file2.txt", content: 'xxx' },
                { path: testDir + "/dirB", directory: true },
                { path: testDir + "/dirB/file2.txt", content: 'xxx' },
                { path: testDir + "/dirB/file3.txt", content: 'xxx' },
            ];
            async.series([
                function (cb) { return test_utils_1.removePath(testDir, cb); },
                function (cb) { return test_utils_1.createPathSeries(testFiles, cb); },
                function (cb) {
                    container = new file_container_1.FileContainer(testDir);
                    container.beginWatching(cb);
                },
                function (cb) { return container.deleteFile('file1.txt', cb); },
                function (cb) { return container.deleteFile('dirA', cb); },
                function (cb) { return container.deleteFile('dirB/file2.txt', cb); },
                function (cb) {
                    chai_1.expect(test_utils_1.pathExists(testDir)).to.be.true;
                    chai_1.expect(test_utils_1.pathExists(testDir + "/file1.txt")).to.be.false;
                    chai_1.expect(test_utils_1.pathExists(testDir + "/dirA")).to.be.false;
                    chai_1.expect(test_utils_1.pathExists(testDir + "/dirA/file.txt")).to.be.false;
                    chai_1.expect(test_utils_1.pathExists(testDir + "/dirA/file2.txt")).to.be.false;
                    chai_1.expect(test_utils_1.pathExists(testDir + "/dirB")).to.be.true;
                    chai_1.expect(test_utils_1.pathExists(testDir + "/dirB/file2.txt")).to.be.false;
                    chai_1.expect(test_utils_1.pathExists(testDir + "/dirB/file3.txt")).to.be.true;
                    cb();
                },
                function (cb) { return test_utils_1.removePath(testDir, cb); }
            ], done);
        });
    });
    describe('emitting messages', function () {
        it('will emit fileCreated event with correct path', function (done) {
            var testDir = 'emittingEvents';
            async.series([
                function (cb) { return test_utils_1.removePath(testDir, cb); },
                function (cb) { return test_utils_1.createPath(testDir, null, true, cb); },
                function (cb) {
                    container = new file_container_1.FileContainer(testDir);
                    sandbox.spy(container, 'emit');
                    container.beginWatching(cb);
                },
                function (cb) { return test_utils_1.createPath(testDir + "/file.txt", 'xxx', false, cb); },
                function (cb) { return setTimeout(cb, fileContainerTimeout); },
                function (cb) {
                    chai_1.expect(container.emit).to.have.been.calledOnce;
                    chai_1.expect(container.emit).have.been.calledWith('fileCreated', 'file.txt');
                    return cb();
                },
                function (cb) { return test_utils_1.removePath(testDir, cb); }
            ], done);
        });
        it('will emit fileDeleted event with correct path', function (done) {
            var testDir = 'emittingEvents';
            async.series([
                function (cb) { return test_utils_1.removePath(testDir, cb); },
                function (cb) { return test_utils_1.createPath(testDir, null, true, cb); },
                function (cb) { return test_utils_1.createPath(testDir + "/file.txt", 'xxx', false, cb); },
                function (cb) {
                    container = new file_container_1.FileContainer(testDir);
                    sandbox.spy(container, 'emit');
                    container.beginWatching(cb);
                },
                function (cb) { return test_utils_1.removePath(testDir + "/file.txt", cb); },
                function (cb) { return setTimeout(cb, fileContainerTimeout); },
                function (cb) {
                    chai_1.expect(container.emit).to.have.been.calledOnce;
                    chai_1.expect(container.emit).have.been.calledWith('deleted', 'file.txt');
                    return cb();
                },
                function (cb) { return test_utils_1.removePath(testDir, cb); }
            ], done);
        });
        it('will emit createdDirectory event with correct path', function (done) {
            var testDir = 'emittingEvents';
            async.series([
                function (cb) { return test_utils_1.removePath(testDir, cb); },
                function (cb) { return test_utils_1.createPath(testDir, null, true, cb); },
                function (cb) {
                    container = new file_container_1.FileContainer(testDir);
                    sandbox.spy(container, 'emit');
                    container.beginWatching(cb);
                },
                function (cb) { return test_utils_1.createPath(testDir + "/dirA", null, true, cb); },
                function (cb) { return setTimeout(cb, fileContainerTimeout); },
                function (cb) {
                    chai_1.expect(container.emit).to.have.been.calledOnce;
                    chai_1.expect(container.emit).have.been.calledWith('createdDirectory', 'dirA');
                    return cb();
                },
                function (cb) { return test_utils_1.removePath(testDir, cb); }
            ], done);
        });
        it('will emit changed event with correct path', function (done) {
            var testDir = 'emittingEvents';
            async.series([
                function (cb) { return test_utils_1.removePath(testDir, cb); },
                function (cb) { return test_utils_1.createPath(testDir, null, true, cb); },
                function (cb) { return test_utils_1.createPath(testDir + "/file.txt", 'content\n', false, cb); },
                function (cb) {
                    container = new file_container_1.FileContainer(testDir);
                    sandbox.spy(container, 'emit');
                    container.beginWatching(cb);
                },
                function (cb) { return fs.appendFile(testDir + "/file.txt", 'second line', cb); },
                function (cb) { return setTimeout(cb, fileContainerTimeout); },
                function (cb) {
                    chai_1.expect(container.emit).to.have.been.calledOnce;
                    chai_1.expect(container.emit).have.been.calledWith('changed', 'file.txt');
                    return cb();
                },
                function (cb) { return test_utils_1.removePath(testDir, cb); }
            ], done);
        });
    });
    describe('consumeFileStream', function () {
        it('will write the file to destination without emitting changed messages', function (done) {
            var testDir = 'consumeFileStream';
            var fileContent = test_utils_1.getRandomString(1024);
            var fromPath = 'from.txt';
            var toPath = 'to.txt';
            var toPathAbsolute = testDir + "/" + toPath;
            async.series([
                function (cb) { return test_utils_1.removePath(testDir, cb); },
                function (cb) { return test_utils_1.createPath(testDir, null, true, cb); },
                function (cb) { return test_utils_1.createPath(fromPath, fileContent, false, cb); },
                function (cb) {
                    container = new file_container_1.FileContainer(testDir);
                    sandbox.spy(container, 'emit');
                    container.beginWatching(cb);
                },
                function (cb) {
                    var stream = fs.createReadStream(fromPath);
                    container.consumeFileStream(toPath, stream, cb);
                },
                function (cb) { return setTimeout(cb, fileContainerTimeout); },
                function (cb) {
                    chai_1.expect(container.emit).not.to.have.been.called;
                    chai_1.expect(test_utils_1.pathExists(toPathAbsolute)).to.equal(true);
                    chai_1.expect(fs.readFileSync(toPathAbsolute, 'utf8')).to.equal(fileContent);
                    return cb();
                },
                function (cb) { return test_utils_1.removePath(fromPath, cb); },
                function (cb) { return test_utils_1.removePath(testDir, cb); }
            ], done);
        });
    });
    describe('getReadStreamForFile', function () {
        it('will return a readStream, and during streaming will not emit "changed" event', function (done) {
            var testDir = 'consumeFileStream';
            var fileContent = test_utils_1.getRandomString(1024);
            var fromPath = 'from.txt';
            var toPath = 'to.txt';
            var fromPathAbsolute = testDir + "/" + fromPath;
            async.series([
                function (cb) { return test_utils_1.removePath(testDir, cb); },
                function (cb) { return test_utils_1.createPath(testDir, null, true, cb); },
                function (cb) { return test_utils_1.createPath(fromPathAbsolute, fileContent, false, cb); },
                function (cb) {
                    container = new file_container_1.FileContainer(testDir);
                    sandbox.spy(container, 'emit');
                    container.beginWatching(cb);
                },
                function (cb) {
                    var stream = container.getReadStreamForFile(fromPath);
                    stream.on('end', cb);
                    stream.on('error', cb);
                    stream.pipe(fs.createWriteStream(toPath));
                },
                function (cb) { return setTimeout(cb, fileContainerTimeout); },
                function (cb) {
                    chai_1.expect(container.emit).not.to.have.been.called;
                    chai_1.expect(test_utils_1.pathExists(toPath)).to.equal(true);
                    chai_1.expect(fs.readFileSync(toPath, 'utf8')).to.equal(fileContent);
                    return cb();
                },
                function (cb) { return test_utils_1.removePath(toPath, cb); },
                function (cb) { return test_utils_1.removePath(testDir, cb); }
            ], done);
        });
    });
    describe('getFileMeta', function () {
        it('if a file exists, will return an object with name, and exists set to true', function (done) {
            var testDir = 'getFileMeta';
            var content = test_utils_1.getRandomString(1000);
            var expectedHash = crypto.createHash('sha256').update(content).digest('hex');
            async.series([
                function (cb) { return test_utils_1.removePath(testDir, cb); },
                function (cb) { return test_utils_1.createPath(testDir, null, true, cb); },
                function (cb) { return test_utils_1.createPath(testDir + "/file.txt", content, false, cb); },
                function (cb) {
                    container = new file_container_1.FileContainer(testDir);
                    container.beginWatching(cb);
                },
                function (cb) {
                    container.getFileMeta('file.txt', function (err, data) {
                        if (err)
                            return cb(err);
                        chai_1.expect(data.exists).to.equal(true);
                        chai_1.expect(data.isDirectory).to.equal(false);
                        chai_1.expect(data.name).to.equal('file.txt');
                        chai_1.expect(data.hashCode).to.equal(expectedHash);
                        chai_1.expect(data.modified).to.deep.equal(fs.statSync(testDir + "/file.txt").mtime);
                        cb();
                    });
                },
                function (cb) { return test_utils_1.removePath(testDir, cb); }
            ], done);
        });
        it('if a file does not exist, will return an object with name, and exists set to false, and hash of empty string', function (done) {
            var testDir = 'getFileMeta';
            async.series([
                function (cb) { return test_utils_1.removePath(testDir, cb); },
                function (cb) { return test_utils_1.createPath(testDir, null, true, cb); },
                function (cb) {
                    container = new file_container_1.FileContainer(testDir);
                    container.beginWatching(cb);
                },
                function (cb) {
                    container.getFileMeta('file.txt', function (err, data) {
                        if (err)
                            return cb(err);
                        chai_1.expect(data.exists).to.equal(false);
                        chai_1.expect(data.isDirectory).to.equal(false);
                        chai_1.expect(data.name).to.equal('file.txt');
                        chai_1.expect(data.hashCode).to.equal('');
                        chai_1.expect(data.modified).to.be.null;
                        cb();
                    });
                },
                function (cb) { return test_utils_1.removePath(testDir, cb); }
            ], done);
        });
        it('if a file exists, and is a directory, will return correct data', function (done) {
            var testDir = 'getFileMeta';
            async.series([
                function (cb) { return test_utils_1.removePath(testDir, cb); },
                function (cb) { return test_utils_1.createPath(testDir, null, true, cb); },
                function (cb) { return test_utils_1.createPath(testDir + "/dirA", null, true, cb); },
                function (cb) {
                    container = new file_container_1.FileContainer(testDir);
                    container.beginWatching(cb);
                },
                function (cb) {
                    container.getFileMeta('dirA', function (err, data) {
                        if (err)
                            return cb(err);
                        chai_1.expect(data.exists).to.equal(true);
                        chai_1.expect(data.isDirectory).to.equal(true);
                        chai_1.expect(data.name).to.equal('dirA');
                        chai_1.expect(data.hashCode).to.equal('');
                        chai_1.expect(data.modified).to.deep.equal(fs.statSync(testDir + "/dirA").mtime);
                        cb();
                    });
                },
                function (cb) { return test_utils_1.removePath(testDir, cb); }
            ], done);
        });
    });
});
//# sourceMappingURL=file_container_test.js.map