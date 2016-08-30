import *  as upath from "upath";

export class PathHelper {

    /**
     * Returns path that is always in UNIX format regardless of origin OS
     * @param path
     * @returns {string}
     */
    public static normalizePath(path:string):string {
        return upath.normalize(path).replace(/(\ {1,})/g, "\\$1");
    }

    /**
     * Returns path that is localized - e.g. windows specific
     * @param path
     * @param separator
     * @returns {string}
     */
    public static localizePath(path:string, separator?:string):string {
        separator = separator ? separator : path.sep;

        if (separator != '\\') {
            return path;
        }

        return path
            .replace(/\\( {1,})/g, '$1')
            .replace(/\//g, "\\");
    }
}