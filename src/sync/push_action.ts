import {SyncActionParams, MetaTuple} from "./sync_actions";
import {debugFor, loggerFor} from "../utils/logger";
import {genericCommandsAction} from "./generic_commands_action";

const debug = debugFor('syncrow:sync:newest');
const logger = loggerFor('GetNewestSyncAction');


/**
 * It will push all files to remote.
 *
 * @param params
 * @param callback
 */
export function pushAction(params:SyncActionParams, callback:ErrorCallback):any {
    return genericCommandsAction(params, callback, issueCommands)
}


function issueCommands(params:SyncActionParams, metaTuple:MetaTuple, callback:ErrorCallback) {
    if (metaTuple.localMeta.exists && !metaTuple.remoteMeta.exists) {
        if (metaTuple.localMeta.isDirectory) {
            params.subject.createRemoteDirectory(params.remoteParty, metaTuple.localMeta.name);
            return callback();
        }

        return params.subject.pushFileToRemote(params.remoteParty, metaTuple.localMeta.name, callback);
    }

    if (metaTuple.localMeta.exists && metaTuple.remoteMeta.exists) {
        if (params.deleteRemoteIfLocalMissing) {
            params.subject.deleteRemoteFile(params.remoteParty, metaTuple.localMeta.name);
            return callback();
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

        return params.subject.pushFileToRemote(params.remoteParty, metaTuple.localMeta.name, callback);
    }

    logger.warn(`File ${metaTuple.localMeta.name} - does not exist locally or remotely`);

    return callback();
}
