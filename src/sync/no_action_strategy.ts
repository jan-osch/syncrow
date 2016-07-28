import {SyncAction, SynchronizationFunction, SyncActionFactory} from "./sync_actions";
import {loggerFor} from "../utils/logger";
import {Messenger} from "../connection/messenger";

const logger = loggerFor('NoActionStrategy');

export class NoActionSyncActionFactory implements SyncActionFactory{
    sync(remoteParty:EventedMessenger, container:FileContainer, subject:SyncActionSubject, callback:ErrorCallback):any {
        return undefined;
    }

}
