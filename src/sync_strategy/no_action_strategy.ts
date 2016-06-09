import {SynchronizationStrategy} from "./sync_strategy";
import {loggerFor} from "../utils/logger";
import {Messenger} from "../connection/messenger";

const logger = loggerFor('NoActionStrategy');

export class NoActionStrategy extends SynchronizationStrategy {

    /**
     * Takes no action when connected
     * @param otherParty
     * @param callback
     */
    public synchronize(otherParty:Messenger, callback:Function) {
        logger.info(`no action needed`);
        callback();
    }
}
