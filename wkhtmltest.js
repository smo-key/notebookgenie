var wkhtmltopdf = require('wkhtmltopdf');
var fs = require('fs');

// URL
/*fs.readFile('dist/wkhtmltest.html', 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  wkhtmltopdf(data, { pageSize: 'letter' })
  //wkhtmltopdf('file://' + __dirname + '/dist/index.html', { pageSize: 'letter' })
  .pipe(fs.createWriteStream('out.pdf'));
});*/

var file = "file://dist/wkhtmltest.html";
console.log(file);
wkhtmltopdf(file, { output: "output.pdf" });
