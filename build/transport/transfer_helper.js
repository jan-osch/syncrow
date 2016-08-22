var transfer_queue_1 = require("./transfer_queue");
var callback_helper_1 = require("../connection/callback_helper");
var transfer_actions_1 = require("./transfer_actions");
var logger_1 = require("../utils/logger");
var callbackHelper = callback_helper_1.CallbackHelper.getInstance();
var logger = logger_1.loggerFor('TransferHelper');
var TransferHelper = (function () {
    function TransferHelper(container, connectionHelper, options) {
        this.connectionHelper = connectionHelper;
        var queueSize = options.transferQueueSize ? options.transferQueueSize : 1000;
        this.queue = new transfer_queue_1.TransferQueue(queueSize, options.name);
        this.preferConnecting = options.preferConnecting;
        this.container = container;
    }
    /**
     * Used to handle messages passed by caller
     * @param transferMessage
     * @param otherParty
     */
    TransferHelper.prototype.consumeMessage = function (transferMessage, otherParty) {
        if (transferMessage.command === transfer_actions_1.TransferActions.events.connectAndUpload) {
            this.queue.addConnectAndUploadJobToQueue(transferMessage.fileName, transferMessage.address, this.container, this.connectionHelper, this.getCallbackForIdOrErrorLogger(transferMessage.id));
        }
        else if (transferMessage.command === transfer_actions_1.TransferActions.events.connectAndDownload) {
            this.queue.addConnectAndDownloadJobToQueue(transferMessage.fileName, transferMessage.address, this.container, this.connectionHelper, this.getCallbackForIdOrErrorLogger(transferMessage.id));
        }
        else if (transferMessage.command === transfer_actions_1.TransferActions.events.listenAndDownload) {
            return this.sendFileViaListening(transferMessage.fileName, otherParty, { id: transferMessage.id });
        }
        else if (transferMessage.command === transfer_actions_1.TransferActions.events.listenAndUpload) {
            return this.sendFileViaListening(transferMessage.fileName, otherParty, { id: transferMessage.id });
        }
    };
    /**
     * Downloads a file from remote
     * @param otherParty
     * @param fileName
     * @param callback
     */
    TransferHelper.prototype.getFileFromRemote = function (otherParty, fileName, callback) {
        if (this.preferConnecting) {
            var id = callbackHelper.addCallback(callback);
            var message = {
                fileName: fileName,
                id: id,
                command: transfer_actions_1.TransferActions.events.listenAndUpload
            };
            return otherParty.send(TransferHelper.outerEvent, message);
        }
        return this.getFileViaListening(fileName, otherParty, { callback: callback });
    };
    /**
     * Uploads a file to remote
     * @param otherParty
     * @param fileName
     * @param callback
     */
    TransferHelper.prototype.sendFileToRemote = function (otherParty, fileName, callback) {
        if (this.preferConnecting) {
            var id = callbackHelper.addCallback(callback);
            var message = {
                command: transfer_actions_1.TransferActions.events.listenAndDownload,
                id: id,
                fileName: fileName
            };
            return otherParty.send(TransferHelper.outerEvent, message);
        }
        return this.sendFileViaListening(fileName, otherParty, { callback: callback });
    };
    TransferHelper.prototype.sendFileViaListening = function (fileName, remote, optional) {
        this.queue.addListenAndUploadJobToQueue(fileName, this.container, this.connectionHelper, function (address) {
            var message = {
                fileName: fileName,
                command: transfer_actions_1.TransferActions.events.connectAndDownload,
                address: address,
                id: optional.id
            };
            remote.send(TransferHelper.outerEvent, message);
        }, optional.callback);
    };
    TransferHelper.prototype.getFileViaListening = function (fileName, remote, optional) {
        this.queue.addListenAndDownloadJobToQueue(fileName, this.container, this.connectionHelper, function (address) {
            var message = {
                fileName: fileName,
                command: transfer_actions_1.TransferActions.events.connectAndUpload,
                address: address,
                id: optional.id
            };
            remote.send(TransferHelper.outerEvent, message);
        }, optional.callback);
    };
    TransferHelper.prototype.getCallbackForIdOrErrorLogger = function (id) {
        if (id)
            return callbackHelper.getCallback(id);
        return function (err) {
            logger.error(err);
        };
    };
    TransferHelper.outerEvent = 'transferEvent';
    return TransferHelper;
})();
exports.TransferHelper = TransferHelper;
//# sourceMappingURL=transfer_helper.js.map