function Werteliste(querystring) {
  if (querystring == '') return;
  var wertestring = querystring.slice(1);
  var paare = wertestring.split('&');
  var paar, name, wert;
  for (var i = 0; i < paare.length; i++) {
    paar = paare[i].split('=');
    name = paar[0];
    wert = paar[1];
    name = unescape(name).replace('+', ' ');
    wert = unescape(wert).replace('+', ' ');
    this[name] = wert;
  }
}
