//instantiate variables
var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    queryString = require("querystring"),
    S = require("string"),
    express = require("express"),
    yaml = require("js-yaml"),
    cons = require('consolidate'),
    logger = require('morgan'),
    walk = require("walk"),
    bodyParser = require("body-parser"),
    util = require("./js/util.js"),
    t2t = require("./js/trello2latex.js"),
    t = require("node-trello");

//initialize renderer
var app = express();
var router = express.Router();
app.engine('html', cons.mustache);
app.set('view engine', 'html');
app.set("view options", {layout: false});
app.set('views', __dirname + '/partials');

/* GET PROCESS INFORMATION */
port = process.argv[2] || 8888; //server port
configname = process.argv[3] || "_private.yml";

/* READ SERVER CONFIG */
configdata = fs.readFileSync(configname);
config = yaml.safeLoad(configdata);
trello = new t(config.key, config.secret);

/* CREATE MUSTACHE PARTIALS STACHE */
/*var stache = { };
var walker  = walk.walk('./partials', { followLinks: false });
walker.on('file', function(root, stat, next) {
  var key   = path.basename(stat.name, path.extname(stat.name));
  var value = fs.readFileSync(root + '/' + stat.name).toString();
  stache[key] = value;
  next();
});
walker.on('end', function() {
  console.log(stache);
  app.engine('html', cons.mustache);
  app.set('view engine', 'html');
  app.set("view options", {layout: false});
  app.set('views', __dirname + '/partials');
});*/

var stache = {
  building: {
    id: "azk425a43",
    token: "someuserslogintoken",
    public: false,
    org: "LASA Robotics",
    title: "Our Board",
    orgurl: null,
    titleurl: null,
    template: "LASA Robotics",
    email: "pachachura.arthur@gmail.com",
    user: "arthurpachachura1",
    progress: 40
  },
  queued: [
    {
      id: "azk425a43",
      token: "someuserslogintoken",
      public: true,
      org: "LASA Robotics",
      title: "Our Board - Again",
      orgurl: null,
      titleurl: null,
      template: "LASA Robotics",
      email: "pachachura.arthur@gmail.com",
      user: "arthurpachachura1"
    }
  ],
  built: [
    {
      id: "hvu4q93yt0quh",
      public: true,
      org: "Arthur Pachachura",
      title: "My Public Board",
      orgurl: "#",
      titleurl: "#",
      timestamp: 39485949343
    },
    {
      id: "kj35fj953",
      public: false,
      org: "LASA Robotics",
      title: "Private Board",
      orgurl: null,
      titleurl: null,
      timestamp: 3948594934893
    },
    {
      id: "nfd420gkrog4",
      public: false,
      org: "Some Public Organization",
      title: "Private Board",
      orgurl: "#",
      titleurl: null,
      timestamp: 3948594934893
    }
  ]
}

/* SERVER */
app.use(logger('dev'));

app.param(function(name, fn){
  if (fn instanceof RegExp) {
    return function(req, res, next, val){
      var captures;
      if (captures = fn.exec(String(val))) {
        req.params[name] = captures;
        next();
      } else {
        next('route');
      }
    }
  }
});

// TODO cron job for removing builds after 24 hours

// Building and download LaTeX / PDF page
app.param('id', /^([a-zA-Z0-9]){8}$/);
app.get('/build/:id', function(req, res){
  //TODO check if build ID is building
  //TODO check if build ID is queued
  //TODO check if build ID is built

  //TODO get the building page

  res.send('Build ID ' + req.params.id);
});
// LaTeX and PDF completed download location
app.use('/build', express.static(__dirname + '/build'));

// API POST requests
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use('/ajax/prepurl', function(req, res) {
  //Check if valid URL
  var url = req.body.url;
  util.prepurl(url, function(status) {
    util.sendjson(status, res); return;
  });
});

app.use('/ajax/getkey', function(req, res) {
  //Get the application name and key
  var url = req.body.url;
  util.prepurl(url, function(status, id) {
    var json = { };
//    json["appname"] = S(config.appname).escapeHTML().s;
    if (status.status != 2)
    {
      json["status"] = false;
      util.sendjson(json, res); return;
    }
    json["status"] = true;
    json["appname"] = config.appname;
    json["key"] = config.key;
    json["boardid"] = id;
    util.sendjson(json, res); return;
  });
});

app.use('/ajax/build', function(req, res) {
  //Start building - respond with a build URL while server queues build
  var url = req.body.url;
  var logindata = req.body.trello;
  util.prepurl(url, function(status, id, boardjson) {
    var reply = { };
    if (status.status != 2)
    {
      reply["status"] = false;
      util.sendjson(json, res); return;
    }

    reply["status"] = true;
    reply["url"] = "/build/" + id;

    util.queuebuild(stache, status, id, logindata);
    util.sendjson(reply, res);
    return;
  });
});

// Final index GET
app.get('/', function (req, res) {
  res.render('main', {
    applicationkey: config.key,
    building: stache.building,
    built: stache.built,
    partials: {
      main: 'start',
      helpbutton: 'helpbutton',
      public: 'public',
      private: 'private',
      modal: 'modal-build'
    }
  });
});

app.use('/img', express.static(__dirname + '/img'));
app.use('/css', express.static(__dirname + '/css'));
app.use('/fonts', express.static(__dirname + '/fonts'));
app.use('/js', express.static(__dirname + '/js'));

app.get('404.html', function (req, res) {
  res.send("404!!!!");
});

//serve HTTP
app.listen(port);

console.log("Server ready on port " + port);
