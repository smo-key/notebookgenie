$(document).ready(function () {
  firstLoad();
  updateContainer();
  $(window).resize(function() {
    updateContainer();
  });
});

$('#buildprivate').click(function(){
  $('#buildboard').addClass("disabled");
  console.log(document.URL);
  $.ajax({
    url: '/ajax/getkey',
    type: 'POST',
    data: { url: $('#inputurl').val() },
    success: function(data) {
      $.ajax({
        url: "https://trello.com/1/authorize",
        type: 'GET',
        data: { callback_method: postMessage, return_url: document.URL, scope: "read", expiration: "1hour", name: data.appname, key: data.key },
        success: function(json) {
          //authentication successful - send this json back to server then redirect to /:boardid
          console.log(json);
          $.ajax({
            url: '/ajax/build',
            type: 'POST',
            data: { trello: json, url: $('#inputurl').val() },
            success: function(status) {
              //TODO redirect to /build/:boardid
              console.log("Success!  Redirecting...");
            },
            failure: function() {
              console.log("Build initiation failure.");
            }
          });
        },
        failure: function() {
          //authentication failure
          console.log("Authentication failure.");
          $('#buildboard').removeClass("disabled");
        }
      });
    },
    failure: function() {
      console.log("Get application key failure.");
    }
  });
});

function logincomplete()
{

}

$('#inputurl').change(function(){
  console.log($('#inputurl').val());

  $('#urlglyph').removeClass("glyphicon-remove");
  $('#urlglyph').removeClass("glyphicon");
  $('#urlglyph').addClass("fa");
  $('#urlglyph').addClass("fa-cog");
  $('#urlglyph').addClass("fa-spin");
  $('#urlstatus').html("");

  $.ajax({
    url: '/ajax/prepurl',
    type: 'POST',
    data: { url: $('#inputurl').val() },
    success: function(data) {
      console.log(data);
      $('#urlglyph').removeClass("fa");
      $('#urlglyph').removeClass("fa-cog");
      $('#urlglyph').removeClass("fa-spin");
      $('#formurl').removeClass("has-error");
      $('#formurl').removeClass("has-warning");
      $('#formurl').removeClass("has-success");

      $('#urlglyph').addClass("glyphicon");
      $('#urlstatus').html(data.message);
      if (data.status == 0)
      {
        $('#formurl').addClass("has-error");
        $('#urlglyph').addClass("glyphicon-remove");
        $('#buildpublic').addClass("disabled");
        $('#buildprivate').addClass("disabled");
      }
      if (data.status == 1)
      {
        $('#formurl').addClass("has-warning");
        $('#urlglyph').addClass("glyphicon-warning-sign");
        $('#buildpublic').removeClass("disabled");
        $('#buildprivate').removeClass("disabled");
      }
      if (data.status == 2)
      {
        $('#formurl').addClass("has-success");
        $('#urlglyph').addClass("glyphicon-ok");
        $('#buildpublic').removeClass("disabled");
        $('#buildprivate').removeClass("disabled");
      }
      if (data.public)
      {
        $('#buildpublic').removeClass("invisible");
        $('#buildprivate').addClass("invisible");
        $('#obfuscate').addClass("invisible");
      }
      else
      {
        $('#buildpublic').addClass("invisible");
        $('#buildprivate').removeClass("invisible");
        $('#obfuscate').removeClass("invisible");
      }
    },
    error: function(jqXHR, textStatus, err) {
      $('#urlglyph').removeClass("fa");
      $('#urlglyph').removeClass("fa-cog");
      $('#urlglyph').removeClass("fa-spin");
      $('#formurl').removeClass("has-warning");
      $('#formurl').removeClass("has-success");
      $('#urlglyph').addClass("glyphicon");
      $('#formurl').addClass("has-error");
      $('#urlglyph').addClass("glyphicon-remove");
      $('#buildpublic').removeClass("invisible");
      $('#buildprivate').addClass("invisible");
      $('#obfuscate').addClass("invisible");
      $('#buildpublic').addClass("disabled");
      $('#buildprivate').addClass("disabled");
      $('#urlstatus').html("Whoa!  We can't seem to retrieve data from our server.  <a href='mailto:pachachura.arthur@gmail.com'>Contact support</a> and let us know!");
    }
  });
});

function firstLoad()
{
  //activate tooltips
  $('[data-toggle="tooltip"]').tooltip();
  //make copyright text
  $("#copyright").html("Trello2LaTeX Copyright © " + new Date().getFullYear().toString() + " Arthur Pachachura<br><b>Licensed under MIT</b>");
  //set checked state for checboxes
  $('.checked').prop("checked", "true");
}

function updateContainer() {
  var $cW = $(window).width();
  var $cH = $(window).height();

  //Make window smaller when it needs to be
  if ($("#loading").height() > $cH)
  {
    $("#loading").addClass("centered-top");
  }
  else
  {
    $("#loading").removeClass("centered-top");
  }

//  if ($cH < 400) { $cH = 400; }
//  var $stH = $cH;
//  if (($cW < 700) && ($cH > 400)) { $stH = 400; }
//  $(".slidetext-center").css('height',$stH);
//  $(".slidetext-center").css('width',$cW);
//  $(".slidetext-static").css('width',$cW);
//  $(".slidetext-top").css('height',$stH);
//  $(".slidetext-top").css('width',$cW);
//  var $s4H = $cW / 4 - 20;
//  $(".slide4-item").css('height',$s4H);
//  $(".slide4-item").css('padding-top',"0");
}

window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();
