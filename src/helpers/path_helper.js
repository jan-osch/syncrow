/// <reference path="../../typings/main.d.ts" />
/// <reference path="../../node_modules/upath/upath.d.ts" />
"use strict";
var upath = require('upath');
var PathHelper = (function () {
    function PathHelper() {
    }
    PathHelper.normalizePath = function (path) {
        return upath.normalize(path);
    };
    return PathHelper;
}());
module.exports = PathHelper;
//# sourceMappingURL=path_helper.js.map