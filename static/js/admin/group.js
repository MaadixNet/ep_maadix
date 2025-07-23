'use strict';
$(document).ready(() => {
  var socket,
    loc = document.location,
    port = loc.port == '' ? (loc.protocol == 'https:' ? 443 : 80) : loc.port,
    url = loc.protocol + '//' + loc.hostname + ':' + port + '/',
    pathComponents = location.pathname.split('/'),
    // Strip admin/plugins
    baseURL = pathComponents.slice(0, pathComponents.length - 4).join('/') + '/',
    resource = baseURL.substring(1) + 'socket.io';

  var room = url + 'pluginfw/admin/user_pad';
  socket = io.connect(room, { path: baseURL + 'socket.io', resource: resource });

  var currentPads = [];
  var currentUser = [];

  var list = new Werteliste(document.location.search);
  var groupId = list.id;
  var groupEtherpadName;

  var sortByIdAsc = function (a, b) {
    return a.id - b.id;
  };
  var sortByIdDesc = function (a, b) {
    return b.id - a.id;
  };
  var sortByNameAsc = function (a, b) {
    var nameA = a.name.toLowerCase(),
      nameB = b.name.toLowerCase();
    if (nameA < nameB)
      //sort string ascending
      return -1;
    if (nameA > nameB) return 1;
    return 0; //default return value (no sorting)
  };
  var sortByNameDesc = function (a, b) {
    var nameA = a.name.toLowerCase(),
      nameB = b.name.toLowerCase();
    if (nameA < nameB)
      //sort string desc
      return 1;
    if (nameA > nameB) return -1;
    return 0; //default return value (no sorting)
  };

  var getGroupData = function (groupId) {
    socket.emit('get-group-name', groupId, function (groupName) {
      $('#groupName').html(groupName);
    });
    socket.emit('get-etherpad-group-name', groupId, function (group) {
      groupEtherpadName = group;
      console.log(groupEtherpadName);
    });
  };

  var searchPads = function (searchTerm) {
    var searchPad = {};
    searchPad.id = groupId;
    searchPad.term = searchTerm;
    socket.emit('search-pads', searchPad, function (pads) {
      currentPads = pads;
      showPads(pads, sortByNameAsc);
    });
  };

  var searchUsers = function (searchTerm) {
    var searchUser = {};
    searchUser.id = groupId;
    searchUser.term = searchTerm;
    socket.emit('search-group-user', searchUser, function (user) {
      currentUser = user;
      showUser(user, sortByNameAsc);
    });
  };

  var addUserToGroup = function (id) {
    var userGroup = {};
    userGroup.userID = id;
    var list = new Werteliste(document.location.search);
    userGroup.groupid = list.id;
    socket.emit('add-user-to-group', userGroup, function (added) {
      if (added) {
        $('#textfield-user').html('User added to Group!');
        searchUsers('');
      } else {
        $('#textfield-user').html('User already exists in Group!');
      }
    });
  };

  var addPad = function (pad) {
    var padGroup = {};
    padGroup.padName = pad.name;
    padGroup.groupid = groupId;
    socket.emit('add-pad-to-group', padGroup, function (added) {
      if (added) {
        searchPads('');
      } else {
        $('#textfield-pad').html('Pad already exists!');
      }
    });
  };
  var searchAllUser = function (name) {
    var val_list = {};
    val_list.groupid = groupId;
    val_list.name = name;
    socket.emit('search-all-users-not-in-group', val_list, function (allUser) {
      showUsersUserBox(allUser);
    });
  };

  function handlers() {
    $('.sort.up')
      .unbind('click')
      .click(function (e) {
        var row = $(e.target).closest('th');
        var re = /<a.+/;
        var text = row.html().toString().replace(re, '');
        if (text.toLowerCase() == 'pad name') {
          showPads(currentPads, sortByNameAsc);
        } else if (text.toLowerCase() == 'id') {
          showUser(currentUser, sortByIdAsc);
        } else if (text.toLowerCase() == 'user name') {
          showUser(currentUser, sortByNameAsc);
        }
      });

    $('.sort.down')
      .unbind('click')
      .click(function (e) {
        var row = $(e.target).closest('th');
        var re = /<a.+/;
        var text = row.html().toString().replace(re, '');
        if (text.toLowerCase() == 'pad name') {
          showPads(currentPads, sortByNameDesc);
        } else if (text.toLowerCase() == 'id') {
          showUser(currentUser, sortByIdDesc);
        } else if (text.toLowerCase() == 'user name') {
          showUser(currentUser, sortByNameDesc);
        }
      });

    $('#addPadButton')
      .unbind('click')
      .click(function (e) {
        var pad = {};
        pad.name = $('#name-of-pad').val();
        console.log('Adding apd ' + pad.name);
        pad.group = document.location.search.id;
        addPad(pad);
      });
    $('#addUserButton')
      .unbind('click')
      .bind('click', function (e) {
        e.preventDefault();
        $('#UserBox').css('display', 'block');
        $('#fade').css('display', 'block');
        searchAllUser('');
      });
  }
  handlers();

  var showPads = function (pads, sortFunc) {
    pads.sort(sortFunc);
    var widget = $('.pad-results-div');
    var resultList = widget.find('.pad-results');
    resultList.html('');
    for (var i = 0; i < pads.length; i++) {
      var row = widget.find('.template tr').clone();
      row.find('.Name').html(pads[i].name);
      row.find('.visitPadBtn').bind('click', function (e) {
        var pad_name = $(e.target).parent().parent().siblings('.Name');
        socket.emit('direct-to-group-pad', 'admin', groupId, pad_name.html(), function (session, group, pad_name) {
          document.cookie = 'sessionID=' + session + '; path=/';
        });
      });

      row.find('.deletePadBtn').bind('click', function (e) {
        var row = $(e.target).closest('tr');
        var name = row.find('.Name').html();
        if (confirm(`Do you confirm removing pad ${name}`)) {
          socket.emit('delete-pad', name, groupId, function () {
            searchPads('');
          });
        }
      });

      row
        .find('.visitPadBtn')
        .parent()
        .attr('href', baseURL + 'group/' + groupId + '/pad/' + groupEtherpadName + '$' + pads[i].name);
      resultList.append(row);
    }
  };

  var showUser = function (user, sortFunc) {
    user.sort(sortFunc);
    var widget = $('.user-results-div');
    var resultList = widget.find('.user-results');
    resultList.html('');
    for (var i = 0; i < user.length; i++) {
      var row = widget.find('.template tr').clone();
      row.find('.ID').html('<a class="userID">' + user[i].id) + '</a>';
      row.find('.Name').html('<a href = "../users/user?id=' + user[i].id + '" class="userId">' + user[i].name + '</a>');
      row.find('.suspendButton').bind('click', function (e) {
        var row = $(e.target).closest('tr');
        console.log(row);
        var id = row.find('.userID').html();
        var username = row.find('.userId').html();
        console.log('UDDD ' + id);
        var usergroup = {};
        usergroup.userid = id;
        usergroup.groupid = groupId;
        if (confirm(`Do you confirm removing user ${username} from group?`)) {
          socket.emit('suspend-user-from-group', usergroup, function () {
            searchUsers('');
          });
        }
      });
      resultList.append(row);
    }
  };

  var showUsersUserBox = function (user) {
    var widget = $('.whitebox-result-div');
    var resultList = widget.find('.results');
    resultList.html('');
    for (var i = 0; i < user.length; i++) {
      var row = widget.find('.template tr').clone();
      row.find('.name').html('<a class="userName">' + user[i].name + '</a>');
      row.find('.id').html('<a class="userID">' + user[i].userID + '</a>');
      row.find('.name').bind('click', function (e) {
        var row = $(e.target).closest('tr');
        var id = row.find('.userID').html();
        addUserToGroup(id);
        searchAllUser('');
      });
      resultList.append(row);
    }
  };

  getGroupData(groupId);
  searchPads('');
  searchUsers('');
});
