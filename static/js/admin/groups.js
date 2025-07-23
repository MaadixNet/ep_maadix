'use strict';

$(document).ready(() => {
  var socket,
    loc = document.location,
    port = loc.port == '' ? (loc.protocol == 'https:' ? 443 : 80) : loc.port,
    url = loc.protocol + '//' + loc.hostname + ':' + port + '/',
    pathComponents = location.pathname.split('/'),
    // Strip admin/plugins
    baseURL = pathComponents.slice(0, pathComponents.length - 3).join('/') + '/',
    resource = baseURL.substring(1) + 'socket.io';
  var room = url + 'pluginfw/admin/user_pad';
  socket = io.connect(room, { path: baseURL + 'socket.io', resource: resource });

  var currentGroups = [];

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

  var sortByAmountAuthorsAsc = function (a, b) {
    return a.amAuthors - b.amAuthors;
  };

  var sortByAmountAuthorsDesc = function (a, b) {
    return b.amAuthors - a.amAuthors;
  };

  var searchGroup = function (searchTerm) {
    socket.emit('search-group', searchTerm, function (allGroups) {
      currentGroups = allGroups;
      showGroups(allGroups, sortByNameAsc);
    });
  };

  var addGroup = function (name) {
    socket.emit('add-group', name, function (added) {
      if (added) {
        searchGroup('');
      } else {
        $('#textfield-group').html('Group already exists!');
      }
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
        } else if (text.toLowerCase() == '#authors') {
          showGroups(currentGroups, sortByAmountAuthorsAsc);
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
        } else if (text.toLowerCase() == '#authors') {
          showGroups(currentGroups, sortByAmountAuthorsDesc);
        }
      });

    $('#addGroupButton')
      .unbind('click')
      .click(function (e) {
        addGroup($('#name-of-group').val());
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
      var groupUrl = 'groups/group?id=' + groups[i].id;
      row.find('.ID').html('<a class="groupID">' + groups[i].id + '</a>');
      row.find('.Name').html('<a class="groupName">' + groups[i].name + '</a>');
      row.find('.Authors').html(groups[i].amAuthors);
      row.find('.deleteButton').bind('click', function (e) {
        var row = $(e.target).closest('tr');
        var id = row.find('.groupID').html();
        var conf = confirm('Are you sure to delete this group?');
        if (conf == true) {
          socket.emit('delete-group', id, function () {
            searchGroup('');
          });
        } else {
          searchGroup('');
        }
      });
      row.find('.manageGroupBtn')[0].href = groupUrl;
      resultList.append(row);
    }
  };

  searchGroup('');
});
