var upath = require("upath");
var PathHelper = (function () {
    function PathHelper() {
    }
    /**
     * Returns path that is always in UNIX format regardless of origin OS
     * @param path
     * @returns {string}
     */
    PathHelper.normalizePath = function (path) {
        return upath.normalize(path).replace(/\ /g, "\\ ");
    };
    return PathHelper;
})();
exports.PathHelper = PathHelper;
//# sourceMappingURL=path_helper.js.map