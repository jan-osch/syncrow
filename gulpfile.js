const gulp = require("gulp");
const shell = require("gulp-shell");
const rimraf = require("rimraf");
const run = require("run-sequence");
const watch = require("gulp-watch");

const paths = {
    js: ['./src/**/*.js'],
    test: './test',
    destination: './build',
    watch: ['./src/**/*.ts', './test/**/*.js']
};

gulp.task('default', callback => {
    run('build', 'watch', callback);
});

gulp.task('build', callback => {
    run('clean', 'compile', callback);
});

gulp.task('clean', callback => {
    rimraf(paths.destination, callback);
});

gulp.task('compile', shell.task([
    'tsc'
], {ignoreErrors: true, quiet:true}));

gulp.task('watch', shell.task([
    'tsc --watch'
], {ignoreErrors: true, quiet:true}));

gulp.task('watch-test', () => {
    return watch(paths.watch, () => {
        run('build', 'test');
    });
});

gulp.task('test', shell.task([
    `mocha --recursive ${paths.test}`
]));