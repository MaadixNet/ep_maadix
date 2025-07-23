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

  var currentGroups = [];

  var list = new Werteliste(document.location.search);
  var userId = list.id;

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

  var getUserData = function (userId) {
    socket.emit('get-user-name', userId, function (username) {
      $('#userName').html(username);
    });
  };

  var addGroup = function (id) {
    var userGroup = {};
    userGroup.groupid = id;
    userGroup.userID = userId;
    socket.emit('add-group-to-user', userGroup, function (added) {
      if (added) {
        searchAllGroupsOfUser('');
        searchAllGroupsNotInUser('');
      } else {
        $('#textfield-group').html('Group already exists!');
      }
    });
  };

  var searchAllGroupsOfUser = function (name) {
    var val_list = {};
    val_list.id = userId;
    val_list.name = name;
    socket.emit('search-groups-of-user', val_list, function (allGroups) {
      currentGroups = allGroups;
      showGroups(allGroups, sortByNameAsc);
    });
  };

  var searchAllGroupsNotInUser = function (name) {
    var val_list = {};
    val_list.id = userId;
    val_list.name = name;
    socket.emit('search-groups-not-in-user', val_list, function (allGroups) {
      showGroupsGroupBox(allGroups);
    });
  };

  function handlers() {
    $('.sort.up')
      .unbind('click')
      .click(function (e) {
        var row = $(e.target).closest('th');
        var re = /<a.+/;
        var text = row.html().toString().replace(re, '');
        if (text.toLowerCase() == 'id') {
          showGroups(currentGroups, sortByIdAsc);
        } else if (text.toLowerCase() == 'group name') {
          showGroups(currentGroups, sortByNameAsc);
        }
      });
    $('.sort.down')
      .unbind('click')
      .click(function (e) {
        var row = $(e.target).closest('th');
        var re = /<a.+/;
        var text = row.html().toString().replace(re, '');
        if (text.toLowerCase() == 'id') {
          showGroups(currentGroups, sortByIdDesc);
        } else if (text.toLowerCase() == 'group name') {
          showGroups(currentGroups, sortByNameDesc);
        }
      });
    $('#addGroupButton')
      .unbind('click')
      .bind('click', function (e) {
        e.preventDefault();
        $('#GroupBox').css('display', 'block');
        $('#fade').css('display', 'block');
        searchAllGroupsNotInUser('');
      });
  }
  handlers();

  var showGroups = function (groups, sortFunc) {
    groups.sort(sortFunc);
    var widget = $('.group-results-div');
    var resultList = widget.find('.group-results');
    resultList.html('');
    for (var i = 0; i < groups.length; i++) {
      var row = widget.find('.template tr').clone();
      row.find('.ID').html('<a class="groupID">' + groups[i].id) + '</a>';
      row.find('.Name').html('<a href = "../groups/group?id=' + groups[i].id + '" class="groupName">' + groups[i].name + '</a>');
      row.find('.escapeButton').bind('click', function (e) {
        var row = $(e.target).closest('tr');
        var id = row.find('.groupID').html();
        var usergroup = {};
        usergroup.groupid = id;
        usergroup.userid = userId;

        socket.emit('suspend-user-from-group', usergroup, function () {
          searchAllGroupsOfUser('');
        });
      });
      resultList.append(row);
    }
  };
  var showGroupsGroupBox = function (groups) {
    var widget = $('.whitebox-result-div');
    var resultList = widget.find('.results');
    resultList.html('');
    for (var i = 0; i < groups.length; i++) {
      var row = widget.find('.template tr').clone();
      row.find('.name').html('<a class="groupName">' + groups[i].name + '</a>');
      row.find('.id').html('<a class="groupID">' + groups[i].id + '</a>');
      row.find('.name').bind('click', function (e) {
        var row = $(e.target).closest('tr');
        var id = row.find('.groupID').html();
        addGroup(id);
      });
      resultList.append(row);
    }
  };

  getUserData(userId);
  socket.on('search-all-groups-from-user-result', function (user) {
    showGroupsGroupBox(user);
  });
  searchAllGroupsOfUser('');
});
