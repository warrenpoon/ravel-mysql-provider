'use strict';

const gulp = require('gulp');
const plugins = require( 'gulp-load-plugins' )();

gulp.task('lint', function() {
  return gulp.src(['./lib/**/*.js', './test/**/*.js', 'gulpfile.js', 'ravel-rethinkdb-provider.js'])
             .pipe(plugins.eslint())
             .pipe(plugins.eslint.format())
             .pipe(plugins.eslint.failAfterError());
});

gulp.task('watch', ['lint'], function() {
  gulp.watch(['./lib/**/*.js'], ['lint']);
  gulp.watch(['gulpfile.js', 'ravel-rethinkdb-provider.js', './test/**/*.js'], ['lint']);
});

gulp.task('default', ['watch']);
