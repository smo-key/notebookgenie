var http = require("http");
var https = require("https");
var fs = require("fs");
var s = require("string");
var d = require("do");
var flow = require('nimble');
var OAuth = require('oauth').OAuth;
var t2t = require("./trello2latex.js");
var svr = require("../server.js");
var date = require("./date.js");
//
//var marked = require("marked");
//marked.setOptions({
//  renderer: new marked.Renderer(),
//  gfm: true,
//  tables: false,
//  breaks: false,
//  pedantic: false,
//  sanitize: true,
//  smartLists: false,
//  smartypants: false
//});

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
  console.log("FILE START WRITE - " + filename);
  var file = fs.createWriteStream(filename);
  try {
    https.get(url, function(res) {
      res.on('data', function(chunk) {
        file.write(chunk);
      });
      res.on('end', function () {
        file.end();
        console.log("FILE END WRITE! - " + filename);
        cb(true);
      });
    });
  } catch (e) {
    try {
    http.get(url, function(res) {
      res.on('data', function(chunk) {
        file.write(chunk);
      });
      res.on('end', function () {
        file.end();
        console.log("FILE END WRITE! - " + filename);
        cb(true);
      });
    }).on('error', function(e) {
      throw e;
    });
    } catch(e) {
      console.log("FILE ERROR! - " + filename);
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

exports.queueadd = function queueadd(public, id, uid, cardlist, authdata, odata, u, callback)
{
  //TODO check if already present in building or queued (remove if in built)

  //add a set to the stache
  var board = { };
  board.id = id;
  board.auth = authdata;
  board.public = public;
  board.org = "";

  board.orgurl = null;
  board.template = "LASA Robotics"; //TODO un-hardset
  board.email = null;
  board.uid = uid;

  console.log(id);
  console.log(uid);

  if (cardlist == false) { cardlist = [ ]; }

  flow.series([
    function getdata(cb)
    {
      trello("/boards/" + board.uid + "?fields=all", authdata, odata, function(e, brd) {
        board.title = brd.name;
        board.public = (brd.prefs.permissionLevel == "public");
        board.titleurl = board.public ? brd.shortUrl : null;

        if (isnull(brd.idOrganization))
        {
          //user-owned, just get first member name and url
          trello("/boards/" + board.uid + "/members" + "?filter=owners", authdata, odata, function(e, d) {
            trello("/members/" + d[0].id , authdata, odata, function(e, data) {
              //TODO error catching
              board.orgpublic = board.public;
              board.org = board.orgpublic ? data.fullName : "A Trello User";
              board.orgurl = board.orgpublic ? data.url : null;
              cb(); return;
            });
          });
        }
        else
        {
          //organization-owned, get org name and url
          trello("/boards/" + board.uid + "/organization", authdata, odata, function(e, data) {
            //TODO error catching
            board.orgpublic = (data.prefs.permissionLevel == "public");
            board.org = data.displayName;
            board.orgurl = board.orgpublic ? data.url : null;
            cb(); return;
          });
        }
      });
    },
    function pushboard(cb)
    {
      console.log(board);
      //check if nothing is building
      if (isnull(svr.stache.building))
      {
        board.progress = 0;
        svr.stache.building = board;

        t2t.startbuild(JSON.stringify(board), JSON.stringify(u), JSON.stringify(odata), JSON.stringify(cardlist));

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
  if(progress > b.progress) { b.progress = progress;
  updateboard(JSON.stringify(b), function()
              { svr.emitter.emit('updateprogress'); }); }
  return b;
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

exports.cloneobject = function cloneobject(a) {
   return JSON.parse(JSON.stringify(a));
}

exports.getstatusfromstate = function getstatusfromstate(state) {
  if (state == "building" || state == "queued") { return "primary"; }
  if (state == "built") { return "success"; }
  return "info";
}

exports.converttime = function converttime(time) {
 if (!isnull(time)){
    var str = s(time).replaceAll("T", " ").s.match(/.+(?=\.)/);
    str += " UTC"
    str += " UTC"
    return new Date(str).add({ hours: -1 }).toString("M/d/yyyy HH:mm");
 } 
 else{
    return "";
 }
}

exports.mark = function mark(str) {
  var parsemarkdown = true;  //FIXME for now forced to true!
  if (parsemarkdown && !isnull(str)) {
    // place the @ character in front of a literal char
    return str.replace(/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/igm, '@!\\url@!{$1@!}') //urls
    .replace(/\*\*(.*)\*\*/igm, '@!{@!\\bf $1@!}') //bold face
    .replace(/\*(.*)\*/igm, '@!{@!\\emph $1@!}'); //italics

  }
  else { return str; }
}

Array.prototype.sortByProp = function(p){
  return this.sort(function(a,b){
    return (a[p] > b[p]) ? 1 : (a[p] < b[p]) ? -1 : 0;
  });
};
