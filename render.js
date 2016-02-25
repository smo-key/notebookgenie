var prince = require("prince");
var open = require('open');

prince()
  .inputs("dist/index.html")
  .output("dist/index.pdf")
  .execute()
  .then(function () {
    console.log("[Prince] Success!");
    open('file://' + __dirname + "/dist/index.pdf", function (err) {
      if (err) throw err;
      console.log("[Open] Browser window closed.");
    });
  }, function (error) {
    console.log("[Prince] ERROR: ", util.inspect(error));
  });
