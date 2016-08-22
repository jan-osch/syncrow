var transfer_actions_1 = require("./transfer_actions");
var async = require("async");
var debugFor = require("debug");
var logger_1 = require("../utils/logger");
var debug = debugFor("syncrow:trasfer_queue");
var logger = logger_1.loggerFor('TransferQueue');
var TransferQueue = (function () {
    function TransferQueue(concurrency, name) {
        if (name === void 0) { name = ''; }
        this.queue = async.queue(function (job, callback) { return job(callback); }, concurrency);
        this.name = name;
    }
    /**
     * @param fileName
     * @param address
     * @param sourceContainer
     * @param connectionHelper
     * @param doneCallback
     */
    TransferQueue.prototype.addConnectAndUploadJobToQueue = function (fileName, address, sourceContainer, connectionHelper, doneCallback) {
        var timingMessage = this.name + " - connecting and uploading file: " + fileName;
        debug("adding job: connectAndUploadFile: " + fileName);
        var job = function (uploadingDoneCallback) {
            console.time(timingMessage);
            return transfer_actions_1.TransferActions.connectAndUploadFile(fileName, address, sourceContainer, connectionHelper, function (err) {
                console.timeEnd(timingMessage);
                return uploadingDoneCallback(err);
            });
        };
        this.queue.push(job, doneCallback);
    };
    /**
     *
     * @param address
     * @param fileName
     * @param destinationContainer
     * @param connectionHelper
     * @param doneCallback
     */
    TransferQueue.prototype.addConnectAndDownloadJobToQueue = function (fileName, address, destinationContainer, connectionHelper, doneCallback) {
        debug("adding job: connectAndDownloadFile: " + fileName);
        var timingMessage = this.name + " - connecting and downloading file: " + fileName;
        var job = function (downloadingDoneCallback) {
            console.time(timingMessage);
            return transfer_actions_1.TransferActions.connectAndDownloadFile(fileName, address, destinationContainer, connectionHelper, function (err) {
                console.timeEnd(timingMessage);
                return downloadingDoneCallback(err);
            });
        };
        this.queue.push(job, doneCallback);
    };
    /**
     *
     * @param fileName
     * @param sourceContainer
     * @param connectionHelper
     * @param listeningCallback
     * @param doneCallback
     */
    TransferQueue.prototype.addListenAndUploadJobToQueue = function (fileName, sourceContainer, connectionHelper, listeningCallback, doneCallback) {
        var timingMessage = this.name + " - listening and uploading file: " + fileName;
        debug("adding job: listenAndUploadFile " + fileName);
        var job = function (uploadingDoneCallback) {
            console.time(timingMessage);
            return transfer_actions_1.TransferActions.listenAndUploadFile(fileName, sourceContainer, connectionHelper, function (err) {
                console.timeEnd(timingMessage);
                return uploadingDoneCallback(err);
            }, listeningCallback);
        };
        this.queue.push(job, doneCallback);
    };
    /**
     *
     * @param fileName
     * @param destinationContainer
     * @param connectionHelper
     * @param doneCallback
     * @param listeningCallback
     */
    TransferQueue.prototype.addListenAndDownloadJobToQueue = function (fileName, destinationContainer, connectionHelper, listeningCallback, doneCallback) {
        debug("adding job: listenAndDownloadFile - fileName: " + fileName);
        var timingMessage = this.name + " - listening and downloading file: " + fileName;
        var job = function (downloadingDoneCallback) {
            console.time(timingMessage);
            return transfer_actions_1.TransferActions.listenAndDownloadFile(fileName, destinationContainer, connectionHelper, function (err) {
                console.timeEnd(timingMessage);
                return downloadingDoneCallback(err);
            }, listeningCallback);
        };
        return this.queue.push(job, doneCallback);
    };
    return TransferQueue;
})();
exports.TransferQueue = TransferQueue;
//# sourceMappingURL=transfer_queue.js.map