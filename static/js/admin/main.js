function main() {
  var socket,
    loc = document.location,
    port = loc.port == '' ? (loc.protocol == 'https:' ? 443 : 80) : loc.port,
    url = loc.protocol + '//' + loc.hostname + ':' + port + '/',
    pathComponents = location.pathname.split('/'),
    // Strip admin/plugins
    baseURL = pathComponents.slice(0, pathComponents.length - 2).join('/') + '/',
    resource = baseURL.substring(1) + 'socket.io';

  var room = url + 'pluginfw/admin/user_pad';
  socket = io.connect(room, { path: baseURL + 'socket.io', resource: resource });

  var getSettings = function () {
    socket.emit('get-settings', function (settings) {
      $('#public_pads').prop('checked', settings.public_pads ? true : false);
      $('#recover_pw').prop('checked', settings.recover_pw ? true : false);
      $('#register_enabled').prop('checked', settings.register_enabled ? true : false);
    });
  };
  var searchGroup = function (searchTerm) {
    socket.emit('search-group', searchTerm, function (allGroups) {
      $('#n_groups').html(allGroups.length);
    });
  };
  var searchUser = function (searchTerm) {
    socket.emit('search-all-user', searchTerm, function (allUsers) {
      $('#n_users').html(allUsers.length);
    });
  };

  var toggleOption = function (element) {
    var elementId = element.attr('id');
    var isChecked = $('#' + elementId).is(':checked') ? 1 : 0;

    socket.emit('set-setting', elementId, isChecked, function (retval) {});
    //$('#' + elementId).attr('checked', !isChecked);
  };

  function handlers() {
    $('#public_pads')
      .unbind('click')
      .click(function (e) {
        toggleOption($(e.target));
      });
    $('#recover_pw')
      .unbind('click')
      .click(function (e) {
        toggleOption($(e.target));
      });
    $('#register_enabled')
      .unbind('click')
      .click(function (e) {
        toggleOption($(e.target));
      });
  }
  handlers();

  getSettings();
  //searchGroup('');
  //searchUser('');
}

main();
