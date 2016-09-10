import {SyncActionParams, MetaTuple, getFileLists, FileLists, getMetaTupleForFile} from "./sync_actions";
import * as async from "async";
import * as _ from "lodash";
import {debugFor} from "../utils/logger";

const debug = debugFor('syncrow:sync');

export interface CommandsFunction {
    (params:SyncActionParams, metaTuple:MetaTuple, callback:ErrorCallback):any;
}

const RETRY = 1;

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
            (cb)=> {
                getFileLists(params, cb)
            },
            (list, cb)=>processFileLists(params, list, cb, commandsFunction)
        ],

        callback
    )
}

function processFileLists(params:SyncActionParams, lists:FileLists, callback:ErrorCallback, commandsFunction:CommandsFunction) {
    debug(`local files: ${lists.localList} remote: ${lists.remoteList}`);
    const combined = _.union(lists.localList, lists.remoteList);

    return async.each(combined,

        (file, cb)=>async.retry(RETRY, (innerCallback)=>processFile(params, file, innerCallback, commandsFunction), cb),

        callback
    )
}

function processFile(params:SyncActionParams, file:string, callback:ErrorCallback, commandsFunction:CommandsFunction) {
    return async.waterfall(
        [
            (cb)=>async.retry(RETRY, (innerCallback)=>getMetaTupleForFile(params, file, innerCallback), cb),

            (metaTuple, cb)=>async.retry(RETRY, (innerCallback)=>commandsFunction(params, metaTuple, innerCallback), cb)
        ],
        callback
    );
}
