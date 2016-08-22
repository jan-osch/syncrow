var async = require("async");
var test_utils_1 = require("../test_utils");
var listen_1 = require("../../core/listen");
var connect_1 = require("../../core/connect");
var engine_1 = require("../../core/engine");
var mkdirp = require("mkdirp");
var fs = require("fs");
var chai_1 = require("chai");
var FS_TIMEOUT = 400;
describe('Engine', function () {
    var listeningEngine;
    var connectingEngine;
    var token = '121cb2897o1289nnjos';
    var port = 4321;
    beforeEach(function (done) {
        return async.waterfall([
            function (cb) { return test_utils_1.createPathSeries([
                { path: 'engine_test/aaa', directory: true },
                { path: 'engine_test/bbb', directory: true }
            ], cb); },
            function (cb) {
                listen_1.default('engine_test/aaa', port, {
                    authenticate: true,
                    externalHost: '0.0.0.0',
                    initialToken: token,
                    watch: true
                }, cb);
            },
            function (engine, cb) {
                listeningEngine = engine;
                return connect_1.default(port, '0.0.0.0', 'engine_test/bbb', {
                    authenticate: true,
                    initialToken: token,
                    watch: true
                }, cb);
            },
            function (engine, cb) {
                connectingEngine = engine;
                return setImmediate(cb);
            }
        ], done);
    });
    afterEach(function (done) {
        if (listeningEngine)
            listeningEngine.shutdown();
        if (connectingEngine)
            connectingEngine.shutdown();
        return test_utils_1.removePath('engine_test', done);
    });
    it('two engines will transfer new file and and create new directory when needed', function (done) {
        var ifErrorBreak = function (err) {
            if (err)
                return done(err);
        };
        countMultipleEvents(connectingEngine, [
            { eventName: engine_1.Engine.events.newDirectory, count: 1 },
            { eventName: engine_1.Engine.events.changedFile, count: 1 }
        ], function (err) {
            if (err)
                return done(err);
            return test_utils_1.compareTwoFiles('engine_test/aaa/inner/file.txt', 'engine_test/bbb/inner/file.txt', function (err, result) {
                if (err)
                    return done(err);
                chai_1.assert(result.first !== result.second);
                done();
            });
        });
        mkdirp('engine_test/aaa/inner', ifErrorBreak);
        fs.writeFile('engine_test/aaa/inner/file.txt', test_utils_1.getRandomString(4000), ifErrorBreak);
    });
    it('two engines will transfer handle deleting files', function (done) {
        var ifErrorBreak = function (err) {
            if (err)
                return done(err);
        };
        countEvents(listeningEngine, engine_1.Engine.events.deletedPath, 1, done);
        async.series([
            function (cb) { return mkdirp('engine_test/bbb/inner/', cb); },
            function (cb) { return fs.writeFile('engine_test/bbb/inner/file_1.txt', '123123123', 'utf8', cb); },
            function (cb) { return setTimeout(function () { return test_utils_1.removePath('engine_test/bbb/inner/file_1.txt', cb); }, FS_TIMEOUT); }
        ], ifErrorBreak);
    });
    it('two engines will synchronize multiple files both ways', function (done) {
        var ifErrorBreak = function (err) {
            if (err)
                return done(err);
        };
        var shouldEnd = false;
        var testEnd = function (err) {
            if (err)
                return done(err);
            if (shouldEnd)
                return test_utils_1.compareDirectories('engine_test/aaa', 'engine_test/bbb', done);
            shouldEnd = true;
        };
        countEvents(listeningEngine, engine_1.Engine.events.changedFile, 4, testEnd);
        countEvents(connectingEngine, engine_1.Engine.events.changedFile, 2, testEnd);
        test_utils_1.createPathSeries([
            { path: 'engine_test/aaa/a.txt', content: test_utils_1.getRandomString(50000) },
            { path: 'engine_test/aaa/b.txt', content: test_utils_1.getRandomString(50000) },
            { path: 'engine_test/bbb/c.txt', content: test_utils_1.getRandomString(50000) },
            { path: 'engine_test/bbb/d.txt', content: test_utils_1.getRandomString(500000) },
            { path: 'engine_test/bbb/e.txt', content: test_utils_1.getRandomString(500) },
            { path: 'engine_test/bbb/f.txt', content: test_utils_1.getRandomString(500) },
        ], ifErrorBreak);
    });
});
function countMultipleEvents(emitter, events, callback) {
    return async.each(events, function (eventAndCount, cb) { return countEvents(emitter, eventAndCount.eventName, eventAndCount.count, cb); }, callback);
}
function countEvents(emitter, eventName, count, callback) {
    var emitted = 0;
    var finish = function () {
        emitter.removeListener(eventName, checkEmitted);
        callback();
    };
    var checkEmitted = function () {
        emitted++;
        if (emitted === count) {
            finish();
        }
    };
    return emitter.on(eventName, checkEmitted);
}
//# sourceMappingURL=engine_test.js.map