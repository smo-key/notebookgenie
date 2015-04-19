var util = require("./util.js");
var async = require('async');
var fs = require("fs");
var rmrf = require("rimraf");
var mu = require('mutex'); //NOTE change name to mu_tex
var yazl = new require('yazl');
var spawn = require('child_process').spawn;

/*** FUNCTIONS ***/
var multiplicand = 75; //start creating pdf at five plus this

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
    //console.log(data.toString());
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

/*** BOARD COMPILER ***/

exports.preparefs1 = function(tmp, cb) {
  //TODO use rimraf for rmrf!
  fs.exists("tmp/", function(exists) {
    if (!exists)
    {
      fs.mkdir("tmp/", function() { cb(); });
    }
    else { cb(); }
  });
}

exports.preparefs2 = function(tmp, cb) {
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
}

exports.preparefs3 = function(tmp, board, b, cb) {
  fs.mkdir(tmp + "img", function() {
    fs.mkdir(tmp + "dl", function() {
      board = util.updateprogress(JSON.stringify(board), 5);
      cb(b, board);
    });
  });
}

exports.getmembers = function(tmp, board, b, raw, cb) {
  //***** Create LaTeX-Usable JSON Cache *****//
  //get members data
  b.members = [ ];

  //TODO error catching (and onward error catching as well)
  async.each(raw.members, function(member, cbmember) {
    var mem = { };
    //get image for each member -> b.members.avatar
    if (!util.isnull(member.avatarHash))
    {
      util.downloadfile("https://trello-avatars.s3.amazonaws.com/" + member.avatarHash + "/170.png", tmp + "img/" + member.id + ".png", function(e) {
        mem.avatar = !e ? null : "img/" + member.id + ".png";
        //get name for each member -> b.members.name
        mem.name = member.fullName;
        //get initials -> b.members.initials
        mem.initials = member.initials;
        mem.url = member.url;
        mem.username = member.username;
        console.log("GET USER!");
        b.members.push(mem);
        cbmember();
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
      cbmember(b);
    }
  }, function(e) { console.log(e); cb(b, board); });
}

exports.getlists = function(tmp, board, b, odata, u, raw, isselect, listcallback) {
  console.log("GET LISTS");
  b.lists = [ ];
  var iint = 0;
  var cur = 0;
  var max = raw.lists.length;
  if (!isselect)
  {
    console.log("NOT BEING SELECTIVE!");
    //get lists and their cards, checklists, etc.
    async.each(raw.lists, function(l, cardcallback) {
      util.trello("/lists/" + l.id + "?cards=open", board.auth, odata, function(e, li) {
        //get list
        var i = iint;
        ++iint;
        var list = { };
        list.cards = [ ];
        list.name = li.name;
        list.pos = li.pos;
        list.autoselect = false;

        //get all cards in list
        var j = 0;
        async.each(li.cards, function(c, cb4) {
          buildcard(c, board, odata, u, i, j++, function(card, k) {
            console.log(card);
            console.log(i + " " + k + " " + c.id + " PUSH!");
            list.cards.push(card);
            cb4();
          });
        }, function(err1) {
          sortlist(i, list, function(list) {
            board = util.updateprogress(JSON.stringify(board), ((++cur)/max*multiplicand) + 5);
            console.log("DONE WITH LIST " + l.id);
            b.lists.push(list);
            cardcallback();
          });
        });
      });
    },
    function(err2) {
      console.log("DONE WITH BOARD!");
      listcallback(b, board);
    });
  }
//        else {
//          console.log("BEING SELECTIVE!");
//          //selecting cards now by cardlist
//          var list = { };
//          list.cards = [ ];
//          list.name = "Cards";
//          list.autoselect = true;
//          list.pos = 1;
//          var max = cardlist.length;
//          var cur = 0;
//          async.eachSeries(cardlist, function(cid, cb) {
//            //FUTURE test if type is by URL or UID
//            util.trello("/cards/" + cid, board.auth, odata, function(e, c) {
//              buildcard(c, board, odata, u, function(card) {
//                list.cards.push(card);
//                board = util.updateprogress(JSON.stringify(board), ((++cur)/max*multiplicand) + 5);
//                cb();
//              });
//            });
//          }, function(done) {
//            b.lists.push(list);
//            listcallback();
//          });
//        }
}

exports.sortlists = function(b, cb) {
  //TODO sort lists by loc
  console.log("SORT LISTS");
  b.lists = b.lists.sortByProp('pos');
  cb(b);
}

exports.getotherdata = function(b, raw, board, cb) {
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

  cb(b);
}

exports.flushprogress = function(b, board, cb) {
  console.log("GET B!");
  console.log(b);
  board = util.updateprogress(JSON.stringify(board), multiplicand);
  cb(b, board);
}

exports.gettemplate = function(tmp, board, b, templatedir, cb) {
  console.log("--------- GET TEMPLATES");
  //FIXME copy template files -> temp

  fs.readdir(templatedir, function (e, files) {
    var i = 0;
    var max = files.length;
    async.each(files, function(file, cbfile) {
      if (!file.match(/(.yml|template.tex|.pdf|.aux|.synctex.gz|.out|.log|dl|img)$/)) {
        //file is not the YML file or some annoying LaTeX junk -> copy
        console.log("----- COPY: " + file);
        fs.readFile(templatedir + file, function(e, data) {
          fs.writeFile(tmp + file, data, function() {
            board = util.updateprogress(JSON.stringify(board), (i/max)*5+multiplicand);
            cbfile();
          });
        });
      } else {
        max--; board = util.updateprogress(JSON.stringify(board), (i/max)*5+multiplicand);
        cbfile();
      }
    }, function() {
      cb(b, board);
    });
  });
}

exports.muparse = function(b, u, templatedir, tmp, board, cb) {
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
          cb(b, board);
        });
      } catch (e) {
        //FIXME error handling to user
        console.error(e.stack);
        return;
      }
    } else { console.log("NO EXIST!"); }
    //TODO give an error somewhere
  });

}

exports.compilelatex = function(tmp, board, cb) {
  //compile LaTeX
  compilepass(1, 3, tmp, function(code, err) {
    board = util.updateprogress(JSON.stringify(board), 90);
    cb(board);
  });
}

exports.archive = function(tmp, board, cb) {
  console.log("ZIPPING!");
  zipdir(tmp, "", new yazl.ZipFile(), function(zip) {
    zip.end(function() {
      zip.outputStream.pipe(fs.createWriteStream("tmp/" + board.id + ".zip")).on("close", function(done) {
        console.log("DONE WRITING ZIP!");
        board = util.updateprogress(JSON.stringify(board), 99);
        cb(board);
      });
    });
  });
}

exports.publish = function(tmp, board, cb) {
  //copy PDF, LaTeX, and log
  fs.rename(tmp + "template.pdf", "tmp/" + board.id + ".pdf", function() {
    fs.rename(tmp + "template.tex", "tmp/" + board.id + ".tex", function() {
      fs.rename(tmp + "template.log", "tmp/" + board.id + ".log", function() {
        //FIXME clean
        rmrf(tmp, function() {
          cb(board);
        });
      });
    });
  });
}


/*** CARD COMPILER ***/

function buildcard(c, board, odata, u, i, j, finalcallback) {
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

    //cr.labels.forEach(function(label) {
      //TODO is some LaTeX-friendly parsing missing here?
    //});
    card.attachments = [ ];
    card.attachmentcover = null;
    console.log(i + " " + j + " BEGIN CARD GET!");

    getmembers(c, u, i, j, card, cr, function(card) {
    getvotes(c, u, i, j, card, cr, function(card) {
      console.log(i + " " + j + " NOW GETTING CHECKLISTS!");
    getchecklists(c, u, i, j, card, cr, function(card) {
      console.log(i + " " + j + " NOW GETTING ATTACHMENTS!");
    getattachments(c, u, i, j, card, cr, tmp, function(card) {
    getcomments(c, u, i, j, card, cr, function(card) {
      console.log(i + " " + j + " CARD DONE!"); finalcallback(card, j);
    });});});});});
  });
}

function getmembers(c, u, i, j, card, cr, cb) {
  //get members
  card.members = [ ];
  console.log(i + " " + j + " GET CHECKLISTS");
  if (!util.isnull(cr.members)) {
    cr.members.forEach(function(m, k) {
      card.members.push({ avatar: "img/" + m.id + ".png", name: m.fullName, initials: m.initials, username: m.username, url: m.url });
      if (card.members.length == cr.members.length) { cb(card); }
    });
    if (cr.members.length == 0) { cb(card); }
  } else { cb(card); }
}

function getvotes(c, u, i, j, card, cr, cb) {
  //get votes
  console.log(i + " " + j + " GET VOTES");
  if (!util.isnull(cr.membersVoted)) {
  card.votecount = cr.membersVoted.length;
    card.voters = [ ];
    cr.membersVoted.forEach(function(m, k) {
      card.voters.push({ avatar: "img/" + m.id + ".png", name: m.fullName, initials: m.initials, username: m.username, url: m.url });
      if (card.voters.length == cr.membersVoted.length) { cb(card); }
    });
    if (cr.membersVoted.length == 0) { cb(card); }
  } else { cb(card); }
}

function getchecklists(c, u, i, j, card, cr, cb) {
  //get checklists
  card.checklists = [ ];
  console.log(i + " " + j + " GET CHECKLISTS");
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
  }, function() { if(u.reverseorder == 'true') { card.checklists = card.checklists.reverse(); } cb(card); });
}

function getattachments(c, u, i, j, card, cr, tmp, cb) {
  //download card attachments to /tmp/dl
  console.log(i + " " + j + " GET ATTACHMENTS");
  var count = cr.attachments.length;
  var done = 0;
  async.each(cr.attachments, function(attach, cbattach) {
    if (attach.url.match(/\.[0-9a-zA-Z]+$/))
    {
      //check if includable image
      if (attach.url.match(/\.(png|jpe?g|eps)+/i))
      {
        var ur = tmp + "dl/" + attach.id + attach.url.match(/\.[0-9a-z]+$/i)[0].toLowerCase();
        console.log(i + " " + j + " ATTACHMENT: START DOWNLOAD - " + attach.id);
        util.downloadfile(attach.url, ur, function(e) {
          console.log(i + " " + j + " ATTACHMENT: FINISH DOWNLOAD - " + attach.id);
          if (e)
          {
            var caption = attach.name.match(/^(.*.(?=\.)|(.*))/)[0]; //get filename, just filename
            console.log(i + " " + j + " ATTACHMENT: GET ATTACHMENT - " + attach.id);
              card.attachments.push({ filename: "dl/" + attach.id + attach.url.match(/\.[0-9a-zA-Z]+$/)[0],
                                      name: attach.id, date: util.converttime(attach.date), ext: attach.url.match(/\.[0-9a-zA-Z]+$/)[0], isimage: true,
                                      friendlyname: caption, id: attach.id });
              console.log(card.attachments);
              cbattach();

            //get caption, if existing
//                    async.each(Object.keys(u.captionlist), function(key, cb1) {
//                      //if (u.captionlist.hasOwnProperty(key)) {
//                        if (key == attach.id) { caption = u.captionlist[key]; cb1(); }
//                        else { cb1(); }
//                      //} else { cb1(); }
//                    }, function(done) {

              //get card cover using cr.idAttachmentCover
//                      if (attach.id == cr.idAttachmentCover)
//                      {
//                        console.log(i + " " + j + " ATTACHMENT: GET COVER - " + attach.id);
//                        card.attachmentcover = { filename: "dl/" + attach.id + attach.url.match(/\.[0-9a-zA-Z]+$/)[0],
//                                              name: attach.id, date: util.converttime(attach.date), ext: attach.url.match(/\.[0-9a-zA-Z]+$/)[0], isimage: true,
//                                              friendlyname: caption, id: attach.id };
//                        cbattach(); console.log(i + " " + j + " EXIT 5");
//                      } else { cbattach(); console.log(i + " " + j + " EXIT 4"); }
            //});
          }
          else { cbattach(); console.log(i + " " + j + " EXIT 3"); }
        });
      }
      else
      {
        //not an image, don't download but add to list
        card.attachments.push({ filename: null, name: attach.id, date: attach.date, ext: attach.url.match(/\.[0-9a-zA-Z]+$/)[0], isimage: false,
                                friendlyname: attach.name.match(/^(.*.(?=\.)|(.*))/)[0], id: attach.id });
        cbattach();
        console.log(i + " " + j + " EXIT 2");
      }
    } else { cbattach(); console.log(i + " " + j + " EXIT 1"); }
  }, function(dne) {
    console.log(i + " " + j + " ATTACHMENT: DONE GETTING! " + cr.attachments.length + " " + card.attachments.length);
    cb(card);
    //compiler.getcomments(c, u, i, j, card, cr, c function(card1) {
    //  card = card1;
    //
    //});
  });
}

function getcomments(c, u, i, j, card, cr, cb) {
  //get actions
  card.comments = [ ];
  console.log(i + " " + j + " GET COMMENTS");
  async.eachSeries(cr.actions, function(act, cb1) {
    var action = { };

    action.iscomment = (act.type == 'commentCard');
    action.isattachment = (act.type == 'addAttachmentToCard');
    action.isdeleteattachment = (act.type == 'deleteAttachmentFromCard');
    if ((action.isdeleteattachment || action.isattachment) && (act.data.attachment.id == cr.idAttachmentCover))
    {
      //ignore covers if they are an attachment
      console.log(i + " " + j + " COMMENT: IGNORE CARD COVER - " + act.data.attachment.id);
      cb1();
    }
    else if (action.isdeleteattachment)
    {
      //TODO remove attachment from comment list if it was removed from card OR is cover (ignore covers)
      console.log(i + " " + j + " COMMENT: GET DELETE ATTACHMENT - " + act.data.attachment.id);
      cb1();
    }
    else
    {
      //add attachment as comment if it was added to the card
      if (action.isattachment) {
        console.log(i + " " + j + " COMMENT: GET ATTACHMENT FINAL - " + act.data.attachment.id);
        async.each(card.attachments, function(attach, cb2) {
          if (attach.id == act.data.attachment.id)
          {
            //we have equal IDs - add attachment object into action
            action.attachment = attach;
            console.log(i + " " + j + " COMMENT: FOUND ATTACHMENT IN OBJECT! - " + act.data.attachment.id);
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
    if(u.reverseorder == 'true') { card.comments = card.comments.reverse(); cb(card); }
    else { cb(card); }
  });
}

/*** LIST COMPILER ***/

function sortlist(i, list, cb) {
  console.log(i + " SORT LIST!");
  if (!util.isnull(list.cards) && list.cards.length > 0) { list.cards = list.cards.sortByProp('pos'); }
  if (!util.isnull(list.checklists) && list.checklists.length > 0) { list.checklists = list.checklists.sortByProp('pos'); }
  cb(list);
}
