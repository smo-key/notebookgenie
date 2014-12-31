var util = require("./util.js");
var svr = require("../server.js");
var flow = require('nimble');

exports.startbuild = function startbuild(board, raw, u, odata) {
  //complete credential verification - DONE in board
  board = JSON.parse(board);
  //download JSON -> raw - DONE given in raw
  raw = JSON.parse(raw);
  //user preferences from previous stage
  u = JSON.parse(u);
  odata = JSON.parse(odata);

  //create JSON array to store board information for LaTeX -> b
  var b = { };
  //create user preferences array -> u

  //***** Create LaTeX-Usable JSON Cache *****//
  console.log("RAW: " + raw);
  console.log("BOARD: " + board);
  console.log("U: " + u);
  console.log("ODATA: " + odata);
  //create image for each member -> b.members.image
  //get name for each member -> b.members.name
  //remaining data raw.members -> b.members
  //raw.shortLink -> b.id
  //raw.url -> b.url
  //raw.labelNames -> b.labels
  //raw.dateLastActivity -> b.lastmodified
  //raw.dateLastView -> b.lastviewed
  //raw.lists -> b.lists
  //raw.cards -> b.cards and send id to b.lists.cards
  //raw.checklists -> b.checklists and send id to b.lists.cards.checklists

  board.progress = 10;
  util.updateboard(JSON.stringify(board), function() {
    console.log("Board updated");
  });
};
