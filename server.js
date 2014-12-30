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
      id: "azk4lolz",
      auth: null,
      public: true,
      org: "LASA Robotics",
      title: "Some Extrememly Long Board Name",
      orgurl: null,
      titleurl: "#",
      template: "LASA Robotics",
      email: "pachachura.arthur@gmail.com",
      user: "arthurpachachura1",
      progress: 80
    },
  queued: [
    {
      id: "azk425a4",
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
      id: "asdfasdf",
      public: true,
      org: "Arthur Pachachura",
      title: "My Public Board",
      orgurl: "#",
      titleurl: "#",
      timestamp: 39485949343 //only in built
    },
    {
      id: "kj35fj95",
      public: false,
      org: "LASA Robotics",
      title: "Private Board",
      orgurl: null,
      titleurl: null,
      timestamp: 3948594934893
    },
    {
      id: "nfd420gk",
      public: false,
      org: "Some Public Organization",
      title: "Private Board",
      orgurl: "#",
      titleurl: null,
      timestamp: 3948594934893
    }
  ],
  failed: [
    {
      id: "hvu4q93j",
      errormessage: "We encountered an unknown build error.  Sorry!",
      public: true,
      org: "Arthur Pachachura",
      title: "My Public Board",
      orgurl: "#",
      titleurl: "#",
      timestamp: 39485949343, //timestamp of failure, used for cleaning
      humantime: "2014-12-30T01:05:23.689Z" //only on failure
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
          util.queueadd(stache, false, id,
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


app.use('/ajax/build', function(req, res) {
  //build a PUBLIC repo
  util.prepurl(req.body.url, function(status, id) {
    if (status.status != 2) { return; }//TODO error handling

    var stat = "success";
    var text = S("<span class='glyphicon glyphicon-ok'></span>Build started!  You're good to go!").escapeHTML().s;

    //redirect
    flow.series([
      function queue(cb) {
        util.queueadd(stache, true, id, null);
        cb();
      },
      function send(cb) {
        res.cookie('text', text, { httpOnly: true, path: '/' });
        res.cookie('status', stat, { httpOnly: true, path: '/' });
        util.sendjson({ url: "/build/" + id }, res);
        cb();
      }
    ]);
  });
});

app.get('/build/:id', function(req, res){
  // Building and download LaTeX / PDF page
  util.checkstache(stache, req.params.id[0], function(state, board, i) {
    var id = (req.params.id)[0];
    var etext = "";
    console.log(state);

    //check where the item is in processing
    if (state == null)
    {
      //not in queue at all - give it a 404
      console.log("404!");
      util.handle404(res);
      return;
    }
    if (state == "failed")
    {
      etext = board.errormessage;
    }

    //get the page
    try
    {
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
        board: board,
        alertstatus: stat,
        alerttext: message,
        errortext: etext,
        partials: {
          main: "build-" + state,
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
});

// LaTeX and PDF completed download location
app.use('/build/css', express.static(__dirname + '/css'));
app.use('/build/js', express.static(__dirname + '/js'));
app.use('/build/img', express.static(__dirname + '/img'));
app.use('/build/fonts', express.static(__dirname + '/fonts'));
app.use('/build', express.static(__dirname + '/build'));

// Final index GET
app.get('/', function (req, res) {
  var queuecount = stache.queued.length;
  if (queuecount == 0) { queuecount = null; }

  res.render('main', {
    applicationkey: config.key,
    building: stache.building,
    built: stache.built,
    queuecount: queuecount,
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
  util.handle404(res);
});

// Handle 500
app.use(function(err, req, res, next) {
  res.status(500);
  console.log(err.stack);
  res.render('main', {
    applicationkey: config.key,
    errorcode: "500",
    errortext: "INTERNAL SERVER ERROR",
    stack: err.stack,
    date: new Date().toJSON(),
    partials: {
      main: 'crash',
      helpbutton: 'helpbutton'
    }
  });
});

//serve HTTP
app.listen(port);

console.log("Server ready on port " + port);
