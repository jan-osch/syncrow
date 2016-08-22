var logger_1 = require("../utils/logger");
var engine_1 = require("../core/engine");
var fs = require("fs");
var anymatch = require("anymatch");
var pull_action_1 = require("../sync/pull_action");
var program_1 = require("./program");
var no_action_1 = require("../sync/no_action");
var push_action_1 = require("../sync/push_action");
var listen_1 = require("../core/listen");
var connect_1 = require("../core/connect");
var logger = logger_1.loggerFor("syncrow-run");
var debug = logger_1.debugFor("syncrow:cli:run");
/**
 * MAIN
 */
debug('executing syncrow-run');
var savedConfig = loadConfigFromFile(program_1.configurationFileName);
var preparedConfig = buildConfig(savedConfig);
printDebugAboutConfig(preparedConfig);
startEngine(savedConfig);
/**
 * @param path
 * @returns {any}
 */
function loadConfigFromFile(path) {
    try {
        var result = JSON.parse(fs.readFileSync(path, 'utf8'));
        debug("found configuration in file");
        return result;
    }
    catch (e) {
        throw new Error('Configuration file not found or invalid');
    }
}
/**
 * @param savedConfig
 * @returns {ProgramOptions}
 */
function buildConfig(savedConfig) {
    if (savedConfig.rawFilter) {
        savedConfig.filter = createFilterFunction(savedConfig.rawFilter.concat([program_1.configurationFileName]), '.');
    }
    savedConfig.sync = chooseStrategy(savedConfig.rawStrategy);
    return savedConfig;
}
/**
 * @param filterStrings
 * @param baseDir
 */
function createFilterFunction(filterStrings, baseDir) {
    var baseLength = baseDir.length + 1;
    filterStrings.push(program_1.configurationFileName);
    return function (s) {
        var actual = s.indexOf(baseDir) !== -1 ? s.substring(baseLength) : s;
        return anymatch(filterStrings, actual);
    };
}
/**
 * @param chosenConfig
 * @returns {undefined}
 */
function startEngine(chosenConfig) {
    if (chosenConfig.listen) {
        return listen_1.default('.', chosenConfig.localPort, chosenConfig, function (err, engine) {
            debug("listening engine started");
            ifErrorThrow(err);
            engine.on(engine_1.Engine.events.error, ifErrorThrow);
        });
    }
    return connect_1.default(chosenConfig.remotePort, chosenConfig.remoteHost, '.', chosenConfig, function (err, engine) {
        ifErrorThrow(err);
        debug("engine connected");
        engine.on(engine_1.Engine.events.error, ifErrorThrow);
    });
}
function chooseStrategy(key) {
    if (key === 'no') {
        return no_action_1.noAction;
    }
    if (key === 'pull') {
        return pull_action_1.pullAction;
    }
    if (key === 'push') {
        return push_action_1.pushAction;
    }
    throw new Error("invalid strategy key: " + key);
}
function printDebugAboutConfig(finalConfig) {
    debug("final config: " + JSON.stringify(finalConfig, null, 2));
}
function ifErrorThrow(err) {
    if (err) {
        if (err.stack)
            console.error(err.stack);
        throw err;
    }
}
//# sourceMappingURL=syncrow-run.js.map