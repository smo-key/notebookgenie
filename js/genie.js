var util = require("./util.js");
var svr = require("../server.js");
var compiler = require('./t2lcompiler.js');
var fibrous = require("fibrous");
var rmrf = require("rimraf");
var fs = require("fs");
var util = require("./util.js");
var yazl = new require('yazl');
var async = require("async");
var s = require("string");
var Future = require("fibers/future");

exports.startbuild = function startbuild(b, u, odata, cardlist) {
  fibrous.run(function() {
    build.sync(b, u, odata);
  }, function(err, done) {
    if (err) console.error(err.stack);
    console.log("[Genie] Done building board!");
  });
};

build = fibrous(function(b, u, odata) {
  //create user preferences array
  //add YAML template data
  u = JSON.parse(u);

  //console.log(u);
  //oauth data
  odata = JSON.parse(odata);
  //complete credential verification - DONE in board
  b = JSON.parse(b);
  svr.emitter.emit('updatestatus', b);

  var url = "/boards/" + b.uid +
  "?lists=open&cards=open" +
  "&members=all&member_fields=all" +
  "&organization=true&organization_fields=all" +
  "&actions=commentCard,addAttachmentToCard,deleteAttachmentFromCard&actions_limit=1000" +
  "&action_memberCreator_fields=fullName,initials,username,url" +
  "&card_attachments=true&card_checklists=all" +
  "&membersVoted=true&membersVoted_fields=fullName,initials,username,url" +
  "&fields=all";
  var raw = util.trello.sync(url, b.auth, odata);

  //create JSON array to store board information for LaTeX -> b
  var board = {};
  //create temp folder
  var tmp = "tmp/" + board.id + "/";
  var templatedir = "templates/" + board.template + "/dist/";

  //Prepare filesystem
  preparefs.sync(tmp, b);
  updateprogress(b, 3);
  console.log("[Genie] Filesystem ready!");

  //Get all members
  board = getmembers.sync(tmp, b, raw, board);
  updateprogress(b, 10);
  console.log("[Genie] Members list populated!")

  //Get all lists and their cards and data
  board = getlists.sync(tmp, b, raw, board, u, odata);
  updateprogress(b, 80);
  console.log("[Genie] Lists populated!")

  //console.log('\033c'); //Clear console to simplify
  //console.log(board);

  //Get all attachments
  //board = getattachments.sync(tmp, b, raw, board, u, odata);
  //updateprogress(b, 30);
});

function updateprogress(b, progress)
{
  if(progress > b.progress) { b.progress = progress;
  util.updateboard(JSON.stringify(b), function()
              { svr.emitter.emit('updateprogress'); }); }
  return b;
}

preparefs = fibrous(function(tmp)
{
  console.log("[Genie] Preparing filesystem...");
  if (!fs.existsSync("tmp/"))
    fs.mkdir.sync("tmp/");

  if (fs.existsSync(tmp))
    rmrf.sync(tmp);
  fs.mkdir.sync(tmp);

  fs.mkdir.sync(tmp + "img");
  fs.mkdir.sync(tmp + "dl");
});

getmembers = function(tmp, b, raw, board, cb)
{
  board.members = [ ];
  var futures = [ ];

  async.eachLimit(raw.members, 8, function(_member, callback)
  {
    console.log("Get member " + _member.fullName);
    var member = { };
    member.name = _member.fullName;
    member.initials = _member.initials;
    member.url = _member.url;
    member.username = _member.username;

    if (!util.isnull(_member.avatarHash))
    {
      //Get avatar
      var future = function(tmp, _member, member, cb)
      {
        util.downloadfile("https://trello-avatars.s3.amazonaws.com/"
        + _member.avatarHash + "/170.png", tmp + "img/" + _member.id + ".png", null, function(err)
        {
          if (err)
          {
            member.avatar = null;
            console.log("No avatar for member " + _member.fullName);
            board.members.push(member);
            cb(null, member);
          }
          else
          {
            member.avatar = "img/" + _member.id + ".png";
            console.log("Avatar downloaded for member " + _member.fullName);
            board.members.push(member);
            cb(null, member);
          }
        });
      };
      futures.push(future.future(tmp, _member, member));
    }
    else {
      member.avatar = null;
      console.log("No avatar for member " + _member.fullName);
    }
    callback();
  }, function(err) {
    if (err) console.error(err.stack);
    fibrous.wait(futures);
    cb(null, board);
  });
};

getlists = function(tmp, b, raw, board, u, odata, cb) {
  console.log("[Genie] Start getting lists...");
  board.lists = [ ];
  board.frontmatter = [ ];
  var max = raw.lists.length;
  var futurelists = [ ];

  async.eachLimit(raw.lists, 8, function(_list, cblist)
  {
    util.trello("/lists/" + _list.id + "?cards=open", b.auth, odata, function(e, _list)
    {
      if (e) console.error(e.stack);
      var future = Future.wrap(buildlist)(_list, tmp, b, u, odata);
      futurelists.push(future);
      cblist();
    });
  }, function(err)
  {
    fibrous.run(function()
    {
      if (err) console.error(err.stack);
      var data = fibrous.wait(futurelists);
      for (var i=0; i<data.length; i++)
      {
        if (!util.isnull(data[i]))
          board.lists.push(data[i]);
      }
    }, function(err1, result)
    {
      if (err1) console.error(err1.stack);
      cb(null, board);
    });
  });
};

buildlist = function(_list, tmp, b, u, odata, cbbuildlist)
{
  var list = { };
  var futurecards = [ ];
  list.cards = [ ];
  list.name = _list.name;
  list.pos = _list.pos;
  list.id = _list.id;
  //list.autoselect = false; //FIXME what is this?

  if (s(list.name).startsWith("!"))
  {
    cbbuildlist();
    return;
  }
  if (list.name.trim() == "NotebookGenie Front Matter" ||
    list.name.trim() == "Notebook Genie Front Matter")
  {
    //FIXME FRONT MATTER!
  }

  async.eachLimit(_list.cards, 8, function(_card, cbcard)
  {
    util.trello("/cards/" + _card.id + "?actions=commentCard,addAttachmentToCard,deleteAttachmentFromCard" +
    "&actions_limit=1000&action_memberCreator_fields=fullName,initials,username,url" +
    "&attachments=true&membersVoted=true" +
    "&membersVoted_fields=fullName,initials,username,url&checklists=all" +
    "&members=true&member_fields=fullName,initials,username,url",
    b.auth, odata, function(e, _card)
    {
      var future = Future.wrap(buildcard)(_card, tmp, b, u, list.name, odata);
      futurecards.push(future);
      cbcard();
    });
  }, function(err)
  {
    fibrous.run(function()
    {
      if (err) console.error(err.stack);
      var data = fibrous.wait(futurecards);
      for (var i=0; i<data.length; i++)
      {
        if (!util.isnull(data[i])) list.cards.push(data[i]);
      }
    }, function(err1, result)
    {
      cbbuildlist(null, list);
    });
  });
};

buildcard = fibrous(function(_card, tmp, b, u, listname, odata)
{
  var card = { };
  card.name = _card.name;

  if (s(card.name).startsWith("!")) return null;

  console.log("Starting card " + card.name);

  card.desc = util.mark(_card.desc.trim());
  card.lastmodified = _card.dateLastActivity;
  card.due = util.converttime(_card.due); //TODO friendly time format
  card.pos = _card.pos;
  card.url = _card.url;
  card.id = _card.id;
  card.list = { };
  card.list.id = _card.idList;
  card.list.name = listname;
  card.exists = { checklists: false, comments: false };
  card.attachments = [ ];
  card.attachmentcover = null;

  try {
    card = card_getmembers.sync(_card, card);
    card = card_getchecklists.sync(_card, card);
    card = card_getattachments.sync(_card, card, tmp);
    card = card_getcomments.sync(_card, card, tmp, u);

    console.log("Finished card " + card.name);
    console.log(card);

    return card;
  } catch (e) {
    console.error(e.stack);
    return null;
  }
});

card_getmembers = fibrous(function(_card, card)
{
  card.members = [ ];
  for (var i=0; i<_card.members.length;i++)
  {
    var _member = _card.members[i];
    card.members.push({avatar: "img/" + _member.id + ".png", name: _member.fullName,
     initials: _member.initials, username: _member.username, url: _member.url });
  }
  return card;
});

card_getchecklists = fibrous(function(_card, card)
{
  card.checklists = [ ];
  for (var i=0; i<_card.checklists.length;i++)
  {
    var items = [ ];
    var _checklist = _card.checklists[i];

    for (var j=0;j<_checklist.checkItems.length;j++)
    {
      var _item = _checklist.checkItems[j];
      if (_item.state == "incomplete") { var checked = false; } else { var checked = true; }
      var item = { name: _item.name, pos: _item.pos, checked: checked };
      items.push(item);
    }

    card.checklists.push({ name: _checklist.name, pos: _checklist.pos, items: items.sortByProp('pos') });
  }
  return card;
});

card_getattachments = fibrous(function(_card, card, tmp)
{
  card.attachments = [ ];
  var futures = [ ];
  for (var i=0; i<_card.attachments.length; i++)
  {
    var _attachment = _card.attachments[i];
    if (_attachment.url.match(/\.[0-9a-zA-Z]+$/))
    {
      var name = _attachment.name.match(/^(.*.(?=\.)|(.*))/)[0];
      var ext = _attachment.url.match(/\.[0-9a-z]+$/i)[0].toLowerCase();
      var filename = name + ext;
      var path = tmp + "dl/" + _attachment.id + ext;

      //check if includable image
      if (_attachment.url.match(/\.(png|jpe?g|svg|tiff|gif)+/i))
      {
        console.log("Starting download of " + filename);

        var future = Future.wrap(util.downloadfile)(_attachment.url, path, _attachment);
        futures.push(future);
      }
      else {
        //not an image, don't download but add to list
        card.attachments.push({ filename: null, name: _attachment.name, date: _attachment.date,
          ext: ext, isimage: false, id: _attachment.id });
      }
    }
  }

  var data = fibrous.wait(futures);
  console.log("Finished attachments for " + card.name);
  for (var i=0; i<data.length; i++)
  {
    if (util.isnull(data[i])) continue;
    var _attachment = data[i];
    var name = _attachment.name.match(/^(.*.(?=\.)|(.*))/)[0];
    var ext = _attachment.url.match(/\.[0-9a-z]+$/i)[0].toLowerCase();
    var filename = name + ext;
    var path = tmp + "dl/" + _attachment.id + ext;
    var attachment = { filename: "dl/" + _attachment.id + ext,
                       name: name, date: util.converttime(_attachment.date),
                       ext: ext, isimage: true, id: _attachment.id };
    if (_attachment.id == _card.idAttachmentCover)
      card.attachmentcover = attachment;
    card.attachments.push(attachment);
  }
  return card;
});

card_getcomments = fibrous(function(_card, card, tmp, u)
{
  card.comments = [ ];
  for (var i=0; i<_card.actions.length;i++)
  {
    var _action = _card.actions[i];
    var action = { };
    action.iscomment = (_action.type == 'commentCard');
    action.isattachment = (_action.type == 'addAttachmentToCard');
    action.isdeleteattachment = (_action.type == 'deleteAttachmentFromCard');

    if ((action.isdeleteattachment || action.isattachment) &&
    (_action.data.attachment.id == _card.idAttachmentCover))
    {
      //ignore covers if they are an attachment
      continue;
    }
    else if (action.isdeleteattachment)
    {
      //TODO remove attachment from comment list if it was removed from card OR is cover (ignore covers)
      continue;
    }
    else
    {
      if (action.isattachment) {
        for (var j=0;j<card.attachments.length;j++)
        {
          var attachment = card.attachments[j];
          if (attachment.id == _action.data.attachment.id)
          {
            action.attachment = attachment;
            break;
          }
        }
      }
      else {
        //Get comment info
        action.content = util.mark(_action.data.text);
        card.exists.comments = true;
      }

      //Add creator information
      var exists = fs.existsSync(tmp + "img/" + _action.memberCreator.id + ".png");
      action.date = util.converttime(_action.date);
      action.author = { };
      action.author.id = _action.memberCreator.id;
      action.author.avatar = exists ? "img/" + _action.memberCreator.id + ".png" : null;
      action.author.name = _action.memberCreator.fullName;
      action.author.initials = _action.memberCreator.initials;
      action.author.username = _action.memberCreator.username;
      action.author.url = _action.memberCreator.url;
      card.comments.push(action);
    }
  }

  if(u.reverseorder == 'true') { card.comments = card.comments.reverse(); }
  return card;
});
