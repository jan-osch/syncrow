import {Event} from "../client/events_helper";
import {Messenger} from "./messenger";
import {FileContainer} from "../fs_helpers/file_container";
import {TransferActions} from "./transfer_actions";
import {TransferQueue} from "./transfer_queue";


/**
 * Helper function for convenience
 * @param event
 * @param otherParty
 * @param sourceContainer
 * @param transferQueue
 * @param uploadTimingMessage
 * @param downloadTimingMessage
 * @returns {boolean}
 */
export function handleTransferEvents(event:Event,
                                     otherParty:Messenger,
                                     sourceContainer:FileContainer,
                                     transferQueue:TransferQueue,
                                     uploadTimingMessage = '',
                                     downloadTimingMessage = ''):boolean {

    if (event.type === TransferActions.events.connectAndUpload) {
        transferQueue.addConnectAndUploadJobToQueue(event.body.fileName, event.body.address,
            sourceContainer, `${uploadTimingMessage} uploading: ${event.body.fileName}`);
        return true;

    } else if (event.type === TransferActions.events.connectAndDownload) {
        transferQueue.addConnectAndDownloadJobToQueue(event.body.address, event.body.fileName,
            sourceContainer, `${downloadTimingMessage} downloading: ${event.body.fileName}`);
        return true;

    } else if (event.type === TransferActions.events.listenAndDownload) {
        transferQueue.addListenAndDownloadJobToQueue(otherParty, event.body.fileName,
            otherParty.getOwnHost(), sourceContainer, `${downloadTimingMessage} downloading: ${event.body.fileName}`);
        return true;

    } else if (event.type === TransferActions.events.listenAndUpload) {
        transferQueue.addListenAndUploadJobToQueue(event.body.fileName, otherParty,
            otherParty.getOwnHost(), sourceContainer, `${uploadTimingMessage} uploading: ${event.body.fileName}`);
        return true;
    }

    return false;
}