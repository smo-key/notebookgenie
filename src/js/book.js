/** Table of Contents **/

function populateToC()
{
  var ToC =
    "<nav role='navigation' class='toc-inner'>" +
      "<ul>";

  var newLine, el, title, link, classString;

  $("page .title h1").each(function() {

    el = $(this);
    title = el.text();
    link = "#" + el.attr("id");
    parent = el.parent().parent();
    classString = "";

    if (parent.hasClass("toc"))
      return;
    else if (parent.hasClass("list") || parent.hasClass("frontmatter"))
      classString = "l1";
    else if (parent.hasClass("card"))
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
}

function populateList(name)
{
  var ToC =
    "<nav role='navigation' class='list-cards-inner' id='list-" + name + "-cards-inner'>" +
      "<ul>";

  var newLine, el, title, link;

  $("page.card.list-" + name + " .title h1").each(function() {

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

  $("page.list#list-" + name + "-page .list-cards").append(ToC);
}

populateToC();
populateList("software");
