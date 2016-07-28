import {SyncActionParams} from "./sync_actions";
import {loggerFor} from "../utils/logger";

const logger = loggerFor('NoActionStrategy');

/**
 * Nothing will happen
 *
 * @param params
 * @param callback
 */
export function noAction(params:SyncActionParams, callback:ErrorCallback) {
    logger.info(`no action needed`);
    return callback();
}