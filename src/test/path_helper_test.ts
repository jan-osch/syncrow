import {PathHelper} from "../fs_helpers/path_helper";
import {expect} from "chai";
import * as path from "path";
import * as assert from "assert";

describe('PathHelper', ()=> {
    describe('normalizePath', ()=> {
        it('will return a unix version of windows path', ()=> {
            const actual = PathHelper.normalizePath('some\\test\\dir');

            expect(actual).to.equal('some/test/dir');
        });

        it('will return a unix version of windows path, also with spaces inside', ()=> {
            const actual = PathHelper.normalizePath('some\\test with spaces\\new dir');

            expect(actual).to.equal('some/test with spaces/new dir');
        });

        it('will return unix path with escaped spaces', ()=> {
            const actual = PathHelper.normalizePath('some/strange/.path with/spaces   multiple');

            expect(actual).to.equal('some/strange/.path with/spaces   multiple');
        });
    });

    describe('createFilterFunction', ()=> {
        it('should work for simple files', ()=> {
            const ignored = ['.hidden.json', 'file.txt', 'name\ with\ spaces'];
            const func = PathHelper.createFilterFunction(ignored, '.');
            const current = process.cwd();

            expect(func(path.join(current, ignored[0]))).to.be.true;
            expect(func(path.join(current, ignored[1]))).to.be.true;
            expect(func(path.join(current, ignored[2]))).to.be.true;
            expect(func(path.join(current, 'other_file.txt'))).to.be.false;
            expect(func(path.join(current, 'with\ spaces.txt'))).to.be.false;
            expect(func(path.join(current, '.hidden'))).to.be.false;
        });

        it('should ignore subdirectories', ()=> {
            const ignored = ['.git', path.join('dir', 'sub'), path.join('dir\ spaces')];

            const func = PathHelper.createFilterFunction(ignored, '.');

            const current = process.cwd();

            expect(func(path.join(current, '.git'))).to.be.true;
            expect(func(path.join(current, '.git', 'somefile.txt'))).to.be.true;
            expect(func(path.join(current, '.git', 'subdir', 'somefile.txt'))).to.be.true;

            expect(func(path.join(current, 'dir'))).to.be.false;
            expect(func(path.join(current, 'dir', 'file.txt'))).to.be.false;
            expect(func(path.join(current, 'dir', 'sub'))).to.be.true;
            expect(func(path.join(current, 'dir', 'sub', 'file.txt'))).to.be.true;
            expect(func(path.join(current, 'dir', 'sub', 'another.txt'))).to.be.true;
        });
    });
});
