var http = require("http");
var https = require("https");
var fs = require("fs");
var s = require("string");
var d = require("do");
var flow = require('nimble');
var OAuth = require('oauth').OAuth;
var t2t = require("./trello2latex.js");
var svr = require("../server.js");

function prep_genjson(status, message, public)
{
  var json = {
    status: status,
    message: message,
    public: public
  };
  return json;
}

function isnull(data)
{
  if ((data == undefined) || (data == null) || (data == "")) { return true; }
  return false;
}
exports.isnull = isnull;

function download(url, cb)
{
  var data = "";
  https.get(url, function(res) {
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on('end', function () {
      cb(data);
    });
  }).on('error', function(e) {
    data = null;
    cb(data);
  });
}
exports.download = download;

exports.downloadfile = function downloadfile(url, filename, cb)
{
  var file = fs.createWriteStream(filename);
  try {
    https.get(url, function(res) {
      res.on('data', function(chunk) {
        file.write(chunk);
      });
      res.on('end', function () {
        file.end();
        cb(true);
      });
    }).on('error', function(e) {
      file.end();
      cb(false);
    });
  } catch (e) {
    try {
    http.get(url, function(res) {
      res.on('data', function(chunk) {
        file.write(chunk);
      });
      res.on('end', function () {
        file.end();
        cb(true);
      });
    }).on('error', function(e) {
      file.end();
      cb(false);
    });
    } catch(e) {
      cb(false);
    }
  }
}

var apiver = "1";
function trello(u, auth, odata, cb)
{
  var url = "https://api.trello.com/" + apiver + u;

  if (!isnull(auth))
  {
    //must be private - get via OAuth
    console.log("PRIVATE GET: " + url);
    oauth = new OAuth(odata.requestURL, odata.accessURL, odata.key, odata.secret, "1.0", odata.callbackURL, "HMAC-SHA1");
    oauth.getProtectedResource(url, "GET", auth.accessToken, auth.accessTokenSecret, function(error, data, response) {
      if (error) { cb(true, error); return; }
      cb(false, JSON.parse(data)); return;
    });
  }
  else
  {
    //must be public - get via API

    //check if parameters already exist
    if (s(url).contains("?"))
    {
      url = url +  "&key=" + odata.key;
    } else {
      url = url +  "?key=" + odata.key;
    }
    console.log("PUBLIC GET: " + url);

    download(url, function(data) {
      cb(false, JSON.parse(data));
    });
  }
}
exports.trello = trello;

exports.prepurl = function prepurl(url, cb)
{
  //Test if URL is defined
  if (isnull(url))
  { cb(prep_genjson(0, "Please enter the board's URL.", true)); return; }

  //test if URL is a board
  if (!url.match(/^(https?:\/\/trello.com\/b\/)(\w{8})(\b|((\/\S+)+))/))
  { cb(prep_genjson(0, "Please enter a valid Trello board URL.", true)); return; }

  //get Trello board ID
  try {
    var id = url.match(/(\w{8})(?:\/\S+?)*(\/)*$/)[0].split("\/")[0];
  } catch (e) { cb(prep_genjson(0, "Please enter a valid Trello board URL.", true)); return; }

  //check if board JSON exists
  download("https://trello.com/b/" + id + ".json", function(data) {
    if (isnull(data))
    { cb(prep_genjson(0, "We couldn't download the board's data from the Trello server.", true)); return; }

    if (s(data).contains("not found"))
    { cb(prep_genjson(0, "There is no board at this URL.", true)); return; }

    //check if board is private
    if (s(data).contains("unauthorized"))
    { cb(prep_genjson(2, "Nice!  We detected this board is private, so we'll need to you to login when you're ready.", false), id, data); return; }

    cb(prep_genjson(2, "", true), id, data); return;
  });
};

exports.queueadd = function queueadd(public, id, json, authdata, odata, callback)
{
  //TODO check if already present in building or queued (remove if in built)

  //add a set to the stache
  var board = { };
  board.id = id;
  board.auth = authdata;
  board.public = public;
  board.org = "";
  board.title = json.name;
  board.orgurl = null;
  if (public) { board.titleurl = json.shortUrl; } else
              { board.titleurl = null }
  board.template = "LASA Robotics"; //TODO un-hardset
  board.email = null; //TODO add user field
  //board.user = ""; //TODO get username that initiated the login
  board.uid = json.id;

  flow.series([
    function getdata(cb)
    {
      if (isnull(json.idOrganization))
      {
        //user-owned, just get first member name and url
        trello("/boards/" + board.uid + "/members" + "?filter=owners", authdata, odata, function(e, d) {
          trello("/members/" + d[0].id , authdata, odata, function(e, data) {
            //TODO error catching
            board.org = data.fullName;
            board.orgurl = data.url;
            cb(); return;
          });
        });
      }
      else
      {
        //organization-owned, get org name and url
        trello("/boards/" + board.uid + "/organization", authdata, odata, function(e, data) {
          //TODO error catching
          board.org = data.displayName;
          board.orgurl = data.url;
          cb(); return;
        });
      }
    },
    function pushboard(cb)
    {
      //check if nothing is building
      if (isnull(svr.stache.building))
      {
        board.progress = 0;
        svr.stache.building = board;

        t2t.startbuild(JSON.stringify(board), JSON.stringify({ }), JSON.stringify(odata));

        callback(); cb(); return;
      }
      else
      {
        //add to queue
        svr.stache.queued.push(board);
        callback(); cb(); return;
      }
    }
  ]);
}

exports.queuebuild = function queuebuild(id)
{

}

exports.queuecomplete = function queuecomplete(id)
{

}

exports.queueremove = function queueremove(id)
{

}

exports.checkstache = function checkstache(id, cb)
{
  var c = false;
  if (!isnull(svr.stache.building))
  {
    if (svr.stache.building.id == id) { cb("building", svr.stache.building); c = true; return; }
  }

  svr.stache.queued.forEach(function(item, i) {
    if (item.id == id) { cb("queued", item, i); c = true; return; }
  });
  svr.stache.built.forEach(function(item, i) {
    if (item.id == id) { cb("built", item, i); c = true; return; }
  });
  svr.stache.failed.forEach(function(item, i) {
    if (item.id == id) { cb("failed", item, i); c = true; return; }
  });
  if (!c) { cb(null); }
}

function updateboard(board, cb)
{
  var c = false;
  var b = JSON.parse(board);
  var uid = b.uid;
  if (!isnull(svr.stache.building))
  {
    if (svr.stache.building.uid == uid) { svr.stache.building = b; cb(); return; }
  }

  svr.stache.queued.forEach(function(item, i) {
    if (item.uid == uid) { svr.stache.queued[i] = b; cb(); c = true; return; }
  });
  svr.stache.built.forEach(function(item, i) {
    if (item.uid == uid) { svr.stache.built[i] = b; cb(); c = true; return; }
  });
  svr.stache.failed.forEach(function(item, i) {
    if (item.uid == uid) { svr.stache.built[i] = b; cb(); c = true; return; }
  });
  if (!c) { cb(); }
}
exports.updateboard = updateboard;

exports.updateprogress = function updateprogress(board, progress)
{
  var b = JSON.parse(board);
  b.progress = progress;
  updateboard(JSON.stringify(b), function()
              { svr.emitter.emit('updateprogress'); });
  return b;
}

exports.handle404 = function handle404(res)
{
  res.status(400);
  res.render('main', {
    applicationkey: config.key,
    errorcode: "404",
    errortext: "NOT FOUND",
    date: new Date().toJSON(),
    partials: {
      main: 'crash',
      helpbutton: 'helpbutton'
    }
  });
}

exports.getdomain = function getdomain(url) {
  var parts = url.split("/");
  if (url.match("/:\/\//"))
  {
    return parts[2];var ts = Date.now() / 1000;
  }
  else { return "http://" + parts[0]; }
}

exports.sendjson = function sendjson(json, res)
{
  var s = JSON.stringify(json);
  res.writeHead(200, { 'Content-Type': 'application/json',
                       'Content-Length': s.length });
  res.end(s);
  res.send();
}


