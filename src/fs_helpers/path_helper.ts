import *  as upath from "upath";
import * as path from "path"

export class PathHelper {

    /**
     * Returns path that is always in UNIX format regardless of origin OS
     * @param suspect
     * @returns {string}
     */
    public static normalizePath(suspect:string):string {
        return upath.normalize(suspect).replace(/(\ {1,})/g, "\\$1");
    }

    /**
     * Returns path that is localized - e.g. windows specific
     * @param suspect
     * @param separator
     * @returns {string}
     */
    public static localizePath(suspect:string, separator?:string):string {
        separator = separator ? separator : path.sep;

        if (separator != '\\') {
            return suspect;
        }

        return suspect
            .replace(/\\( {1,})/g, '$1')
            .replace(/\//g, "\\");
    }
}