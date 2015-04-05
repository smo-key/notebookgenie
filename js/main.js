if (location.protocol !== 'https:' && redirectsecure) {
  // page is insecure
  var oldURL = window.location.hostname + window.location.pathname;
  var newURL = "https://" + oldURL;
  window.location = newURL;
}

if (isupdatable) {
  socket.on('progress', function (data) {
    console.log(data);
    updateprogress(data);
  });

  socket.on('fragment', function (data) {
    console.log(data);
    $('#replaceable-main').html(data.main);
    $('#replaceable-built').html(data.built);
    $('[data-toggle="tooltip"]').tooltip();

    if (typeof id !== 'undefined') {
      $('#replaceable-build').html(data.active);
      $('#replaceable-panel').removeClass("panel-primary");
      $('#replaceable-panel').removeClass("panel-success");
      $('#replaceable-panel').removeClass("panel-info");
      $('#replaceable-panel').removeClass("panel-warning");
      $('#replaceable-panel').removeClass("panel-danger");
      $('#replaceable-panel').addClass("panel-" + data.status);
      $('.alert').alert('close');
    }
  });

  function updateprogress(data) {
    if (isupdatable)
    {
      if (data.status) {
        //ongoing progress
        $('#progressbarupdatable').css("width", data.progress.toString() + "%");
        $('#progressbarupdatable').prop("aria-valuenow", data.progress.toString());
        $('#progressbarupdatable .sr-only').html(data.progress.toString() + "% Complete");
        $('#progressbarupdatable').addClass("active");
      }
    }
  }
}

function updateContainer() {
  var $cW = $(window).width();
  var $cH = $(window).height();

  //Make window smaller when it needs to be
  if ($("#loadingcontainer").height() > $cH)
  {
    $("#loadingcontainer").addClass("centered-top");
  }
  else
  {
    $("#loadingcontainer").removeClass("centered-top");
  }
  var h = $cH;
  if (h > 800) { h = 800; }
  $('.maxheight').css("max-height", h - 200);
}

//activate tooltips
$('[data-toggle="tooltip"]').tooltip();

updateContainer();
$(window).resize(function() {
  updateContainer();
});
