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
  building: null,
  queued: [ ],
  built: [ ], //unique: timestamp
  failed: [ ] //unique: errormessage, timestamp, humantime (JSON time)
}

/* EXPRESS */
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

//APP USAGE PARAMS
app.param('id', /^([a-zA-Z0-9]){8}$/);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieparser());

/* OAUTH DETAILS */
var odata = { requestURL: "https://trello.com/1/OAuthGetRequestToken",
              accessURL: "https://trello.com/1/OAuthGetAccessToken",
              authorizeURL: "https://trello.com/1/OAuthAuthorizeToken",
              callbackURL: config.domain + "/ajax/completeauth",
              key: config.key,
              secret: config.secret }
//TODO fix this callback to the global setting... or figure out a workaround

//need to store token: tokenSecret pairs; in a real application, this should be more permanent (redis would be a good choice)
oauth_secrets = {};

/* SERVER */

// TODO cron job for removing builds after 24 hours (if over 5 recently built)

// API POST requests
app.use('/ajax/prepurl', function(req, res) {
  //Check if valid URL
  var url = req.body.url;
  util.prepurl(url, function(status) {
    util.sendjson(status, res); return;
  });
});

app.use('/ajax/authorize', function(req, res) {
  var url = req.body.url;
  oauth = new OAuth(odata.requestURL, odata.accessURL, odata.key, odata.secret, "1.0", odata.callbackURL, "HMAC-SHA1");
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
      util.sendjson({ url: odata.authorizeURL + "?oauth_token=" + token + "&name=" + config.appname + "&expiration=1day" }, res);
    });
  });
});

app.use('/ajax/completeauth', function(req, res) {

  oauth = new OAuth(odata.requestURL, odata.accessURL, odata.key, odata.secret, "1.0", odata.callbackURL, "HMAC-SHA1");

  query = url.parse(req.url, true).query;

  token = query.oauth_token;
  tokenSecret = oauth_secrets[token];
  delete oauth_secrets[token];
  verifier = query.oauth_verifier;

  oauth.getOAuthAccessToken(token, tokenSecret, verifier, function(error, accessToken, accessTokenSecret, results)
  {
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
      text = S("We couldn't sign you in to your account.").escapeHTML().s;
      error = true;
    } else { error = false; }

    var auth = { token: token, tokenSecret: tokenSecret, accessToken: accessToken, accessTokenSecret: accessTokenSecret };

    //TODO check for board duplicates (SHARE WITH PUBLIC AUTH)

    //redirect
    var uid = "";
    flow.series([
      function checkexist(cb) {
        if (!error)
        {
          //check if the board id in question is accessable by this user
          util.trello("/members/me/boards", auth, odata, function(er,json) {
            if (er)
            {
              status = "danger";
              text = S("We couldn't check if the board belongs to you.").escapeHTML().s;
              error = true; cb();
            } else
            {
              error = true;
              json.forEach(function(board) {
                if (board.shortLink == id) { error = false; uid = board.id; }
              });
              if (error)
              {
                status = "danger";
                text = S("The board is inaccessible from your account.").escapeHTML().s;
                error = true; cb();
              } else { cb(); }
            }
          });
        } else { cb(); }
      },
      function queue(cb) {
        if (!error)
        {
          util.queueadd(stache, false, id, uid, auth);
          cb();
        } else { cb(); }
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
    var uid = "";

    //redirect
    flow.series([
      function getuid(cb) {
        try
        {
          util.download("https://trello.com/b/" + id + ".json", function(data) {
            //TODO error checking
            var json = JSON.parse(data);
            uid = json.id;
            cb();
          });
        } catch (e)
        {
          cb();
        }
      },
      function queue(cb) {
        util.queueadd(stache, true, id, uid, null);
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
  console.log(req.params);
  util.checkstache(stache, req.params.id[0], function(state, board, i) {
    var id = (req.params.id)[0];
    var etext = "";

    //check if there's a message to display
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

    //check where the item is in processing
    if (state == null)
    {
      //not in queue at all - give it a 404
      console.log("404!");
      res.clearCookie('text', { path: '/' });
      res.clearCookie('status', { path: '/' });
      res.render('main', {
        applicationkey: config.key,
        alertstatus: stat,
        alerttext: message,
        errortext: "There is no board in build queue at this address.<br>Would you like to <a href='/'>build yours</a>?",
        partials: {
          main: "build-failed",
          helpbutton: 'helpbutton',
          public: 'public',
          private: 'private',
          alert: alert
        }
      });
      return;
    }
    if (state == "failed")
    {
      etext = board.errormessage;
    }

    //get the page
    try
    {
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
