'use strict';

const gulp = require('gulp');
const plugins = require( 'gulp-load-plugins' )();
const del = require('del');

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

gulp.task('clean', function() {
  return del([
    'reports', 'docs', 'test-dist'
  ]);
});

gulp.task('cover', ['transpile'], function() {
  return gulp.src(['./lib/**/*.js'])
             .pipe(plugins.istanbul({
              //  instrumenter: isparta.Instrumenter,
               includeUntested: true
             }))
             .pipe(plugins.istanbul.hookRequire());
});

gulp.task('transpile', ['clean', 'lint'], function() {
  return gulp.src('test/**/*.js')
      .pipe(plugins.sourcemaps.init())
      .pipe(plugins.babel())
      .pipe(plugins.sourcemaps.write('.'))
      .pipe(gulp.dest('test-dist'));
});

//necessary to locate issues in code, due to https://github.com/gotwarlost/istanbul/issues/274
gulp.task('test-no-cov', ['transpile'], function () {
  const env = plugins.env.set({
    LOG_LEVEL : 'critical'
  });
  return gulp.src(['test-dist/**/*.js'])
    .pipe(env)
    .pipe(plugins.mocha({
      reporter: 'spec',
      quiet:false,
      colors:true,
      timeout: 10000
    }))
    .pipe(env.reset);
});

gulp.task('test', ['cover'], function () {
  const env = plugins.env.set({
    LOG_LEVEL : 'critical'
  });
  return gulp.src(['test-dist/**/*.js'])
    .pipe(env)
    .pipe(plugins.mocha({
      reporter: 'spec',
      quiet:false,
      colors:true,
      timeout: 10000
    }))
    // Creating the reports after tests ran
    .pipe(plugins.istanbul.writeReports({
      dir: './reports',
      reporters: [ 'lcov', 'json', 'text', 'text-summary', 'html']
    }))
    // Enforce a coverage of at least 100%
    //.pipe(plugins.istanbul.enforceThresholds({ thresholds: { global: 100 } }))
    .pipe(env.reset);
});

gulp.task('show-coverage', function() {
  return gulp.src('./reports/index.html')
             .pipe(plugins.open());
});

gulp.task('default', ['watch']);
