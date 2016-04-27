"use strict";
let fs = require('fs');

function getPath(p) {
    return `./testdir/${p}`;
}

fs.watch('./testdir', {recursive: true, persistent: true}).on('change', (event, fileName)=> {
    if (event === 'rename') {
        fs.stat(getPath(fileName), (err)=> {
            if (err) return logEvent(event, fileName, 'deleted');

            logEvent(event, fileName, 'modified or created')
        })
    } else {
        logEvent(event, fileName, 'changed');
    }
});

function logEvent(event, fileName, actualEvent) {
    console.log(`got new event:${event} file:${fileName} actual: ${actualEvent}`);
}

// let limit = 100000;
// let async = require('async');
//
// console.time('access');
// async.whilst(
//     ()=> {
//         return limit > 0
//     },
//     (callback)=> {
//         fs.access('./testdir/kask/ksk/kaka.js', (err, stats)=> {
//             limit--;
//             callback();
//         })
//     }, (err)=> {
//         console.timeEnd('access');
//     }
// );
//
// limit = 100000;
//
// console.time('stat');
// async.whilst(
//     ()=> {
//         return limit > 0
//     },
//     (callback)=> {
//         fs.stat('./testdir/kask/ksk/kaka.js', (err, stats)=> {
//             limit--;
//             callback();
//         })
//     }, (err)=> {
//         console.timeEnd('stat');
//     }
// );