$(document).ready(function () {
  firstLoad();
  //updateContainer();
  /*$(window).resize(function() {
    updateContainer();
  });*/
});

function firstLoad()
{
  //$("#copyright").text('Copyright © ' + new Date().getFullYear().toString() + ' Arthur Pachachura');
}

/*function updateContainer() {
  var $cW = $(window).width();
  var $cH = $(window).height();
  if ($cH < 400) { $cH = 400; }
  var $stH = $cH;
  if (($cW < 700) && ($cH > 400)) { $stH = 400; }
  $(".slidetext-center").css('height',$stH);
  $(".slidetext-center").css('width',$cW);
  $(".slidetext-static").css('width',$cW);
  $(".slidetext-top").css('height',$stH);
  $(".slidetext-top").css('width',$cW);
  var $s4H = $cW / 4 - 20;
  $(".slide4-item").css('height',$s4H);
  $(".slide4-item").css('padding-top',"0");
}*/

window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();
