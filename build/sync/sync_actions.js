var async = require("async");
var logger_1 = require("../utils/logger");
var debug = logger_1.debugFor('syncrow:sync_actions');
/**
 * @param action
 * @returns {(params:SyncActionParams, callback:ErrorCallback)=>any}
 */
function setDeleteLocalFiles(action) {
    return function (params, callback) {
        params.deleteLocalIfRemoteMissing = true;
        return action(params, callback);
    };
}
exports.setDeleteLocalFiles = setDeleteLocalFiles;
/**
 * @param action
 * @returns {(params:SyncActionParams, callback:ErrorCallback)=>any}
 */
function setDeleteRemoteFiles(action) {
    return function (params, callback) {
        params.deleteRemoteIfLocalMissing = true;
        return action(params, callback);
    };
}
exports.setDeleteRemoteFiles = setDeleteRemoteFiles;
/**
 * @param params
 * @param file
 * @param callback
 */
function getMetaTupleForFile(params, file, callback) {
    debug("getting file meta from both remote and local: " + file);
    async.parallel({
        localMeta: function (parallelCallback) {
            params.container.getFileMeta(file, parallelCallback);
        },
        remoteMeta: function (parallelCallback) {
            params.subject.getRemoteFileMeta(params.remoteParty, file, parallelCallback);
        }
    }, callback);
}
exports.getMetaTupleForFile = getMetaTupleForFile;
/**
 * @param params
 * @param callback
 */
function getFileLists(params, callback) {
    return async.parallel({
        localList: function (cb) { return params.container.getFileTree(cb); },
        remoteList: function (cb) { return params.subject.getRemoteFileList(params.remoteParty, cb); }
    }, callback);
}
exports.getFileLists = getFileLists;
//# sourceMappingURL=sync_actions.js.map