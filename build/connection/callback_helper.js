var logger_1 = require("../utils/logger");
var debug = logger_1.debugFor('syncrow:transport:callback_helper');
var instance;
var CallbackHelper = (function () {
    /**
     * Used to exchange messages with callbacks
     */
    function CallbackHelper() {
        this.callbackMap = new Map();
    }
    /**
     * Returns callback if it exists
     * @param id
     * @returns {function(Error, Event): any}
     */
    CallbackHelper.prototype.getCallback = function (id) {
        if (id && this.callbackMap.has(id)) {
            debug("found callback for stored id: " + id);
            var callback = this.callbackMap.get(id);
            this.callbackMap.delete(id);
            return callback;
        }
        debug("callback not found for id: " + id);
    };
    /**
     * Generates an Id
     * @returns {string}
     */
    CallbackHelper.generateEventId = function () {
        return Math.random().toString();
    };
    /**
     * Adds a function to map of remembered callbacks
     * @throws Error if id already exists
     * @param id
     * @param callback
     */
    CallbackHelper.prototype.addCallbackWithId = function (id, callback) {
        if (this.callbackMap.has(id)) {
            throw new Error("callback id: " + id + " already exists");
        }
        debug("setting a callback for id: " + id);
        this.callbackMap.set(id, callback);
    };
    /**
     * Handy function that generates id stores the callback and returns id
     * @param callback
     * @returns {string} id
     */
    CallbackHelper.prototype.addCallback = function (callback) {
        var id = CallbackHelper.generateEventId();
        this.addCallbackWithId(id, callback);
        return id;
    };
    /**
     * Returns global instance of CallbackHelper
     * @returns {null}
     */
    CallbackHelper.getInstance = function () {
        if (!instance) {
            debug("New instance of callbackHelper is created");
            instance = new CallbackHelper();
        }
        return instance;
    };
    /**
     * If something fails
     * @param id
     */
    CallbackHelper.prototype.deleteMapping = function (id) {
        if (this.callbackMap.delete(id)) {
            return;
        }
        throw new Error("callback id: " + id + " did not exist");
    };
    return CallbackHelper;
})();
exports.CallbackHelper = CallbackHelper;
//# sourceMappingURL=callback_helper.js.map