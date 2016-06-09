///<reference path="sync_strategy.ts"/>
import {SynchronizationStrategy} from "./sync_strategy";
import {Messenger} from "../connection/messenger";
import {loggerFor} from "../utils/logger";
import * as async from "async";
import * as _ from "lodash";

const logger = loggerFor('PullStrategy');

export class PullStrategy extends SynchronizationStrategy {

    public synchronize(otherParty:Messenger, callback?:(err?:Error)=>any) {
        this.subject.getRemoteFileList(otherParty, (err, fileList)=> {
            if (err) return logger.error(err);

            async.each(fileList, (file, eachCallback)=>this.subject.requestRemoteFile(otherParty, file, eachCallback),
                callback || _.noop
            );
        })
    }
}