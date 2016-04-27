/**
 * Created by Janusz on 27.04.2016.
 */
/// <reference path="../typescript-interfaces/node.d.ts" />
"use strict";
var FileContainer = require('../src/file_container');
var fileContainer = new FileContainer('../testdir');
fileContainer.on(FileContainer.events.deleted, function (fileName) {
    console.log("deleted " + fileName);
});
fileContainer.on(FileContainer.events.changed, function (fileName) {
    console.log("changed " + fileName);
});
fileContainer.on(FileContainer.events.created, function (fileName) {
    console.log("created " + fileName);
});
fileContainer.on(FileContainer.events.metaComputed, function (fileName) {
    console.log("metaComputed " + fileName);
});
setTimeout(function () { return console.log(fileContainer.getListOfWatchedFiles()); }, 2000);
//# sourceMappingURL=file_container_itest.js.map