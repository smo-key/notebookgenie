var util = require("./util.js");
var svr = require("../server.js");
var flow = require('nimble');
var fs = require("fs");
var rmrf = require("rimraf");
var async = require('async');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var execSync = require('child_process').execSync;
var mu = require('mutex'); //NOTE change name to mu_tex
var yazl = new require('yazl');

var multiplicand = 75; //start creating pdf at five plus this

Array.prototype.sortByProp = function(p){
  return this.sort(function(a,b){
    return (a[p] > b[p]) ? 1 : (a[p] < b[p]) ? -1 : 0;
  });
};

function buildcard(c, board, odata, u, finalcallback) {
  //TODO allow template to set the action limit
  var tmp = "tmp/" + board.id + "/";
  
  util.trello("/cards/" + c.id + "?actions=commentCard,addAttachmentToCard,deleteAttachmentFromCard&actions_limit=1000&action_memberCreator_fields=fullName,initials,username,url&attachments=true&membersVoted=true&membersVoted_fields=fullName,initials,username,url&checklists=all&members=true&member_fields=fullName,initials,username,url", board.auth, odata, function(e, cr) {
    //get card
    var card = { };
    card.name = cr.name;
    card.desc = cr.desc.trim();
    card.lastmodified = cr.dateLastActivity;
    card.due = util.converttime(cr.due); //TODO friendly time format
    card.pos = cr.pos;
    card.url = cr.url;
    console.log(cr);
    try
    {
      cr.labels.forEach(function(label) {
        //TODO is some LaTeX-friendly parsing missing here?
      });
      card.attachments = [ ];
      card.attachmentcover = null;

      async.series([
        function getmembers(cb) {
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
        function getvotes(cb) {
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
          //get checklists
          card.checklists = [ ];
          async.eachSeries(cr.checklists, function(c, cb1) {
            var items = [ ];

            async.eachSeries(c.checkItems, function(item, cb2) {
              if (item.state == "incomplete") { var checked = false; } else { var checked = true; }
              var it = { name: item.name, pos: item.pos, checked: checked };
              items.push(it);
              cb2();
            }, function() {
              card.checklists.push({ name: c.name, pos: c.pos, items: items.sortByProp('pos') });
              cb1();
            });
          }, function() { if(u.reverseorder == 'true') { card.checklists = card.checklists.reverse(); } cb(); });
          if (util.isnull(cr.checklists)) { console.log("NO CHECKLISTS!"); cb(); }
        },
        function getattachments(cb) {
          if (!util.isnull(cr.attachments)) {
            var n = cr.attachments.length;
            //download card attachments to /tmp/dl
            cr.attachments.forEach(function(attach, k) {
              if (attach.url.match(/\.[0-9a-zA-Z]+$/))
              {
                //check if includable image
                if (attach.url.match(/\.(png|jpe?g|eps)+/i))
                {
                  var ur = tmp + "dl/" + attach.id + attach.url.match(/\.[0-9a-z]+$/i)[0].toLowerCase();
                  util.downloadfile(attach.url, ur, function(e) {
                    if (e)
                    {
                      var caption = attach.name;
                      async.each(Object.keys(u.captionlist), function(key, cb1) {
                        //if (u.captionlist.hasOwnProperty(key)) {
                          if (key == attach.id) { caption = u.captionlist[key]; cb1(); }
                          else { cb1(); }
                        //} else { cb1(); }
                      }, function(done) {
                        console.log("GET REMAINDER OF ATTACHMENT!--------------");
                        card.attachments.push({ filename: "dl/" + attach.id + attach.url.match(/\.[0-9a-zA-Z]+$/)[0],
                                                name: attach.id, date: util.converttime(attach.date), ext: attach.url.match(/\.[0-9a-zA-Z]+$/)[0], isimage: true,
                                                friendlyname: caption, id: attach.id });
                        console.log(card.attachments);

                        //get card cover using cr.idAttachmentCover
                        if (attach.id == cr.idAttachmentCover)
                        { console.log("GET CARD ATTACHMENT!!!!-----------------------"); card.attachmentcover = { filename: "dl/" + attach.id + attach.url.match(/\.[0-9a-zA-Z]+$/)[0],
                                                name: attach.id, date: util.converttime(attach.date), ext: attach.url.match(/\.[0-9a-zA-Z]+$/)[0], isimage: true,
                                                friendlyname: caption, id: attach.id }; }
                        if (card.attachments.length == n) { cb(); }
                      });
                    }
                    else { n--; if (card.attachments.length == n) { cb(); } }
                  });
                }
                else
                {
                  //not an image, don't download but add to list
                  card.attachments.push({ filename: null, name: attach.id, date: attach.date, ext: attach.url.match(/\.[0-9a-zA-Z]+$/)[0], isimage: false,
                                          friendlyname: attach.name, id: attach.id });
                  console.log(card.attachments);
                  if (card.attachments.length == n) { cb(); }
                }
              } else { n--; if (card.attachments.length == n) { cb(); } }
            });
            if (cr.attachments.length == 0) { cb(); }
          } else { cb(); }
        },
        function getcomments(cb) {
          //get actions
          card.comments = [ ];
          async.eachSeries(cr.actions, function(act, cb1) {
            var action = { };

            action.iscomment = (act.type == 'commentCard');
            action.isattachment = (act.type == 'addAttachmentToCard');
            action.isdeleteattachment = (act.type == 'deleteAttachmentFromCard');
            if ((action.isdeleteattachment || action.isattachment) && (act.data.attachment.id == cr.idAttachmentCover))
            {
              //ignore covers if they are an attachment
              console.log("IGNORE SUPER GIANT ATTACHMENT THINGY!------------------------------");
              cb1();
            }
            else if (action.isdeleteattachment)
            {
              //TODO remove attachment from comment list if it was removed from card OR is cover (ignore covers)
              console.log("GET DELETE ATTACHMENT THINGY!------------------------------");
              cb1();
            }
            else
            {
              //add attachment as comment if it was added to the card
              if (action.isattachment) {
                console.log(act);
                console.log("GET GIANT ATTACHMENT THINGY! ------------------------------");
                console.log(act.data.attachment.id);
                async.each(card.attachments, function(attach, cb2) {
                  if (attach.id == act.data.attachment.id)
                  {
                    //we have equal IDs - add attachment object into action
                    action.attachment = attach;
                    console.log("WE HAVE EQUAL ATTACHMENTS!--------------------------");
                    cb2();
                  }
                  else { cb2(); }
                }, function(done) {
                  //get remaining information, applies to both attachments and comments
                  action.text = act.data.text;
                  action.date = util.converttime(act.date);
                  action.author = { };
                  action.author.id = act.memberCreator.id;
                  action.author.avatar = "img/" + act.memberCreator.id + ".png";
                  action.author.name = act.memberCreator.fullName;
                  action.author.initials = act.memberCreator.initials;
                  action.author.username = act.memberCreator.username;
                  action.author.url = act.memberCreator.url;
                  card.comments.push(action);
                  cb1();
                });
              }
              else {
                //get remaining information, applies to both attachments and comments
                action.text = act.data.text;
                action.date = util.converttime(act.date);
                action.author = { };
                action.author.id = act.memberCreator.id;
                action.author.avatar = "img/" + act.memberCreator.id + ".png";
                action.author.name = act.memberCreator.fullName;
                action.author.initials = act.memberCreator.initials;
                action.author.username = act.memberCreator.username;
                action.author.url = act.memberCreator.url;
                card.comments.push(action);
                cb1();
              }
            }
          }, function(done) {
            if(u.reverseorder == 'true') { card.comments = card.comments.reverse(); }
            cb();
          });
          //if (cr.actions.length == 0) {  }
        },
        function done(cb) { finalcallback(card); cb(); }
      ]);
    } catch (e)
    {
      console.error(e.stack);
      //throw e
      return;
    }
  });
}


function zipdir(dir, base, zipfile, cb) {
  fs.readdir(dir, function(err, files) {
    async.eachSeries(files, function(file, callback) {
      fs.stat(dir + file, function(er, stats) {
        if (stats.isFile()) {
          zipfile.addFile(dir + file, base + file);
          callback();
        }
        if (stats.isDirectory())
        {
          zipdir(dir + file + '/', base + file + '/', zipfile, function(z) {
            zipfile = z;
            callback();
          });
        }
      });
    }, function(done) {
      cb(zipfile);
    });
  });
}


function compilepass(pass, passes, tmp, cb) {
  console.log("COMPILE LATEX PASS " + pass + "! ---------");
  var pdflatex = spawn('pdflatex', ['-synctex=1', '-interaction=nonstopmode', '"template".tex'], { cwd: tmp });

  pdflatex.stdout.on('data', function (data) {
    console.log(data.toString());
  });

  pdflatex.on('close', function (code) {
    console.log('LATEX COMPILE PASS ' + pass + ' COMPLETE - exited with code ' + code);
    if (code > 1) {
      cb(code, true); //return as an error
      return;
    }
    else
    {
      pass++;
      if (pass > passes) { cb(code, false); return; } //return ok
      else { compilepass(pass, passes, tmp, cb); return; } //recursivize
    }
  });
}


exports.startbuild = function startbuild(board, u, odata, cardlist) {
  //create user preferences array
  //add YAML template data
  u = JSON.parse(u);
  //parse captions data
  var lines = u.captions.split(/\r?\n/);
  console.log(lines);
  u.captionlist = { };
  lines.forEach(function(line) {
    var id = line.split(/ /i)[0];
    var caption = line.substring(id.length + 1);
    u.captionlist[id] = caption;
  });

  console.log(u);
  //oauth data
  odata = JSON.parse(odata);
  //complete credential verification - DONE in board
  board = JSON.parse(board);
  console.log(board);
  //download JSON -> raw
  svr.emitter.emit('updatestatus', board);
  util.trello("/boards/" + board.uid + "?lists=open&cards=open&members=all&member_fields=all&organization=true&organization_fields=all&fields=all", board.auth, odata, function(e, raw) {

    //create JSON array to store board information for LaTeX -> b
    var b = { };
    //create temp folder
    var tmp = "tmp/" + board.id + "/";
    var templatedir = "templates/" + board.template + "/";

    cardlist = JSON.parse(cardlist);

    var isselect = !(cardlist.length == 0);

    console.log(board);
    console.log(board.uid);

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
        b.lists = [ ];
        if (!isselect)
        {
          //get lists and their cards, checklists, etc.
          raw.lists.forEach(function(l, i) {
            util.trello("/lists/" + l.id + "?cards=open", board.auth, odata, function(e, li) {
              //get list
              var list = { };
              list.cards = [ ];
              list.name = li.name;
              list.pos = li.pos;
              list.autoselect = false;

              li.cards.forEach(function(c, j) {
                buildcard(c, board, odata, u, function(card) {
                  flow.series([
                    function sort(cb) {
                      //sort cards by position
                      console.log(i + " " + j + " SORT!");
                      if (!util.isnull(list.cards) && list.cards.length > 0) { list.cards = list.cards.sortByProp('pos'); }
                      if (!util.isnull(list.checklists) && list.checklists.length > 0) { list.checklists = list.checklists.sortByProp('pos'); }
                      cb();
                    },
                    function push(cb) {
                      console.log(i + " " + j + " PUSH!");
                      list.cards.push(card);
                      board = util.updateprogress(JSON.stringify(board), ((++cur)/max*multiplicand) + 5);
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
        } else {
          console.log("BEING SELECTIVE!");
          //selecting cards now by cardlist
          var list = { };
          list.cards = [ ];
          list.name = "Cards";
          list.autoselect = true;
          list.pos = 1;
          var max = cardlist.length;
          var cur = 0;
          async.eachSeries(cardlist, function(cid, cb) {
            //FUTURE test if type is by URL or UID
            util.trello("/cards/" + cid, board.auth, odata, function(e, c) {
              buildcard(c, board, odata, u, function(card) {
                list.cards.push(card);
                board = util.updateprogress(JSON.stringify(board), ((++cur)/max*multiplicand) + 5);
                cb();
              });
            });
          }, function(done) {
            b.lists.push(list);
            listcallback();
          });
        }
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
        b.lastmodified = util.converttime(raw.dateLastActivity); //TODO make this from ISO -> human readable

        //TODO get additional data from org (image, etc.)

        cb();
      },
      function flushprogress(cb) {
        console.log("GET B!");
        console.log(b);
        board = util.updateprogress(JSON.stringify(board), multiplicand);
        cb();
      },
      function gettemplate(cb) {
        console.log("--------- GET TEMPLATES");
        //FIXME copy template files -> temp

        fs.readdir(templatedir, function (e, files) {
          var i = 0;
          var max = files.length;
          files.forEach(function(file) {
            if (!file.match(/(.yml|template.tex|.pdf|.aux|.synctex.gz|.out|.log|dl|img)$/)) {
              //file is not the YML file or some annoying LaTeX junk -> copy
              console.log("----- COPY: " + file);
              fs.readFile(templatedir + file, function(e, data) {
                fs.writeFile(tmp + file, data, function() {
                  board = util.updateprogress(JSON.stringify(board), (i/max)*5+multiplicand);
                  if (++i == max) { cb(); }
                });
              });
            } else {
              max--; board = util.updateprogress(JSON.stringify(board), (i/max)*5+multiplicand);
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
            var file = fs.createWriteStream(__dirname + "/../" + tmp + "template.tex", { flags: 'a+', end: false });
            try
            {
              var stream = mu.compileAndRender("template.tex", view);
              stream.pipe(file, { end: false });
              file.on('error', function(err) {
                throw err;
              });

              stream.on('end', function() {
                board = util.updateprogress(JSON.stringify(board), multiplicand + 5);
                cb();
              });
            } catch (e) {
              //FIXME error handling to user
              console.error(e.stack);
              return;
            }
          } else { console.log("NO EXIST!"); }
          //TODO give an error somewhere
        });

      },
      function compilelatex(cb) {
        //compile LaTeX
        compilepass(1, 3, tmp, function(code, err) {
          board = util.updateprogress(JSON.stringify(board), 90);
          cb();
        });
      },
      function archive(cb) {
        console.log("ZIPPING!");
        zipdir(tmp, "", new yazl.ZipFile(), function(zip) {
          zip.end(function() {
            zip.outputStream.pipe(fs.createWriteStream("tmp/" + board.id + ".zip")).on("close", function(done) {
              console.log("DONE WRITING ZIP!");
              board = util.updateprogress(JSON.stringify(board), 99);
              cb();
            });
          });
        });
      },
      function publish(cb) {
        //copy PDF, LaTeX, and log
        fs.rename(tmp + "template.pdf", "tmp/" + board.id + ".pdf", function() {
          fs.rename(tmp + "template.tex", "tmp/" + board.id + ".tex", function() {
            fs.rename(tmp + "template.log", "tmp/" + board.id + ".log", function() {
              //FIXME clean
//              rmrf(tmp, function() {
//                cb();
//              });
              cb();
            });
          });
        });
      },
      function finish(cb) {
        //FIXME IMPORTANT continue with queue

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
