var logger_1 = require("../utils/logger");
var debug = logger_1.debugFor("syncrow:trasfer_actions");
var logger = logger_1.loggerFor('TransferActions');
var TransferActions = (function () {
    function TransferActions() {
    }
    /**
     * Listens for other party to connect, then downloads the file from it
     * @param fileName
     * @param destinationContainer
     * @param connectionHelper
     * @param doneCallback
     * @param listeningCallback
     */
    TransferActions.listenAndDownloadFile = function (fileName, destinationContainer, connectionHelper, doneCallback, listeningCallback) {
        debug("executing: listenAndDownloadFile - fileName: " + fileName);
        return connectionHelper.getNewSocket(function (err, socket) {
            if (err)
                return doneCallback(err);
            return TransferActions.consumeFileFromSocket(socket, fileName, destinationContainer, doneCallback);
        }, { listen: true, listenCallback: listeningCallback });
    };
    /**
     * Listen for other party to connect, and then send the file to it
     * @param fileName
     * @param sourceContainer
     * @param connectionHelper
     * @param doneCallback
     * @param listenCallback
     */
    TransferActions.listenAndUploadFile = function (fileName, sourceContainer, connectionHelper, doneCallback, listenCallback) {
        debug("executing: listenAndUploadFile - fileName: " + fileName);
        return connectionHelper.getNewSocket(function (err, fileTransferSocket) {
            if (err)
                return doneCallback(err);
            fileTransferSocket.on('end', doneCallback);
            fileTransferSocket.on('error', doneCallback);
            sourceContainer.getReadStreamForFile(fileName).pipe(fileTransferSocket);
        }, { listenCallback: listenCallback, listen: true });
    };
    /**
     * Connects with other party and sends the file to it
     * @param fileName
     * @param address
     * @param sourceContainer
     * @param connectionHelper
     * @param doneCallback
     */
    TransferActions.connectAndUploadFile = function (fileName, address, sourceContainer, connectionHelper, doneCallback) {
        debug("connectAndUploadFile: connecting to " + address.remoteHost + ":" + address.remotePort);
        connectionHelper.getNewSocket(function (err, socket) {
            if (err)
                return doneCallback(err);
            socket.on('end', doneCallback);
            socket.on('error', doneCallback);
            return sourceContainer.getReadStreamForFile(fileName).pipe(socket);
        }, address);
    };
    /**
     * Connects with other party and downloads a file from it
     * @param fileName
     * @param address
     * @param destinationContainer
     * @param connectionHelper
     * @param doneCallback
     */
    TransferActions.connectAndDownloadFile = function (fileName, address, destinationContainer, connectionHelper, doneCallback) {
        debug("connectAndDownloadFile: connecting to " + address.remoteHost + ":" + address.remotePort);
        connectionHelper.getNewSocket(function (err, socket) { return TransferActions.consumeFileFromSocket(socket, fileName, destinationContainer, doneCallback); }, address);
    };
    TransferActions.consumeFileFromSocket = function (fileTransferSocket, fileName, destinationContainer, callback) {
        destinationContainer.consumeFileStream(fileName, fileTransferSocket, callback);
    };
    TransferActions.events = {
        listenAndUpload: 'listenAndUpload',
        listenAndDownload: 'listenAndDownload',
        connectAndUpload: 'connectAndUpload',
        connectAndDownload: 'connectAndDownload',
    };
    return TransferActions;
})();
exports.TransferActions = TransferActions;
//# sourceMappingURL=transfer_actions.js.map