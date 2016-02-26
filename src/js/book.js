/** Table of Contents **/

var ToC =
  "<nav role='navigation' class='toc-inner'>" +
    "<ul>";

var newLine, el, title, link;

$("page .title h1").each(function() {

  el = $(this);
  title = el.text();
  link = "#" + el.attr("id");
  parent = el.parent();
  classString = "";

  if (parent.hasClass("ignore"))
    return;
  else if (parent.hasClass("l1"))
    classString = "l1";
  else if (parent.hasClass("l2"))
    classString = "l2";

  newLine =
    "<li class='" + classString + "'>" +
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
