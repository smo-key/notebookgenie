var gulp = require('gulp');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var mustache = require("gulp-mustache");
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var wrap = require('gulp-wrap');
var declare = require('gulp-declare');
var usemin = require('gulp-usemin');
var ext_replace = require('gulp-ext-replace');
var minifyCss = require('gulp-minify-css');
var rimraf = require('gulp-rimraf');

function swallowError (error) {
  // If you want details of the error in the console
  console.log(error.toString());
  this.emit('end');
}

gulp.task('sass', function () {
 gulp.src('src/sass/**/*.scss')
  .pipe(sourcemaps.init())
  .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
  .pipe(sourcemaps.write())
  .pipe(gulp.dest('dist/css'));
});

// Gulp Mustache Task
gulp.task('mustache', function() {
    gulp.src("src/*.html")
        .pipe(mustache({},{},{}))
        .pipe(gulp.dest("dist/"));
});
gulp.task('compress', function() {
  gulp.src('src/js/**/*.js')
    .pipe(uglify())
    .on('error', swallowError)
    .pipe(gulp.dest('dist/js'));
});
gulp.task('copy', function () {
    gulp.src('src/img/**/*').pipe(gulp.dest('dist/img'));
});

gulp.task('build', ['sass','compress','copy','mustache'] )
gulp.task('default', ['build','watch']);

gulp.task('watch', function () {
    gulp.watch('./src/sass/**/*.scss', ['sass']);
    gulp.watch('./src/*.html', ['mustache']);
    gulp.watch('./src/js/**/*.js', ['compress']);
    gulp.watch('./src/img/**/*', ['copy']);
    gulp.watch('./lib/**/*', ['copy']);
    gulp.watch('./libc/**/*', ['copy']);
});
