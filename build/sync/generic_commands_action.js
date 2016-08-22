var sync_actions_1 = require("./sync_actions");
var async = require("async");
var _ = require("lodash");
/**
 * Used to create actions that process the synchronization in context of one file
 * All files will be synced in parallel
 *
 * @param params
 * @param callback
 * @param commandsFunction
 */
function genericCommandsAction(params, callback, commandsFunction) {
    return async.waterfall([
        function (cb) { return sync_actions_1.getFileLists(params, cb); },
        function (list, cb) { return processFileLists(params, list, cb, commandsFunction); }
    ], callback);
}
exports.genericCommandsAction = genericCommandsAction;
function processFileLists(params, lists, callback, commandsFunction) {
    var combined = _.union(lists.localList, lists.remoteList);
    return async.each(combined, function (file, cb) { return processFile(params, file, cb, commandsFunction); }, callback);
}
function processFile(params, file, callback, commandsFunction) {
    return async.waterfall([
        function (cb) { return sync_actions_1.getMetaTupleForFile(params, file, cb); },
        function (metaTuple, cb) { return commandsFunction(params, metaTuple, cb); }
    ], callback);
}
//# sourceMappingURL=generic_commands_action.js.map