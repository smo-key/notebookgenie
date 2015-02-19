var util = require("./util.js");
var svr = require("../server.js");
var flow = require('nimble');
var fs = require("fs");
var rmrf = require("rimraf");
var jsonsafeparse = require('json-safe-parse');
var sync = require('sync');
var async = require('async');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var execSync = require('child_process').execSync;
var mu = require('mutex'); //TODO change name to mu_tex

Array.prototype.sortByProp = function(p){
  return this.sort(function(a,b){
    return (a[p] > b[p]) ? 1 : (a[p] < b[p]) ? -1 : 0;
  });
};

exports.startbuild = function startbuild(board, u, odata) {
  //create user preferences array
  //FUTURE add YAML template data
//  u = JSON.parse(u);
  u = { _template: "LASA Robotics" };
  //oauth data
  odata = JSON.parse(odata);
  //complete credential verification - DONE in board
  board = JSON.parse(board);
  //download JSON -> raw
  svr.emitter.emit('updatestatus', board);
  util.trello("/boards/" + board.uid + "?lists=open&cards=visible&members=all&member_fields=all&organization=true&organization_fields=all&fields=all", board.auth, odata, function(e, raw) {

    //create JSON array to store board information for LaTeX -> b
    var b = { };
    //create temp folder
    var tmp = "tmp/" + board.id + "/";
    var templatedir = "templates/" + u._template + "/";

    var max = raw.cards.length;
    var cur = 0;

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
            rmrf(tmp, function() {
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
            board = util.updateprogress(JSON.stringify(board), 5);
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
          if (!util.isnull(member.avatarHash))
          {
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
                    mem.avatar = "img/" + member.id + ".png";-
                    cb();
                  }
                },
                function getremainder(cb) {
                  //get name for each member -> b.members.name
                  mem.name = member.fullName;
                  //get initials -> b.members.initials
                  mem.initials = member.initials;
                  mem.url = member.url;
                  mem.username = member.username;
                  console.log("GET USER!");
                  b.members.push(mem);
                  if (b.members.length == raw.members.length) { callback(); cb(); }
                  else { cb(); }
                }
              ]);
            });
          } else {
            //get name for each member -> b.members.name
            mem.name = member.fullName;
            //get initials -> b.members.initials
            mem.initials = member.initials;
            mem.avatar = null;
            mem.url = member.url;
            mem.username = member.username;
            console.log("GET USER - NO AVATAR!");
            b.members.push(mem);
            if (b.members.length == raw.members.length) { callback(); }
          }
        });
      },
      function getlists(listcallback) {
        console.log("GET LISTS");
        //get lists and their cards, checklists, etc.
        b.lists = [ ];
        raw.lists.forEach(function(l, i) {
          sync(function() {
            util.trello("/lists/" + l.id + "?cards=open", board.auth, odata, function(e, li) {
              //get list
              var list = { };
              list.cards = [ ];
              list.name = li.name;
              list.pos = li.pos;

              li.cards.forEach(function(c, j) {
                //TODO allow template to set the action limit
                util.trello("/cards/" + c.id + "?actions=commentCard&actions_limit=1000&action_memberCreator_fields=fullName,initials,username,url&attachments=true&membersVoted=true&membersVoted_fields=fullName,initials,username,url&checklists=all&members=true&member_fields=fullName,initials,username,url", board.auth, odata, function(e, cr) {
                  //get card
                  var card = { };
                  card.name = cr.name;
                  card.desc = cr.desc;
                  card.lastmodified = cr.dateLastActivity;
                  card.due = cr.due; //TODO friendly time format
                  card.pos = cr.pos;
                  card.url = cr.url;
                  console.log(cr.labels);
                  cr.labels.forEach(function(label) {
                    
                  });
                  card.attachments = [ ];
                  card.attachmentcover = null;

                  flow.series([
                    function getmembers(cb) {
                      console.log(i + " " + j + " GET MEMBERS");
                      //get members
                      card.members = [ ];
                      if (!util.isnull(cr.members)) {
                        cr.members.forEach(function(m, k) {
                          card.members.push({ avatar: "img/" + m.id + ".png", name: m.fullName, initials: m.initials, username: m.username, url: m.url });
                          if (card.members.length == cr.members.length) { cb(); }
                        });
                        if (cr.members.length == 0) { cb(); }
                      } else { cb(); }
                    },
                    function getcomments(cb) {
                      //get actions
                      card.comments = [ ];
                      cr.actions.forEach(function(act, k) {
                        console.log(act);
                        var action = { };
                        action.text = act.data.text;
                        action.date = act.date;
                        action.author = { };
                        action.author.id = act.memberCreator.id;
                        action.author.avatar = "img/" + act.memberCreator.id + ".png";
                        action.author.name = act.memberCreator.fullName;
                        action.author.initials = act.memberCreator.initials;
                        action.author.username = act.memberCreator.username;
                        action.author.url = act.memberCreator.url;
                        card.comments.push(action);
                        if (cr.actions.length == card.comments.length) { cb(); }
                      });
                      if (cr.actions.length == 0) { cb(); }
                    },
                    function getvotes(cb) {
                      console.log(i + " " + j + " GET VOTES");
                      //get votes
                      if (!util.isnull(cr.membersVoted)) {
                      card.votecount = cr.membersVoted.length;
                        card.voters = [ ];
                        cr.membersVoted.forEach(function(m, k) {
                          card.voters.push({ avatar: "img/" + m.id + ".png", name: m.fullName, initials: m.initials, username: m.username, url: m.url });
                          if (card.voters.length == cr.membersVoted.length) { cb(); }
                        });
                        if (cr.membersVoted.length == 0) { cb(); }
                      } else { cb(); }
                    },
                    function getchecklists(cb) {
                      console.log(i + " " + j + " GET CHECKLISTS");
                      //get checklists
                      if (!util.isnull(cr.checklists)) {
                        card.checklists = [ ];
                        cr.checklists.forEach(function(c, k) {
                          var items = [ ];
                          c.checkItems.forEach(function(item, l) {
                            if (item.state == "incomplete") { var checked = false; } else { var checked = true; }
                            var it = { name: item.name, pos: item.pos, checked: checked };
                            items.push(it);
                          });
                          card.checklists.push({ name: c.name, pos: c.pos, items: items.sortByProp('pos') });
                          if (card.checklists.length == cr.checklists.length) { cb(); }
                        });
                        if (cr.checklists.length == 0) { cb(); }
                      } else { cb(); }
                    },
                    function getattachments(cb) {
                      console.log(i + " " + j + " GET ATTACHMENTS");
                      if (!util.isnull(cr.attachments)) {
                        var n = cr.attachments.length;
                        //download card attachments to /tmp/dl
                        cr.attachments.forEach(function(attach, k) {
                          if (attach.url.match(/\.[0-9a-zA-Z]+$/))
                          {
                            //check if includable image
                            if (attach.url.match(/\.(png|jpe?g|eps)+/i))
                            {
                              var ur = tmp + "dl/" + attach.id + attach.url.match(/\.[0-9a-zA-Z]+$/)[0];
                              util.downloadfile(attach.url, ur, function(e) {
                                if (e)
                                {
                                  card.attachments.push({ filename: "dl/" + attach.id + attach.url.match(/\.[0-9a-zA-Z]+$/)[0],
                                                          name: attach.id, date: attach.date, ext: attach.url.match(/\.[0-9a-zA-Z]+$/)[0], isimage: true });
                                  //TODO make date user friendly
                                  console.log(card.attachments);

                                  //get card cover using cr.idAttachmentCover
                                  if (attach.id == cr.idAttachmentCover)
                                  { card.attachmentcover = { filename: "dl/" + attach.id + attach.url.match(/\.[0-9a-zA-Z]+$/)[0] }; }
                                  if (card.attachments.length == n) { cb(); }
                                }
                                else { n--; if (card.attachments.length == n) { cb(); } }
                              });
                            }
                            else
                            {
                              //not an image, don't download but add to list
                              card.attachments.push({ filename: null, name: attach.name, date: attach.date, ext: attach.url.match(/\.[0-9a-zA-Z]+$/)[0], isimage: false });
                              console.log(card.attachments);
                              if (card.attachments.length == n) { cb(); }
                            }
                          } else { n--; if (card.attachments.length == n) { cb(); } }
                        });
                        if (cr.attachments.length == 0) { cb(); }
                      } else { cb(); }
                    },
                    function sort(cb) {
                      //TODO sort cards by loc
                      console.log(i + " " + j + " SORT!");
                      if (!util.isnull(list.cards) && list.cards.length > 0) { list.cards = list.cards.sortByProp('pos'); }
                      if (!util.isnull(list.checklists) && list.checklists.length > 0) { list.checklists = list.checklists.sortByProp('pos'); }
                      cb();

                      //TODO sort checklists and checkitems by loc
                    },
                    function push(cb) {
                      console.log(i + " " + j + " PUSH!");
                      list.cards.push(card);
                      board = util.updateprogress(JSON.stringify(board), ((++cur)/max*45) + 5);
                      if (list.cards.length == li.cards.length) { b.lists.push(list); }
                      if (b.lists.length == raw.lists.length) { listcallback(); }
                      cb();
                    }
                  ]);
                });
              });

              if (li.cards.length == 0) { b.lists.push(list); }
              if ((b.lists.length == raw.lists.length) && (li.cards.length == 0)) { listcallback(); }
            });
          });
        });
      },
      function sort(cb) {
        //TODO sort lists by loc
        console.log("SORT LISTS");
        b.lists = b.lists.sortByProp('pos');
        cb();
      },
      function getotherdata(cb) {
        console.log("GET OTHER!");
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
        board = util.updateprogress(JSON.stringify(board), 50);
        cb();
      },
      function gettemplate(cb) {
        console.log("--------- GET TEMPLATES");
        //FIXME copy template files -> temp

        fs.readdir(templatedir, function (e, files) {
          var i = 0;
          var max = files.length;
          files.forEach(function(file) {
            if (!file.match(/(template.yml|template.tex|.pdf|.aux|.synctex.gz|.out|.log)$/)) {
              //file is not the YML file or some annoying LaTeX junk -> copy
              console.log("----- COPY: " + file);
              fs.readFile(templatedir + file, function(e, data) {
                fs.writeFile(tmp + file, data, function() {
                  board = util.updateprogress(JSON.stringify(board), (i/max)*10+50);
                  if (++i == max) { cb(); }
                });
              });
            } else {
              max--; board = util.updateprogress(JSON.stringify(board), (i/max)*10+50);
              if (i == max) { cb(); }
            }
          });
        });
      },
      function muparse(cb) {
        //FIXME first get all \input and if no '\', then replace with <!< > - MU_TEX NEEDS TO TAKE CARE OF THIS
        //parse with Mustache
        console.log("MUSTACHE PARSE!");

        var view = { };
        view = { b: b };
        //copy user data to view
        Object.keys(u).forEach(function(key) {
          var val = u[key];
          if (!key.match(/^_/)) {
            //avoid anything internal (starts with underscore)
            if(!(val === Object(val))) {
              //copy data as it doesn't appear to be JSON (user data)
              view[key] = val;
            }
          }
        });

        mu.clearCache();
        mu.root = templatedir;
        fs.exists(templatedir + "template.tex", function (exist) {
          if (exist) {
            mu.compileAndRender("template.tex", view)
            .on('data', function(data) {
              fs.appendFile(tmp + "template.tex", data, { flag: "a+" }, function() {
//                console.log("GET DATA");
//                console.log(data.toString());
              });
            })
            .on('end', function() {
              board = util.updateprogress(JSON.stringify(board), 70);
              cb();
            });
          } else { console.log("NO EXIST!"); }
          //TODO give an error somewhere
        });

      },
//      function compilelatex(cb) {
//        //FIXME compile LaTeX
//        console.log("----------------------COMPILE LATEX!---------------------------------------------------------------------------------------------------------------------------");
//        pdflatex = exec('pdflatex -synctex=1 interaction=nonstopmode "template".tex', { cwd: tmp });
//        console.log(pdflatex);
//
////        , function(error, stdout, stderr) {
////          stdout.on('data', function (data) {
////            console.log(data.toString());
////          });
////          stderr.on('data', function (data) {
////            console.error(data.toString());
////            //TODO log this somewhere
////            //FIXME add logging
////          });
////        .on('exit', function (code, signal) {
////          console.log("Process exited with " + code);
////          if (code != 0) {
////            //TODO throw some error
////          }
////          else {
////            board = util.updateprogress(JSON.stringify(board), 90);
////            cb();
////          }
////        });
//      },
      function publish(cb) {
        //FIXME clean
        //FIXME copy PDF, LaTeX, and log
//        fs.rename(tmp + "template.pdf", "tmp/" + board.id + ".pdf", function() {
          fs.rename(tmp + "template.tex", "tmp/" + board.id + ".tex", function() {
            fs.rename(tmp + "template.log", "tmp/" + board.id + ".log", function() {
              cb();
              //FIXME temporary - not removing files
//            rmrf(tmp, function() {
//              board = util.updateprogress(JSON.stringify(board), 95);
//              cb();
//            });
            });
          });
//        });
      },
      function finish(cb) {
        //FIXME flush progress
        //FIXME continue with queue

        board = util.updateprogress(JSON.stringify(board), 100);
        cb();
      },
      function moveboard(cb) {
        svr.stache.building = null;
        svr.stache.built.push(board);
        svr.emitter.emit('updatestatus', board);
      }
    ]);
  });
};
