import {PathHelper} from "../../fs_helpers/path_helper";
import * as path from "path";
import * as assert from "assert";

describe('PathHelper', ()=> {
    describe('normalizePath', ()=> {
        it('will return a unix version of windows path', ()=> {
            const actual = PathHelper.normalizePath('some\\test\\dir');

            assert.equal(actual, 'some/test/dir');
        });

        it('will return a unix version of windows path, also with spaces inside', ()=> {
            const actual = PathHelper.normalizePath('some\\test with spaces\\new dir');

            assert.equal(actual, 'some/test with spaces/new dir');
        });

        it('will return unix path with escaped spaces', ()=> {
            const actual = PathHelper.normalizePath('some/strange/.path with/spaces   multiple');

            assert.equal(actual, 'some/strange/.path with/spaces   multiple');
        });
    });

    describe('createFilterFunction', ()=> {
        it('should work for simple files', ()=> {
            const ignored = ['.hidden.json', 'file.txt', 'name\ with\ spaces'];
            const func = PathHelper.createFilterFunction(ignored, '.');
            const current = process.cwd();

            assert(func(path.join(current, ignored[0])), 'should ignore .hidden.json');
            assert(func(path.join(current, ignored[1])), 'should ignore file.txt');
            assert(func(path.join(current, ignored[2])), 'should ignore "name with spaces"');
            assert.equal(func(path.join(current, 'other_file.txt')), false, 'should not ignore other_file.txt');
            assert.equal(func(path.join(current, 'with\ spaces.txt')), false, 'should not ignore file with similar name');
            assert.equal(func(path.join(current, '.hidden')), false, 'should not ignore file with similar name');
        });

        it('should ignore subdirectories', ()=> {
            const ignored = ['.git', path.join('dir', 'sub'), path.join('dir\ spaces')];

            const func = PathHelper.createFilterFunction(ignored, '.');

            const current = process.cwd();

            assert(func(path.join(current, '.git')));
            assert(func(path.join(current, '.git', 'somefile.txt')));
            assert(func(path.join(current, '.git', 'subdir', 'somefile.txt')));

            assert.equal(func(path.join(current, 'dir')), false, 'should not ignore parent of an ignored path');
            assert.equal(func(path.join(current, 'dir', 'file.txt')), false);
            assert(func(path.join(current, 'dir', 'sub')));
            assert(func(path.join(current, 'dir', 'sub', 'file.txt')));
            assert(func(path.join(current, 'dir', 'sub', 'another.txt')));
        });
    });
});
