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
    OAuth = require('oauth').OAuth,
    flow = require('nimble'),
    cookieparser = require('cookie-parser');
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
  building:
    {
      id: "azk425a43",
      auth: null,
      public: true,
      org: "LASA Robotics",
      title: "Super Uber Duper Long Title Name",
      orgurl: null,
      titleurl: "#",
      template: "LASA Robotics",
      email: "pachachura.arthur@gmail.com",
      user: "arthurpachachura1",
      progress: 80
    },
  queued: [
    {
      id: "azk425a43",
      auth: null,
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
      timestamp: 39485949343 //only in built
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

//APP USAGE PARAMS
app.param('id', /^([a-zA-Z0-9]){8}$/);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieparser());

// API POST requests
app.use('/ajax/prepurl', function(req, res) {
  //Check if valid URL
  var url = req.body.url;
  util.prepurl(url, function(status) {
    util.sendjson(status, res); return;
  });
});

/* OAUTH DETAILS */
requestURL = "https://trello.com/1/OAuthGetRequestToken";
accessURL = "https://trello.com/1/OAuthGetAccessToken";
authorizeURL = "https://trello.com/1/OAuthAuthorizeToken";
callbackURL = config.domain + "/ajax/completeauth"; //TODO fix this callback to the global setting... or figure out a workaround

//need to store token: tokenSecret pairs; in a real application, this should be more permanent (redis would be a good choice)
oauth_secrets = {};

app.use('/ajax/authorize', function(req, res) {
  var url = req.body.url;
  oauth = new OAuth(requestURL, accessURL, config.key, config.secret, "1.0", callbackURL, "HMAC-SHA1");
  util.prepurl(url, function(status, id) {
    if (status.status != 2) { console.log("AUTHORIZE STATUS ERROR!"); return; } //TODO error handling
    //send an OAuth request to get the application name and key
    oauth.getOAuthRequestToken(function(error, token, tokenSecret, results) {
      if (error)
      {
        console.log("AUTHORIZE error!");
        //TODO client-side error dialog handling
        return;
      }
      oauth_secrets[token] = tokenSecret;
      console.log("TOKENS: " + token + " SECRET: " + tokenSecret + " RESULTS: " + results + " ERROR: " + error);
      res.cookie('boardid', id, { httpOnly: true, path: '/' });
      util.sendjson({ url: authorizeURL + "?oauth_token=" + token + "&name=" + config.appname + "&expiration=1day" }, res);
    });
  });
});

app.use('/ajax/completeauth', function(req, res) {

  oauth = new OAuth(requestURL, accessURL, config.key, config.secret, "1.0", callbackURL, "HMAC-SHA1");

  query = url.parse(req.url, true).query;

  token = query.oauth_token;
  tokenSecret = oauth_secrets[token];
  delete oauth_secrets[token];
  verifier = query.oauth_verifier;

  oauth.getOAuthAccessToken(token, tokenSecret, verifier, function(error, accessToken, accessTokenSecret, results)
  {
    //TODO check if the board id in question is accessable by this user (do a test query)

    //store accessToken and accessTokenSecret
    var id = "";
    try
    {
      id = req.cookies.boardid;
    } catch (e)
    {
      error = true;
    }
    var public = req.param('public'); //TODO set this via cookie! (it's not being set)
    var status = "success";
    var text = S("<span class='glyphicon glyphicon-ok'></span>Sign in successful!").escapeHTML().s;
    if(error)
    {
      console.log(error);
      status = "danger";
      text = S("We couldn't sign you in to your account.  Nothing will be built.").escapeHTML().s;
    }

    //redirect
    flow.series([
      function queue(cb) {
        if (!error)
        {
          util.queueadd(stache, public, id,
          { token: token, tokenSecret: tokenSecret, accessToken: accessToken, accessTokenSecret: accessTokenSecret });
        }
        cb();
      },
      function send(cb) {
        res.cookie('text', text, { httpOnly: true, path: '/' });
        res.cookie('status', status, { httpOnly: true, path: '/' });
        res.writeHead(302, { 'Location': "/build/" + id });
        res.send();
        cb();
      }
    ]);
  });
});

app.get('/build/:id', function(req, res){
  // Building and download LaTeX / PDF page

  //TODO check if build ID is building
  //TODO check if build ID is queued
  //TODO check if build ID is built

  //TODO get the building page

  //INITIALIZE
  try
  {
    var authurl = util.getdomain(req.headers.host) + callbackURL;
    oauth = new OAuth(requestURL, accessURL, config.key, config.secret, "1.0", authurl, "HMAC-SHA1");

    var id = (req.params.id)[0];
    try {
      var stat = req.cookies.status;
      var message = S(req.cookies.text).decodeHTMLEntities().s;
      var alert = 'alert';
    } catch (e)
    {
      var stat = "";
      var message = "";
      var alert = 'blank';
    }

    res.clearCookie('text', { path: '/' });
    res.clearCookie('status', { path: '/' });
    res.render('main', {
      applicationkey: config.key,
      board: stache.building,
      alertstatus: stat,
      alerttext: message,
      errortext: "There is no board building with this id.<br>Would you like to <a href='/'>start building yours</a>?",
      partials: {
        main: 'build-complete',
        helpbutton: 'helpbutton',
        public: 'public',
        private: 'private',
        alert: alert
      }
    });
  } catch (e)
  {
    throw e;
  }
});

// LaTeX and PDF completed download location
app.use('/build/css', express.static(__dirname + '/css'));
app.use('/build/js', express.static(__dirname + '/js'));
app.use('/build/img', express.static(__dirname + '/img'));
app.use('/build/fonts', express.static(__dirname + '/fonts'));
app.use('/build', express.static(__dirname + '/build'));

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

// Handle 404
app.use(function(req, res) {
  res.status(400);
  res.render('main', {
    applicationkey: config.key,
    errorcode: ghf,
    errortext: "FILE NOT FOUND",
    partials: {
      main: 'crash',
      helpbutton: 'helpbutton'
    }
  });
});

// Handle 500
app.use(function(error, req, res, next) {
  res.status(500);
  res.render('main', {
    applicationkey: config.key,
    errorcode: "500",
    errortext: "INTERNAL SERVER ERROR",
    partials: {
      main: 'crash',
      helpbutton: 'helpbutton'
    }
  });
});

//serve HTTP
app.listen(port);

console.log("Server ready on port " + port);
