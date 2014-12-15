function prep_genjson(status, message, public)
{
  var json = {
    status: status,
    message: message,
    public: public
  };
  return json;
}

exports.prepurl = function prepurl(url)
{
  console.log(url);
  //Test if URL is accepted
  if ((url == undefined) || (url == ""))
  { return prep_genjson(0, "Please enter the board's URL.", true); }

  if (!url.match(/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/))
  { return prep_genjson(0, "Please enter a valid URL.", true); }

  return prep_genjson(2, "", true);
};
