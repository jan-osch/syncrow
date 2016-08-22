var logger_1 = require("../utils/logger");
var logger = logger_1.loggerFor('NoActionStrategy');
/**
 * Nothing will happen
 *
 * @param params
 * @param callback
 */
function noAction(params, callback) {
    logger.info("no action needed");
    return callback();
}
exports.noAction = noAction;
//# sourceMappingURL=no_action.js.map