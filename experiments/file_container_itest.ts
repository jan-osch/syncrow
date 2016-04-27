/**
 * Created by Janusz on 27.04.2016.
 */
/// <reference path="../typescript-interfaces/node.d.ts" />

import FileContainer = require('../src/file_container');

var fileContainer = new FileContainer('../testdir');

fileContainer.on(FileContainer.events.deleted, (fileName)=> {
    console.log(`deleted ${fileName}`);
});
fileContainer.on(FileContainer.events.changed, (fileName)=> {
    console.log(`changed ${fileName}`);
});
fileContainer.on(FileContainer.events.created, (fileName)=> {
    console.log(`created ${fileName}`);
});
fileContainer.on(FileContainer.events.metaComputed, (fileName)=> {
    console.log(`metaComputed ${fileName}`);
});

setTimeout(()=>console.log(fileContainer.getListOfWatchedFiles()),2000);