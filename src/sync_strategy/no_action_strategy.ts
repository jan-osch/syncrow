import {SynchronizationStrategy} from "./sync_strategy";
import {loggerFor} from "../utils/logger";
import {Messenger} from "../connection/messenger";

const logger = loggerFor('NoActionStrategy');

export class NoActionStrategy extends SynchronizationStrategy {

    /**
     * Takes no action when connected
     * @param otherParty
     */
    public synchronize(otherParty:Messenger) {
        logger.info(`no action needed`);
    }
}
