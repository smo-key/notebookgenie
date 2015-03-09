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
    OAuth = require('oauth').OAuth,
    flow = require('nimble'),
    domain = require('domain'),
    async = require('async'),
    EventEmitter = require('events').EventEmitter,
    mu = require('mu2'),
    cookieparser = require('cookie-parser');

//initialize renderer
var app = express();
var router = express.Router();
var server = require('http').Server(app);
var io = require('socket.io')(server);
app.engine('html', cons.mustache);
app.set('view engine', 'html');
app.set("view options", {layout: false});
app.set('views', __dirname + '/partials');
mu.root = __dirname + "/partials";

/* GET PROCESS INFORMATION */
configname = process.argv[3] || "_private.yml";

/* READ SERVER CONFIG */
configdata = fs.readFileSync(configname);
config = yaml.safeLoad(configdata);
config.port = process.argv[2] || config.port || 8000; //server port

exports.stache = {
  building: null,
  queued: [ ],
  built: [ ], //unique: timestamp
  failed: [ ] //unique: errormessage, timestamp, humantime (JSON time)
}
exports.dm = domain.create();
exports.emitter = new EventEmitter();
exports.dm.add(exports.emitter);

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
              callbackURL: config.domain + ":" + config.port + "/api/completeauth",
              key: config.key,
              secret: config.secret }
//TODO fix this callback to the global setting... or figure out a workaround

//need to store token: tokenSecret pairs; in a real application, this should be more permanent (redis would be a good choice)
oauth_secrets = {};

/* SERVER */

// TODO cron job for removing builds after 24 hours (if over 5 recently built)

// Socket.IO progress updater

io.on('connection', function (socket) {
  console.log("CLIENT CONNECTED");
  exports.emitter.on('updateprogress', function () {
    console.log('CLIENT - SEND UPDATE');

    var status = false;
    var id = null;
    var progress = 0;
    if (!util.isnull(exports.stache.building))
    {
      status = true;
      id = exports.stache.building.id;
      progress = exports.stache.building.progress;
    }
    socket.emit('progress', { status: status, id: id, progress: progress });
  });

  exports.emitter.on('updatestatus', function (board) {
    console.log('CLIENT - SEND FRAGMENT UPDATE ' + board.id);

    //compile main fragment (build-main)
    var smain = "";
    mu.compileAndRender("build-main.html", {
      applicationkey: config.key,
      appurl: config.domain,
      isupdatable: true,
      id: null,
      building: exports.stache.building,
      built: exports.stache.built
    })
    .on('data', function(data) {
      smain += data.toString();
    })
    .on('end', function() {
      //build built section of main
      var sbuilt = "";
      mu.compileAndRender("fragment-built.html", {
        applicationkey: config.key,
        appurl: config.domain,
        isupdatable: true,
        id: null,
        building: exports.stache.building,
        built: exports.stache.built
      })
      .on('data', function(data) {
        sbuilt += data.toString();
      })
      .on('end', function() {
        //build the active board ID
        var sactive = "";
        util.checkstache(board.id, function(state) {
          mu.compileAndRender("build-" + state + ".html", {
            applicationkey: config.key,
            appurl: config.domain,
            isupdatable: true,
            id: board.id,
            board: board,
            errortext: "The board failed to build due to an error." +
              (util.isnull(board.errormessage) ? "<hr>" + board.errormessage : "")
          })
          .on('data', function(data) {
            sactive += data.toString();
          })
          .on('end', function() {
            var d = { main: smain, built: sbuilt, active: sactive, id: board.id, status: util.getstatusfromstate(state) };
            socket.emit('fragment', d);
          });
        });
      });
    });
  });

  socket.on('disconnect', function (socket) {
    console.log("CLIENT DISCONNECTED");
  });
}); //end socket.io


// API POST requests

app.use('/api/prepurl', function(req, res) {
  //Check if valid URL
  var url = req.body.url;
  util.prepurl(url, function(status) {
    util.sendjson(status, res); return;
  });
});

app.get('/login', function (req, res) {
  var queuecount = exports.stache.queued.length;
  if (queuecount == 0) { queuecount = null; }

  res.render('main', {
    applicationkey: config.key,
    appurl: config.domain,
    isupdatable: false,
    id: null,
    year: new Date().getFullYear().toString(),
    partials: {
      main: 'login',
      private: 'private'
    }
  });
});

app.use('/api/authorize', function(req, res) {
  oauth = new OAuth(odata.requestURL, odata.accessURL, odata.key, odata.secret, "1.0", odata.callbackURL, "HMAC-SHA1");
//  util.prepurl(url, function(status, id) {
//    if (status.status != 2) { console.log("AUTHORIZE STATUS ERROR!"); return; } //TODO error handling
    //send an OAuth request to get the application name and key
  oauth.getOAuthRequestToken(function(error, token, tokenSecret, results) {
    if (error)
    {
      console.log("AUTHORIZE error!");
      //TODO client-side error dialog handling
      return;
    }
    oauth_secrets[token] = { };
    oauth_secrets[token].auth = { };
    oauth_secrets[token].auth.token = token;
    oauth_secrets[token].auth.tokenSecret = tokenSecret;
    console.log("TOKENS: " + token + " SECRET: " + tokenSecret + " RESULTS: " + results + " ERROR: " + error);
    util.sendjson({ url: odata.authorizeURL + "?oauth_token=" + token + "&name=" + config.appname + "&expiration=1day" }, res);
  });
//  });
});

app.use('/api/completeauth', function(req, res) {

  oauth = new OAuth(odata.requestURL, odata.accessURL, odata.key, odata.secret, "1.0", odata.callbackURL, "HMAC-SHA1");

  query = url.parse(req.url, true).query;

  token = query.oauth_token;
  tokenSecret = oauth_secrets[token].auth.tokenSecret;
  verifier = query.oauth_verifier;

  oauth.getOAuthAccessToken(token, tokenSecret, verifier, function(error, accessToken, accessTokenSecret, results)
  {
    //store accessToken and accessTokenSecret

    var status = "success";
    var text = S("<span class='glyphicon glyphicon-ok'></span>Sign in successful!").escapeHTML().s;
    //FIXME error handling -> 404-ish page (no cookies!) - read previous commits

    var auth = { token: token, tokenSecret: tokenSecret, accessToken: accessToken, accessTokenSecret: accessTokenSecret };
    oauth_secrets[token].auth = auth;
    //send token back, ready to get remainder of data

    res.writeHead(302, { 'Location': "/build/start?token="+token });
    res.send();
  });
});

app.get('/build/start', function(req, res){
  query = url.parse(req.url, true).query;
  token = query.token;
  var auth = oauth_secrets[token].auth;
  util.trello('/members/me?fields=username,fullName,url', auth, odata, function(e, user) {
    var data = { };
    data.user = { };
    data.user.name = user.fullName;
    data.user.url = user.url;
    data.user.username = user.username;
    res.render('main', {
      applicationkey: config.key,
      appurl: config.domain,
      isupdatable: false,
      user: data.user,
      year: new Date().getFullYear().toString(),
      partials: {
        main: "buildstart",
        fragment: "buildstart-1",
        public: 'public',
        private: 'private',
        querystring: 'querystring'
      }
    });
  });
});

app.get('/build/getboards', function(req, res){
  query = url.parse(req.url, true).query;
  token = query.token;
  var auth = oauth_secrets[token].auth;
  var data = { };

  //get user info
  util.trello('/members/me?fields=username,fullName,url', auth, odata, function(e, user) {
    //get board data
    //FIXME error handling
    data.user = { };
    data.user.name = user.fullName;
    data.user.url = user.url;
    data.user.username = user.username;
    util.trello('/members/me/boards?filter=open&fields=name,url,shortUrl,shortLink,idOrganization,initials', auth, odata, function(e, boards) {
      data.boards = [ ];
      async.eachSeries(boards, function(b, cb) {
        var board = { };
        board.id = b.shortLink;
        board.title = b.name;
        board.titleurl = b.url;
        board.uid = b.id;

        if (util.isnull(b.idOrganization))
        {
          //user-owned, just get first member name and url
          util.trello("/boards/" + b.id + "/members" + "?filter=owners", auth, odata, function(e, d) {
            util.trello("/members/" + d[0].id , auth, odata, function(e, m) {
              //TODO error catching
              board.org = m.fullName;
              board.orgurl = m.url;
              data.boards.push(board);
              cb();
            });
          });
        }
        else
        {
          //organization-owned, get org name and url
          util.trello("/boards/" + b.id + "/organization", auth, odata, function(e, m) {
            //TODO error catching
            board.org = m.displayName;
            board.orgurl = m.url;
            data.boards.push(board);
            cb();
          });
        }
      }, function() {
        var d = { };
        d.auth = auth;
        d.user = data;
        oauth_secrets[token] = d;
        res.writeHead(302, { 'Location': "/build/?token="+token });
        res.send();
      });
    });
  });
});

app.get('/build/', function(req, res){
  query = url.parse(req.url, true).query;
  token = query.token;
  var auth = oauth_secrets[token].auth;
  var user = oauth_secrets[token].user;
  res.render('main', {
    applicationkey: config.key,
    appurl: config.domain,
    isupdatable: false,
    boards: user.boards,
    user: user.user,
    wide: true,
    year: new Date().getFullYear().toString(),
    partials: {
      main: "buildstart",
      fragment: "buildstart-2",
      public: 'public',
      private: 'private',
      querystring: 'querystring'
    }
  });
});

app.get('/build/templates', function(req, res){
  //get list of templates
  var data = oauth_secrets[url.parse(req.url, true).query.token];
  data.templates = [ ];
  data.templateoptions = { };
  fs.readdir('templates', function(e, dirs) {
    async.each(dirs, function(dir, cb) {
      if (fs.statSync('templates/' + dir).isDirectory()) {
        var hasyml = fs.existsSync('templates/' + dir + "/template.yml");
        var hastex = fs.existsSync('templates/' + dir + "/template.tex");
        var hasimg = false;  //TODO look for template image
        if (hasyml && hastex)
        {
          //read YAML and parse
          fs.readFile('templates/' + dir + '/template.yml', function(er, ymldata) {
            //TODO serve template images - for now text is fine
            var template = { name: dir };
            var templateopt = [ ];
            //get template options data
            yml = yaml.safeLoad(ymldata);
            console.log(yml);
            if (yml === undefined || yml == null || yml.length == 0)
            {
              
              template.nooptions = true;
              templateopt = { nooptions: true };
              
              data.templates.push(template);
              data.templateoptions[template.name] = templateopt;
              cb();
            }
            else
            {
              for (var k in yml) {
                if (yml.hasOwnProperty(k)) {
                  var v = { data: yml[k] };
                  v.istext = false;
                  v.isselect = false;
                  v.isblank = false;
                  v.ischeck = false;
                  v.isform = false;
                  v.id = k;

                  if (util.isnull(yml[k].type))
                  {
                    //just text
                    v.display = yml[k];
                    v.istext = true;
                  }
                  else
                  {
                    //not just text - find out what
                    if (yml[k].type == 'select')
                    {
                      v.isselect = true;
                      v.options = [ ];
                      //parse the options
                      for (var key in yml[k].options)
                      {
                        if (yml[k].options.hasOwnProperty(key))
                        {
                          v.options.push({ display: key });
                        }
                      }
                      console.log(v.options);
                    }
                    if (yml[k].type == 'blank')
                    { v.isblank = true; v.default = yml[k].default || ""; v.noblank = yml[k].noblank || false; }
                    if (yml[k].type == 'check')
                    { v.ischeck = true; }
                    if (yml[k].type == 'form')
                    { v.isform = true; v.default = yml[k].default || ""; v.noblank = yml[k].noblank || false; }
                    v.display = yml[k].display;
                  }

                  templateopt.push(v);
                }
              }
              
              console.log(templateopt);

              data.templates.push(template);
              data.templateoptions[template.name] = templateopt;
              cb();
            }
          });
        } else { cb(); }
      } else { cb(); }
    }, function() {
      var s = "";
      oauth_secrets[url.parse(req.url, true).query.token] = data;
      mu.compileAndRender("buildstart-3.html", {
        templates: data.templates
      })
      .on('data', function(data) {
        s += data.toString();
      })
      .on('end', function() {
        util.sendjson({ templates: s }, res);
      });
    });
  });
});

app.get('/build/options', function(req, res) {
  //get both template settings and overall board settings
  var data = oauth_secrets[url.parse(req.url, true).query.token];
  var template = data.templateoptions[url.parse(req.url, true).query.template];
  var s = "";
  mu.compileAndRender("buildstart-4.html", {
    template: template
  })
  .on('data', function(data) {
    s += data.toString();
  })
  .on('end', function() {
    util.sendjson({ templateoptions: s }, res);
  });
});

app.post('/build/now', function(req, res) {
  var token = req.body.token;
  var uid = req.body.board;
  var customs = req.body.customs; //TODO send customs to parsing
  var data = oauth_secrets[token];
  data.user.boards.forEach(function(board) {
    if (board.uid == uid)
    {
      util.queueadd(false, board.id, uid, false, data.auth, odata, function() {
        var url = "/build/" + board.id;
        console.log(url);
        util.sendjson({ url: url }, res);
      });
    }
  });
});

app.get('/build/custom', function(req, res) {
  var token = url.parse(req.url, true).query.token;
  var data = oauth_secrets[token];
  var uid = url.parse(req.url, true).query.board;
  data.uid = uid;
  data.customs = JSON.parse(url.parse(req.url, true).query.customs); //TODO send customs to parsing
  console.log(uid);
  data.custom = true;
  data.user.boards.forEach(function(board) {
    if (board.uid == uid)
    {
      //get list of cards
      console.log("GET LIST OF CARDS");
      data.allcards = [ ];
      util.trello("/boards/" + board.uid + "/lists?cards=all&card_fields=name,shortUrl,shortLink", data.auth, odata, function(e, lists) {
        //TODO error catching
        console.log(lists);
        console.log(board.uid);
        async.eachSeries(lists,
        function(list, cb) {
          async.eachSeries(list.cards, function(card, callb) {
            var c = { uid: card.id, id: card.shortLink, name: card.name, url: card.shortUrl, list: list.name };
            data.allcards.push(c);
            console.log(data.allcards);
            callb();
          }, function() { cb(); });
        },
        function(done) {
          data.boarddata = board;
          oauth_secrets[token] = data;
          console.log("Done!");
          console.log(data.allcards);
          res.render('main', {
            applicationkey: config.key,
            appurl: config.domain,
            isupdatable: false,
            cards: data.allcards,
            wide: true,
            year: new Date().getFullYear().toString(),
            partials: {
              main: "buildstart",
              fragment: "buildstart-custom",
              public: 'public',
              private: 'private',
              querystring: 'querystring'
            }
          });
        });
      });
    }
  });
});

app.post('/build/finish', function(req, res) {
  //finish custom build setup
  var token = req.body.token;
  var cards = req.body.cards;
  var iscardsuid = req.body.isuid; //FUTURE if cards are NOT in UID format, they are in URL format, parse here
  var data = oauth_secrets[token];
  //TODO send data.customs to parsing
  var uid = data.uid;
  util.queueadd(false, data.boarddata.id, data.boarddata.uid, cards, data.auth, odata, function() {
    var url = "/build/" + data.boarddata.id;
    console.log(url);
    util.sendjson({ url: url }, res);
  });
});

app.get('/build/:id', function(req, res){
  // Building and download LaTeX / PDF page
  console.log(req.params);
  util.checkstache(req.params.id[0], function(state, board, i) {
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
        appurl: config.domain,
        isupdatable: false,
        id: null,
        alertstatus: stat,
        alerttext: message,
        errortext: "There is no board in build queue at this address.<br>Would you like to <a href='/login'>build yours</a>?",
        status: "info",
        year: new Date().getFullYear().toString(),
        partials: {
          main: "build",
          helpbutton: 'helpbutton',
          public: 'public',
          private: 'private',
          alert: alert,
          fragment: "build-failed"
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
        appurl: config.domain,
        isupdatable: true,
        board: board,
        id: board.id,
        alertstatus: stat,
        alerttext: message,
        errortext: etext,
        status: util.getstatusfromstate(state),
        year: new Date().getFullYear().toString(),
        partials: {
          main: "build",
          helpbutton: 'helpbutton',
          public: 'public',
          private: 'private',
          alert: alert,
          fragment: "build-" + state
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
app.use('/build', express.static(__dirname + '/tmp'));

// Final index GET
app.get('/', function (req, res) {
  var queuecount = exports.stache.queued.length;
  if (queuecount == 0) { queuecount = null; }

  res.render('main', {
    applicationkey: config.key,
    appurl: config.domain,
    isupdatable: true,
    id: null,
    building: exports.stache.building,
    built: exports.stache.built,
    queuecount: queuecount,
    year: new Date().getFullYear().toString(),
    partials: {
      main: 'start',
      helpbutton: 'helpbutton',
      public: 'public',
      private: 'private',
      modal: 'modal-build',
      fragment: 'build-main',
      fragmentbuilt: 'fragment-built'
    }
  });
});

app.use('/img', express.static(__dirname + '/img'));
app.use('/css', express.static(__dirname + '/css'));
app.use('/fonts', express.static(__dirname + '/fonts'));
app.use('/js', express.static(__dirname + '/js'));


// Handle 404
app.use(function(req, res) {
  util.handle404(res, config);
});

// Handle 500
app.use(function(err, req, res, next) {
  res.status(500);
  console.log(err.stack);
  res.render('main', {
    applicationkey: config.key,
    isupdatable: false,
    id: null,
    errorcode: "500",
    errortext: "INTERNAL SERVER ERROR",
    stack: err.stack,
    date: new Date().toJSON(),
    year: new Date().getFullYear().toString(),
    partials: {
      main: 'crash',
      helpbutton: 'helpbutton'
    }
  });
});

//serve HTTP
server.listen(config.port);

console.log("Server ready on " + config.domain + ":" + config.port);
