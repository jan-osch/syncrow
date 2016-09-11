import *  as upath from "upath";
import * as path from "path";
import * as ignore from "ignore";
import {FilterFunction} from "./file_container";
import {debugFor} from "../utils/logger";
const debug = debugFor('syncrow:path_helper');


export class PathHelper {

    /**
     * Returns path that is always in UNIX format regardless of origin OS
     * @param suspect
     * @returns {string}
     */
    public static normalizePath(suspect:string):string {
        return upath.normalize(suspect);
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

    /**
     * @param filterStrings
     * @param baseDir
     */
    public static createFilterFunction(filterStrings:Array<string>, baseDir:string):FilterFunction {
        const absolute = path.resolve(baseDir);

        debug(`creating a filter function with paths: ${filterStrings} and absolute path: ${absolute}`);

        const filter = ignore().add(filterStrings).createFilter();

        return (s:string, stats?:any) => {
            if (s === absolute) {
                return false;
            }

            const relative = path.relative(absolute, s);

            const result = !filter(relative);

            debug(`path: ${relative} will be ignored: ${result}`);

            return result;
        };
    }
}