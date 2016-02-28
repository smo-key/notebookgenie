const prince = require("prince");
const open = require('open');
const fs = require('fs');
const exec = require('child_process').exec;

var SHOULD_OPEN = true;

fs.exists('dist/prince.log', function(exists) {
  if(exists) {
    console.log('[Prince] Deleting old log...');
    fs.unlink('dist/prince.log', function()
    {
      render();
    });
  }
  else
  {
    render();
  }
});

function render()
{
  console.log("[Prince] Generating PDF...")
  prince()
    .inputs("dist/index.html")
    .output("dist/index.pdf")
    .option("javascript")
    .option("log", "dist/prince.log")
    .execute()
    .then(function () {
      fs.readFile('dist/prince.log', 'utf8', function (err,data) {
        if (err) throw err;
        console.log(data);
        console.log("[Prince] Success!");
        rmPages(function()
        {
          if (SHOULD_OPEN)
          {
            open('file://' + __dirname + "/dist/output.pdf", function (err) {
              if (err) throw err;
              console.log("[Open] Browser window closed.");
            });
          }
        });
      });
    }, function (error) {
      console.log("[Prince] ERROR: ", util.inspect(error));
    });
}

function rmPages(cb)
{
  console.log("[PDFToolkit] Modifying PDF...");
  const child = exec('pdftk dist/index.pdf cat 3-end output dist/output.pdf dont_ask allow AllFeatures drop_xfa',
    (error, stdout, stderr) => {
    console.log(`[PDFToolkit] ${stdout}\r\n${stderr}`);
    if (error !== null) {
      throw error;
    }
    cb();
  });
}
