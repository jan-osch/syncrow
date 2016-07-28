import {NoActionStrategy} from "./no_action_strategy";
import * as async from "async";
import {debugFor, loggerFor} from "../utils/logger";
import {Messenger} from "../connection/messenger";

const debug = debugFor('syncrow:strategy:pull');
const logger = loggerFor('PullStrategy');

/**
 * On every reconnection pull everything from remote
 */
export class PullStrategy extends NoActionStrategy {

    private pulled:boolean;

    constructor() {
        super();
        this.pulled = false;
    }

    /**
     * @override
     * @param otherParty
     * @param doneCallback
     * @returns {undefined}
     */
    public synchronize(otherParty:Messenger, doneCallback:ErrorCallback):any {
        if (this.pulled) return super.synchronize(otherParty, doneCallback);

        debug('did not pull before -starting to requesting remote file list');

        async.waterfall(
            [
                (gotListCallback)=> this.subject.getRemoteFileList(otherParty, gotListCallback),
                (fileList, filesSyncedCallback)=> this.synchronizeFileList(otherParty, fileList, filesSyncedCallback)
            ],
            (err)=>{
                if(err) return doneCallback(err);
                this.pulled = true;
                logger.info(`pulled all files - switching to no-action strategy`)
            }
        );
    }

    private synchronizeFileList(otherParty:Messenger, fileList:Array<string>, doneCallback:any) {
        async.each(fileList,

            (file, fileSyncedCallback)=>this.synchronizeFile(otherParty, file, fileSyncedCallback),

            doneCallback
        );
    }

    private synchronizeFile(otherParty:Messenger, file:string, callback:ErrorCallback) {
        this.subject.getRemoteFileMeta(otherParty, file, (err, syncData)=> {
            if (err) return callback(err);

            if (syncData.isDirectory) {
                return this.container.createDirectory(file, callback);
            }

            return this.subject.requestRemoteFile(otherParty, file, callback);
        });
    }
}
