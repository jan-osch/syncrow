var logger_1 = require("../utils/logger");
var generic_commands_action_1 = require("./generic_commands_action");
var debug = logger_1.debugFor('syncrow:sync:pull');
var logger = logger_1.loggerFor('PullAction');
/**
 * It will download all files from remote.
 *
 * @param params
 * @param callback
 */
function pullAction(params, callback) {
    return generic_commands_action_1.genericCommandsAction(params, callback, issueCommands);
}
exports.pullAction = pullAction;
function issueCommands(params, metaTuple, callback) {
    if (metaTuple.remoteMeta.exists && !metaTuple.localMeta.exists) {
        if (metaTuple.remoteMeta.isDirectory) {
            return params.container.createDirectory(metaTuple.localMeta.name, callback);
        }
        return params.subject.requestRemoteFile(params.remoteParty, metaTuple.localMeta.name, callback);
    }
    if (!metaTuple.remoteMeta.exists && metaTuple.localMeta.exists) {
        if (params.deleteLocalIfRemoteMissing) {
            return params.container.deleteFile(metaTuple.localMeta.name, callback);
        }
        debug("File: " + metaTuple.localMeta.name + " exists locally but does not remotely - it will be ignored");
        return callback();
    }
    if (metaTuple.remoteMeta.exists && metaTuple.localMeta.exists) {
        if (metaTuple.localMeta.isDirectory) {
            return callback();
        }
        if (metaTuple.localMeta.hashCode === metaTuple.remoteMeta.hashCode) {
            return callback();
        }
        return params.subject.requestRemoteFile(params.remoteParty, metaTuple.localMeta.name, callback);
    }
    logger.warn("File " + metaTuple.localMeta.name + " - does not exist locally or remotely");
    return callback();
}
//# sourceMappingURL=pull_action.js.map