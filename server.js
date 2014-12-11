//instantiate variables
var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    app = require("express"),
    mu = require("mu2"),
    yaml = require("js-yaml"),
    trello = require("node-trello")

/* GET PROCESS INFORMATION */
port = process.argv[2] || 8888; //server port
configname = process.argv[3] || "_server.yml";

/* READ SERVER CONFIG */
configdata = fs.readFileSync(configname);
config = yaml.safeLoad(configdata);

/* SERVER */



//serve HTTP
