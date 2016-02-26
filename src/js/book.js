var ToC =
  "<nav role='navigation' class='toc-inner'>" +
    "<ul>";

var newLine, el, title, link;

$(".title.l1 h1").each(function() {

  el = $(this);
  title = el.text();
  link = "#" + el.attr("id");

  newLine =
    "<li>" +
      "<a href='" + link + "'>" +
        title +
      "</a>" +
    "</li>";

  ToC += newLine;

});

ToC +=
   "</ul>" +
  "</nav>";

$(".toc").append(ToC);
