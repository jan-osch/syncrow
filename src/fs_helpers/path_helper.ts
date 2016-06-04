/// <reference path="../../typings/main.d.ts" />
/// <reference path="../../node_modules/upath/upath.d.ts" />

import *  as upath from "upath";

export class PathHelper {
    
    /**
     * Returns path that is always in UNIX format regardless of origin OS
     * @param path
     * @returns {string}
     */
    public static normalizePath(path:string):string {
        return upath.normalize(path);
    }
}