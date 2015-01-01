var util = require("./util.js");
var svr = require("../server.js");
var flow = require('nimble');
var fs = require("fs");
var rmrf = require("rimraf");
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

//    console.log(raw);

    //create JSON array to store board information for LaTeX -> b
    var b = { };
    //create temp folder
    var tmp = "tmp/" + board.id + "/";

    flow.series([
      function preparefs1(cb) { //TODO use rimraf for rmrf!
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
        fs.mkdir(tmp + "img", function() {
          fs.mkdir(tmp + "dl", function() {
            cb();
          });
        });
      },
      function getmembers(callback) {
        //***** Create LaTeX-Usable JSON Cache *****//
        //get members data
        b.members = [ ];

        //TODO error catching (and onward error catching as well)
        raw.members.forEach(function(member, i) {
          var mem = { };
          //get image for each member -> b.members.avatar
          util.downloadfile("https://trello-avatars.s3.amazonaws.com/" + member.avatarHash + "/170.png", tmp + "img/" + member.id + ".png", function(e) {
            flow.series([
              function getavatar(cb) {
                if (!e) {
                  //no avatar, that's ok
                  mem.avatar = null;
                  cb();
                }
                else
                {
                  mem.avatar = "img/" + member.id + ".png";
                  cb();
                }
              },
              function getremainder(cb) {
                //get name for each member -> b.members.name
                mem.name = member.fullName;
                //get initials -> b.members.initials
                mem.initials = member.initials;
                console.log("GET USER!");
                b.members.push(mem);
                if (i == raw.members.length - 1) { callback(); cb(); }
                else { cb(); }
              }
            ]);
          });
        });
      },
      function getlists(cb) {
        console.log("GET LISTS");
        //get lists and their cards, checklists, etc.
        b.lists = [ ];
        raw.lists.forEach(function(l, i) {
          util.trello("/lists/" + l.id + "?cards=open", board.auth, odata, function(e, li) {
            //get list
            var list = { };
            list.cards = [ ];
            list.name = li.name;
            list.id = li.id;
            list.pos = li.pos;
            li.cards.forEach(function(c, j) {
              //TODO allow template to set the action limit
              util.trello("/cards/" + c.id + "?actions=all&actions_limit=1000&action_memberCreator_fields=fullName,initials,username,url&attachments=true&membersVoted=true&memberVoted_fields=fullName,initials,username,url&checklists=all&members=true&member_fields=fullName,initials,username,url", board.auth, odata, function(e, cr) {
                //get card
//                console.log(cr);
                var card = { };
                card.id = cr.id;
                card.name = cr.name;
                card.desc = cr.desc;
                card.lastmodified = cr.dateLastActivity;
                card.due = cr.due; //TODO friendly time format
                card.pos = cr.pos;
                card.url = cr.url;
                card.labels = cr.labels;
                card.attachments = [ ];
                //download card attachments to /tmp/dl
                cr.attachments.forEach(function(attach, k) {
                  if (attach.url.match(/\.[0-9a-zA-Z]+$/))
                  {
                    var ur = tmp + "dl/" + attach.id + attach.url.match(/\.[0-9a-zA-Z]+$/)[0];
                    util.downloadfile(attach.url, ur, function(e) {
                      if (e)
                      {
                        card.attachments.push({ url: ur, name: attach.name, date: attach.date });
                        //get card cover using cr.idAttachmentCover
                        if (attach.id == cr.idAttachmentCover)
                        { card.attachmentcover = { url: ur }; }
                      }
                    });
                  }
                });

                //get members
                //get actions
                //get votes
                //get checklists

                //TODO lists by loc, sort cards by loc

                list.cards.push(card);
                if (i == raw.lists.length - 1) { b.lists.push(list); cb(); }
              });
            });
          });
        });

        //raw.cards -> b.cards and send id to b.lists.cards
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
        if (util.isnull(raw.idOrganization)) { b.org.isorg = false; }
        else { b.org.isorg = true; }
        b.lastmodified = raw.dateLastActivity; //TODO make this from ISO -> human readable

        //TODO get additional data from org (image, etc.)

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
