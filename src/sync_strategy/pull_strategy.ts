import {NoActionStrategy} from "./no_action_strategy";
import {SynchronizationStrategy, SyncData} from "./sync_strategy";
import * as async from "async";
import * as _ from "lodash";
import {debugFor, loggerFor} from "../utils/logger";
import {Messenger} from "../connection/messenger";

const debug = debugFor('syncrow:pull_strategy');
const logger = loggerFor('PullStrategy');

/**
 * On every reconnection pull everything from remote
 */
export class PullStrategy extends NoActionStrategy {

    private pulled: boolean

    constructor() {
        super();
        this.pulled = false;
    }

    public synchronize(otherParty: Messenger, callback: Function = _.noop): any {
        if (this.pulled) return super.synchronize(otherParty, callback);

        this.subject.getRemoteFileList((err, fileList: Array<string>) => {
            if (err) return callback(err);

            async.each(fileList,
                (fileName, eachCallback) => this.subject.requestRemoteFile(otherParty, fileName, eachCallback),
                (err) => {
                    if (err) return callback(err);

                    logger.info(`Pulled everything from remote - switching to no action strategy`);

                    this.pulled = true;
                    callback();
                }
            );
        })
    }
}
