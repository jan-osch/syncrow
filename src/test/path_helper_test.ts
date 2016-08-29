import {PathHelper} from "../fs_helpers/path_helper";
import {expect} from "chai";

describe('PathHelper', ()=> {
    describe('normalizePath', ()=> {
        it('will return a unix version of windows path', ()=> {
            const actual = PathHelper.normalizePath('some\\test\\dir');

            expect(actual).to.equal('some/test/dir');
        });

        it('will return a unix version of windows path, also with spaces inside', ()=> {
            const actual = PathHelper.normalizePath('some\\test with spaces\\new dir');

            expect(actual).to.equal('some/test\\ with\\ spaces/new\\ dir');
        });

        it('will return unix path with escaped spaces', ()=> {
            const actual = PathHelper.normalizePath('some/strange/.path with/spaces   multiple');

            expect(actual).to.equal('some/strange/.path\\ with/spaces\\   multiple');
        });
    });

    describe('denormalizePath', ()=>{
        it('change a path from unix like to windows like if given a windows separator', ()=>{
            const actual = PathHelper.denormalizePath('some\\ strange/.path\\ with/spaces', '\\');

            expect(actual).to.equal('some strange\\.path with\\spaces');
        })

        it('if separator is unix will return unchanged path', ()=>{
            const actual = PathHelper.denormalizePath('some\\ strange/.path\\ with/spaces', '/');

            expect(actual).to.equal('some\\ strange/.path\\ with/spaces');
        })
    })
});
