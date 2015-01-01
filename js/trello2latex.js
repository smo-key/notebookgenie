var util = require("./util.js");
var svr = require("../server.js");
var flow = require('nimble');
var fs = require("fs");
var jsonsafeparse = require('json-safe-parse');

exports.startbuild = function startbuild(board, u, odata) {
  //create user preferences array
  u = JSON.parse(u);
  //oauth data
  odata = JSON.parse(odata);
  //complete credential verification - DONE in board
  board = JSON.parse(board);
  //download JSON -> raw
  util.trello("/boards/" + board.uid + "?lists=all&members=all&member_fields=all&organization=true&organization_fields=all&fields=all", board.auth, odata, function(e, raw) {

    console.log(raw);

    //create JSON array to store board information for LaTeX -> b
    var b = { };
    //create temp folder
    var tmp = "tmp/" + board.id + "/";

    flow.series([
      function preparefs1(cb) {
        fs.exists("tmp/", function(exists) {
          if (!exists)
          {
            fs.mkdir("tmp/", function() { cb(); });
          }
          else { cb(); }
        });
      },
      function preparefs2(cb) {
        fs.exists(tmp, function(exists) {
          if (exists)
          {
            fs.rmdir(tmp, function() {
              fs.mkdir(tmp, function() { cb(); });
            });
          } else
          {
            fs.mkdir(tmp, function() { cb(); });
          }
        });
      },
      function preparefs3(cb) {
        fs.mkdir(tmp + "img", function() { cb(); });
      },
      function getmembers(cb) {
        //***** Create LaTeX-Usable JSON Cache *****//
        //get members data
        b.members = [ ];

        util.trello("/boards/" + board.uid + "/members", board.auth, odata, function(e, d) {
          //TODO error catching (and onward error catching as well)
          d.forEach(function(m, i) {
            util.trello("/members/" + d[i].id, board.auth, odata, function(e, member){
              var mem = { };
              //get image for each member -> b.members.avatar
              util.downloadfile("https://trello-avatars.s3.amazonaws.com/" + member.avatarHash + "/170.png", tmp + "img/" + d[i].id + ".png", function(e) {
                if (!e) {
                  //no avatar, that's ok
                  mem.avatar = null;
                }
                else
                {
                  mem.avatar = "img/" + d[i].id + ".png";
                }
                //get name for each member -> b.members.name
                mem.name = member.fullName;
                //get initials -> b.members.initials
                mem.initials = member.initials;
                console.log("GET USER!");
                b.members.push(mem);
                if (i == d.length - 1) { cb(); return; }
              });
            });
          });
        });
      },
      function getlists(cb) {
        //get lists and their cards, checklists, etc.
        b.lists =
        util.trello("/boards/" + board.uid + "/lists?cards=all", board.auth, odata, function(e, data) {
          data.forEach(function(e, list) {

          });
        });
        //raw.cards -> b.cards and send id to b.lists.cards
        //raw.checklists -> b.checklists and send id to b.lists.cards.checklists
        cb();
      },
      function getotherdata(cb) {
        console.log("GET OTHER!");
        //raw.shortLink -> b.id
        b.id = board.id;
        //raw.url -> b.url
        b.url = raw.shortUrl;
        //raw.labelNames -> b.labels
        b.labels = raw.labelNames;
        //raw.description -> b.description
        b.desc = raw.desc;
        //data from board
        b.title = board.title;
        b.org = { };
        b.org.url = board.orgurl;
        b.org.name = board.org;
        //TODO get additional data from org (image, etc.)
        //TODO b.org.isorg

        cb();
      },
      function flushprogress(cb) {
        console.log("GET B!");
        console.log(b);
        board = util.updateprogress(JSON.stringify(board), 20);
        cb();
      }
    ]);
  });
};
