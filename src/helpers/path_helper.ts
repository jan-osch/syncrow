/// <reference path="../../typings/main.d.ts" />
/// <reference path="../../node_modules/upath/upath.d.ts" />

import upath = require('upath');

class PathHelper {
    static normalizePath(path:string):string {
        return upath.normalize(path);
    }
}

export  = PathHelper