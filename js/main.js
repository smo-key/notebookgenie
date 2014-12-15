$(document).ready(function () {
  firstLoad();
  updateContainer();
  $(window).resize(function() {
    updateContainer();
  });
});

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

        //TODO test data.public
      }
      if (data.status == 1)
      {
        $('#formurl').addClass("has-warning");
        $('#urlglyph').addClass("glyphicon-warning-sign");
      }
      if (data.status == 2)
      {
        $('#formurl').addClass("has-success");
        $('#urlglyph').addClass("glyphicon-ok");
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
      var jsonValue = jQuery.parseJSON(jqXHR.responseText);
      $('#urlstatus').html("Error: " + jsonValue.Message);
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

function getState()
{

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
