import * as async from "async";
import {createPathSeries, removePath} from "../utils/fs_test_utils";
import * as path from "path";
import {readTree} from "../fs_helpers/read_tree";
import * as assert from "assert";

const TEST_DIR = 'read_tree_test';
const CONTENT = 'random text';

const allFiles = [
    'top_level.js',
    '.git',
    path.join('.git', 'file_1.js'),
    'dir',
    path.join('dir', 'a.js.map'),
    path.join('dir', 'a.js'),
    path.join('dir', 'b.js'),
    path.join('dir', 'c.js'),
    'outer_dir',
    path.join('outer_dir', 'nested_dir'),
    path.join('outer_dir', 'nested_dir', 'file_a.js'),
    path.join('outer_dir', 'nested_dir', 'file_b.js'),
    path.join('outer_dir', 'nested_dir', 'file_c.js')
];

describe('readTree', ()=> {
    beforeEach((done)=> {
        async.series(
            [
                (cb)=>removePath(TEST_DIR, cb),

                (cb)=>createPathSeries(
                    [
                        {path: TEST_DIR, directory: true},

                        {path: path.join(TEST_DIR, 'top_level.js'), content: CONTENT},

                        {path: path.join(TEST_DIR, '.git'), directory: true},
                        {path: path.join(TEST_DIR, '.git', 'file_1.js'), content: CONTENT},

                        {path: path.join(TEST_DIR, 'dir'), directory: true},
                        {path: path.join(TEST_DIR, 'dir', 'a.js.map'), content: CONTENT},
                        {path: path.join(TEST_DIR, 'dir', 'a.js'), content: CONTENT},
                        {path: path.join(TEST_DIR, 'dir', 'b.js'), content: CONTENT},
                        {path: path.join(TEST_DIR, 'dir', 'c.js'), content: CONTENT},

                        {path: path.join(TEST_DIR, 'outer_dir'), directory: true},
                        {path: path.join(TEST_DIR, 'outer_dir', 'nested_dir'), directory: true},
                        {path: path.join(TEST_DIR, 'outer_dir', 'nested_dir', 'file_a.js'), content: CONTENT},
                        {path: path.join(TEST_DIR, 'outer_dir', 'nested_dir', 'file_b.js'), content: CONTENT},
                        {path: path.join(TEST_DIR, 'outer_dir', 'nested_dir', 'file_c.js'), content: CONTENT}
                    ],
                    cb
                )
            ],
            done
        )
    });

    after((done)=> {
        removePath(TEST_DIR, done);
    });

    it('without any filtering it will return the whole file tree', (done)=> {
        readTree(TEST_DIR, {}, (err, results)=> {
            assert.deepEqual(results.sort(), allFiles.sort());
            done(err);
        })
    });

    it('when only files option is given, it will return only files, not directories', (done)=> {
        const onlyFiles = [
            'top_level.js',
            path.join('.git', 'file_1.js'),
            path.join('dir', 'a.js.map'),
            path.join('dir', 'a.js'),
            path.join('dir', 'b.js'),
            path.join('dir', 'c.js'),
            path.join('outer_dir', 'nested_dir', 'file_a.js'),
            path.join('outer_dir', 'nested_dir', 'file_b.js'),
            path.join('outer_dir', 'nested_dir', 'file_c.js')
        ];

        readTree(TEST_DIR, {onlyFiles: true}, (err, results)=> {
            assert.deepEqual(results.sort(), onlyFiles.sort());
            done(err);
        })
    });

    it('if given a filter function, will not reutrn filtered paths or their subdirectories / children paths', (done)=> {
        const expected = [
            'top_level.js',
            'dir',
            path.join('dir', 'a.js.map'),
            path.join('dir', 'a.js'),
            path.join('dir', 'b.js'),
            path.join('dir', 'c.js'),
            'outer_dir'
        ];

        const filterFunction = (suspect)=> {
            return [
                    path.join(TEST_DIR, '.git'),
                    path.join(TEST_DIR, 'outer_dir', 'nested_dir')
                ].indexOf(suspect) !== -1;
        };

        readTree(TEST_DIR, {filter: filterFunction}, (err, results)=> {
            assert.deepEqual(results.sort(), expected.sort());
            done(err);
        })
    });
});