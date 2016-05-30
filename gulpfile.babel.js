import gulp from "gulp";
import shell from "gulp-shell";
import rimraf from "rimraf";
import run from "run-sequence";
import watch from "gulp-watch";

const paths = {
    js: ['./src/**/*.js'],
    test: './test',
    destination: './build'
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
]));

gulp.task('watch', () => {
    return watch(paths.js, () => {
        run('build');
    });
});

gulp.task('watch-test', () => {
    return watch(paths.js, () => {
        run('build', 'run-test');
    });
});

gulp.task('run-test', shell.task([
    `mocha ${paths.test}`
]));