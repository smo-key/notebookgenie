var util = require("./util.js");
var svr = require("../server.js");
var flow = require('nimble');
var fs = require("fs");
var rmrf = require("rimraf");
var async = require('async');
var compiler = require('./t2lcompiler.js');

exports.startbuild = function startbuild(board, u, odata, cardlist) {
  //create user preferences array
  //add YAML template data
  u = JSON.parse(u);
  //parse captions data
  /*var lines = u.captions.split(/\r?\n/);
  console.log(lines);
  u.captionlist = { };
  lines.forEach(function(line) {
    var id = line.split(/ /i)[0];
    var caption = line.substring(id.length + 1);
    u.captionlist[id] = caption;
  });*/

  //console.log(u);
  //oauth data
  odata = JSON.parse(odata);
  //complete credential verification - DONE in board
  board = JSON.parse(board);
  //console.log(board);
  //download JSON -> raw
  svr.emitter.emit('updatestatus', board);
  util.trello("/boards/" + board.uid + "?lists=open&cards=open&members=all&member_fields=all&organization=true&organization_fields=all&fields=all", board.auth, odata, function(e, raw) {

    //create JSON array to store board information for LaTeX -> b
    var b = {};
    //create temp folder
    var tmp = "tmp/" + board.id + "/";
    var templatedir = "templates/" + board.template + "/dist/";

    cardlist = JSON.parse(cardlist);

    var isselect = (cardlist.length !== 0);

    //console.log(board);
    //console.log(board.uid);

    compiler.preparefs1(tmp, function() {
      compiler.preparefs2(tmp, function() {
        compiler.preparefs3(tmp, board, b, function(b, board) {
          compiler.getmembers(tmp, board, b, raw, function(b, board) {
            console.log("START GET ALL LISTS!");
            compiler.getlists(tmp, board, b, odata, u, raw, isselect, cardlist, function(b, board) {
              console.log("GOT ALL LISTS!!!");
              compiler.sortlists(b, function(b) {
                compiler.getotherdata(tmp, b, raw, board, function(b) {
                  compiler.flushprogress(b, board, function(b, board) {
                    compiler.gettemplate(tmp, board, b, templatedir, function(b, board) {
                      compiler.muparse(b, u, templatedir, tmp, board, function(b, board) {
                        compiler.compilehtml(tmp, board, function(board) {
                          compiler.archive(tmp, board, function(board) {
                            compiler.publish(tmp, board, function(board) {
                              console.log("ALL DONE!!!");
                              board = util.updateprogress(JSON.stringify(board), 100);
                              svr.stache.building = null;
                              svr.stache.built.push(board);
                              svr.emitter.emit('updatestatus', board);
                              //FIXME IMPORTANT continue with queue
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};
