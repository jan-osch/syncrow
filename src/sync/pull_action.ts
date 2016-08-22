import {debugFor, loggerFor} from "../utils/logger";
import {SyncActionParams, MetaTuple} from "./sync_actions";
import {genericCommandsAction} from "./generic_commands_action";

const debug = debugFor('syncrow:sync:pull');
const logger = loggerFor('PullAction');


/**
 * It will download all files from remote.
 *
 * @param params
 * @param callback
 */
export function pullAction(params:SyncActionParams, callback:ErrorCallback):any {
    return genericCommandsAction(params, callback, issueCommands)
}


function issueCommands(params:SyncActionParams, metaTuple:MetaTuple, callback:ErrorCallback) {
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

        debug(`File: ${metaTuple.localMeta.name} exists locally but does not remotely - it will be ignored`);
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

    logger.warn(`File ${metaTuple.localMeta.name} - does not exist locally or remotely`);

    return callback();
}
