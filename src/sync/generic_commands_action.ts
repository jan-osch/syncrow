import {SyncActionParams, MetaTuple, getFileLists, FileLists, getMetaTupleForFile} from "./sync_actions";
import * as async from "async";
import * as _ from "lodash";

export interface CommandsFunction {
    (params:SyncActionParams, metaTuple:MetaTuple, callback:ErrorCallback):any;
}

/**
 * Used to create actions that process the synchronization in context of one file
 * All files will be synced in parallel
 *
 * @param params
 * @param callback
 * @param commandsFunction
 */
export function genericCommandsAction(params:SyncActionParams, callback:ErrorCallback, commandsFunction:CommandsFunction):any {
    return async.waterfall(
        [
            (cb)=>getFileLists(params, cb),
            (list, cb)=>processFileLists(params, list, cb, commandsFunction)
        ],

        callback
    )
}


function processFileLists(params:SyncActionParams, lists:FileLists, callback:ErrorCallback, commandsFunction:CommandsFunction) {
    const combined = _.union(lists.localList, lists.remoteList);

    return async.each(combined,
        (file, cb)=>processFile(params, file, cb, commandsFunction),
        callback
    )
}

function processFile(params:SyncActionParams, file:string, callback:ErrorCallback, commandsFunction:CommandsFunction) {
    return async.waterfall(
        [
            (cb)=>getMetaTupleForFile(params, file, cb),
            (metaTuple, cb)=>commandsFunction(params, metaTuple, cb)
        ],
        callback
    );
}
