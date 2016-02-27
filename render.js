var prince = require("prince");
var open = require('open');
var fs = require('fs');

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
        if (SHOULD_OPEN)
        {
          open('file://' + __dirname + "/dist/index.pdf", function (err) {
            if (err) throw err;
            console.log("[Open] Browser window closed.");
          });
        }
      });
    }, function (error) {
      console.log("[Prince] ERROR: ", util.inspect(error));
    });
}
