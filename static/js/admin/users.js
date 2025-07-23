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

  //urlNoSlash = document.location.origin;
  //socket = io.connect(url + "pluginfw/admin/user_pad", {resource : resource});
  var room = url + 'pluginfw/admin/user_pad';
  socket = io.connect(room, { path: baseURL + 'socket.io', resource: resource });

  var currentUsers = [];

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
  var sortByAmountGroupsAsc = function (a, b) {
    return a.amGroups - b.amGroups;
  };
  var sortByAmountGroupsDesc = function (a, b) {
    return b.amGroups - a.amGroups;
  };

  var searchUser = function (searchTerm) {
    socket.emit('search-all-user', searchTerm, function (allUsers) {
      currentUsers = allUsers;
      showUsers(allUsers, sortByNameAsc);
    });
  };
  var addUser = function (user) {
    socket.emit('add-user', user, function (added, msg) {
      if (added) {
        $('#textfield-user').html(msg);
        searchUser('');
      } else {
        $('#textfield-user').html(msg);
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
          showUsers(currentUsers, sortByIdAsc);
        } else if (text.toLowerCase() == 'user name') {
          showUsers(currentUsers, sortByNameAsc);
        } else if (text.toLowerCase() == 'user email') {
          showUsers(currentUsers, sortByNameAsc);
        } else if (text.toLowerCase() == '#groups') {
          showUsers(currentUsers, sortByAmountGroupsAsc);
        }
      });
    $('.sort.down')
      .unbind('click')
      .click(function (e) {
        var row = $(e.target).closest('th');
        var re = /<a.+/;
        var text = row.html().toString().replace(re, '');
        if (text.toLowerCase() == 'id') {
          showUsers(currentUsers, sortByIdDesc);
        } else if (text.toLowerCase() == 'user name') {
          showUsers(currentUsers, sortByNameDesc);
        } else if (text.toLowerCase() == 'user email') {
          showUsers(currentUsers, sortByNameDesc);
        } else if (text.toLowerCase() == '#groups') {
          showUsers(currentUsers, sortByAmountGroupsDesc);
        }
      });
    $('#addUserButton')
      .unbind('click')
      .click(function (e) {
        var user = {};
        user.name = $('#name-of-user').val();
        user.baseurl = document.location.origin + baseURL;
        addUser(user);
      });
  }
  handlers();

  var showUsers = function (users, sortFunc) {
    users.sort(sortFunc);
    var widget = $('.user-results-div');
    var resultList = widget.find('.user-results');
    resultList.html('');
    for (var i = 0; i < users.length; i++) {
      var row = widget.find('.template tr').clone();
      row.find('.ID').html('<a class="userID">' + users[i].id) + '</a>';
      row.find('.Name').html('<a href = "users/user?id=' + users[i].id + '" class="userName">' + users[i].name + '</a>');
      row.find('.Email').html('<a href = "users/user?id=' + users[i].id + '" class="userEmail">' + users[i].email + '</a>');

      row.find('.Groups').html(users[i].amGroups);
      row.find('.deleteButton').bind('click', function (e) {
        var row = $(e.target).closest('tr');
        var id = row.find('.userID').html();
        var hard = false;
        socket.emit('delete-user', id, false, function (deleted) {
          if (!deleted) {
            var conf = confirm('Are you sure to delete this user?');
            if (conf == true) {
              hard = true;
              socket.emit('delete-user', id, hard, function (isOwner) {
                searchUser('');
              });
            }
          } else {
            searchUser('');
          }
        });
      });

      row.find('.newPWButton').bind('click', function (e) {
        var row = $(e.target).closest('tr');
        var id = row.find('.userID').html();
        row.find('.success').html('<img src= "../../static/plugins/ep_maadix/static/html/wait.gif" width ="12" height = "12" alt="Wait">');
        var val = {};
        val.id = id;
        val.row = row;
        var conf = confirm("This action will reset the user password and send it by email in plain text. It's safer to allow users to recover their own password. Do you still want to reset te password for this user?");
        if (conf == true) {
          socket.emit('reset-pw-user', val, function (retval) {
            var row = $(".ID:contains('" + retval.id + "')");
            if (retval.success) {
              row.parent().find('.success').html('<img src= "../../static/plugins/ep_maadix/static/html/success.jpg" width ="12" height = "12" alt="Success">');
            } else {
              row.parent().find('.success').html('<img src= "../../static/plugins/ep_maadix/static/html/fail.jpg" width ="12" height = "12" alt="Fail">');
            }
          });
        }
      });
      if (users[i].active) {
        row.find('.setActiveBtn').val('Deactivate');
        row.find('.setActiveBtn').bind('click', function (e) {
          e.preventDefault();
          var row = $(e.target).closest('tr');
          var id = row.find('.userID').html();
          var val = {};
          val.id = id;
          socket.emit('deactivate-user', val, function (retval) {
            document.location.reload();
          });
        });
      } else {
        row.find('.setActiveBtn').val('Activate');
        row.find('.setActiveBtn').bind('click', function (e) {
          e.preventDefault();
          var row = $(e.target).closest('tr');
          var id = row.find('.userID').html();
          var val = {};
          val.id = id;
          socket.emit('activate-user', val, function (retval) {
            document.location.reload();
          });
        });
      }
      resultList.append(row);
    }
  };
  searchUser('');
});
