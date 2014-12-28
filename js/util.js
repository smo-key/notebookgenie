var http = require("http");
var https = require("https");
var s = require("string");
var d = require("do");

function prep_genjson(status, message, public)
{
  var json = {
    status: status,
    message: message,
    public: public
  };
  return json;
}

function login_genjson(status, message, public, boardname)
{

}

function isnull(data)
{
  if ((data == undefined) || (data == null) || (data == "")) { return true; }
  return false;
}

function download(url, cb)
{
  var data = "";
  https.get(url, function(res) {
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on('end', function () {
      console.log("data1: " + data);
      cb(data);
    });
  }).on('error', function(e) {
    data = null;
    cb(data);
  });
}

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

    /* SET A COOKIE
    var session = sessions.lookupOrCreate(request,{
      lifetime:604800
    });
    response.writeHead(200, {
      'Content-Type': 'text/plain',
      'Set-Cookie', session.getSetCookieHeaderValue()
    });
    */

    cb(prep_genjson(2, "", true), id, data); return;
  });
};

exports.queuebuild = function queuebuild(stache, status, id, logindata)
{
  //add a set to the stache
  console.log(logindata);
  var board = { };
  board[id] = id;
  board[token] = logindata.token;
  board[public] = status.public;
  board[org]; //TODO get from Trello using API
  board[title];
  board[orgurl];
  board[titleurl];
  board[template] = "LASA Robotics"; //TODO un-hardset
  board[email] = null; //TODO add user field
  board[user]; //TODO get username that initiated the login
  board[progress] = 0;

  //check if nothing is building
  if (!isnull(stache.building))
  {

  }
}

exports.loginstart = function loginstart(trello, boardid, cb)
{
  trello.get("/1/boards/" + boardid + "/name", function(err, data) {
    if (err) { throw err; }
    console.log(data);
  });
}

exports.sendjson = function sendjson(json, res)
{
  var s = JSON.stringify(json);
  res.writeHead(200, { 'Content-Type': 'application/json',
                       'Content-Length': s.length });
  res.end(s);
}
