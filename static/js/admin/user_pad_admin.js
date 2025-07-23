/* Copyright 2014 Alexander Oberegger
 * Copyright 2017 Pablo Castellano

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. */

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

function group(hooks, context, cb) {
  var socket,
    loc = document.location,
    port = loc.port == '' ? (loc.protocol == 'https:' ? 443 : 80) : loc.port,
    url = loc.protocol + '//' + loc.hostname + ':' + port + '/',
    pathComponents = location.pathname.split('/'),
    // Strip admin/plugins
    baseURL = pathComponents.slice(0, pathComponents.length - 4).join('/') + '/',
    resource = baseURL.substring(1) + 'socket.io';

  //	socket = io.connect(url + "pluginfw/admin/user_pad", {resource : resource});
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
        pad = {};
        pad.name = $('#name-of-pad').val();
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
        //				console.log(document.location);
        var pad_name = $(e.target).parent().parent().siblings('.Name');
        //console.log(pad_name.html());
        socket.emit('direct-to-group-pad', 'admin', groupId, pad_name.html(), function (session, group, pad_name) {
          document.cookie = 'sessionID=' + session + '; path=/';
        });
      });
      row.find('.deletePadBtn').bind('click', function (e) {
        var row = $(e.target).closest('tr');
        var name = row.find('.Name').html();

        socket.emit('delete-pad', name, groupId, function () {
          searchPads('');
        });
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
        var id = row.find('.userId').html();
        var usergroup = {};
        usergroup.userid = id;
        usergroup.groupid = groupId;
        socket.emit('suspend-user-from-group', usergroup, function () {
          searchUsers('');
        });
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
}

//////////GROUPS//////////////

function groups(hooks, context, cb) {
  var socket,
    loc = document.location,
    port = loc.port == '' ? (loc.protocol == 'https:' ? 443 : 80) : loc.port,
    url = loc.protocol + '//' + loc.hostname + ':' + port + '/',
    pathComponents = location.pathname.split('/'),
    // Strip admin/plugins
    baseURL = pathComponents.slice(0, pathComponents.length - 3).join('/') + '/',
    resource = baseURL.substring(1) + 'socket.io';
  //	console.log("res:");
  //	console.log(resource);

  //socket = io.connect(url + "pluginfw/admin/user_pad", {resource : resource});
  var room = url + 'pluginfw/admin/user_pad';
  socket = io.connect(room, { path: baseURL + 'socket.io', resource: resource });

  //	console.log('groups called');
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
    //		console.log('searching for group');
    socket.emit('search-group', searchTerm, function (allGroups) {
      currentGroups = allGroups;
      showGroups(allGroups, sortByNameAsc);
    });
  };
  var addGroup = function (name) {
    socket.emit('add-group', name, function (added) {
      if (added) {
        console.log('ADEEDS');
        searchGroup('');
      } else {
        $('#textfield-group').html('Group already exists!');
        console.log('Not added');
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
}

////////USERS//////////////

function users(hooks, context, cb) {
  var socket,
    loc = document.location,
    port = loc.port == '' ? (loc.protocol == 'https:' ? 443 : 80) : loc.port,
    url = loc.protocol + '//' + loc.hostname + ':' + port + '/',
    pathComponents = location.pathname.split('/'),
    // Strip admin/plugins
    baseURL = pathComponents.slice(0, pathComponents.length - 3).join('/') + '/',
    resource = baseURL.substring(1) + 'socket.io';
  urlNoSlash = document.location.origin;

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
        //user.pw = $("#pw-of-user").val();
        user.baseurl = urlNoSlash + baseURL;
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
}

///////////USER/////////////////

function user(hooks, context, cb) {
  var socket,
    loc = document.location,
    port = loc.port == '' ? (loc.protocol == 'https:' ? 443 : 80) : loc.port,
    url = loc.protocol + '//' + loc.hostname + ':' + port + '/',
    pathComponents = location.pathname.split('/'),
    // Strip admin/plugins
    baseURL = pathComponents.slice(0, pathComponents.length - 4).join('/') + '/',
    resource = baseURL.substring(1) + 'socket.io';
  //	console.log(resource);

  //socket = io.connect(url + "pluginfw/admin/user_pad", {resource : resource});
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
}

function main(hooks, context, cb) {
  var socket,
    loc = document.location,
    port = loc.port == '' ? (loc.protocol == 'https:' ? 443 : 80) : loc.port,
    url = loc.protocol + '//' + loc.hostname + ':' + port + '/',
    pathComponents = location.pathname.split('/'),
    // Strip admin/plugins
    baseURL = pathComponents.slice(0, pathComponents.length - 2).join('/') + '/',
    resource = baseURL.substring(1) + 'socket.io';
  //	console.log(resource);

  //socket = io.connect(url + "pluginfw/admin/user_pad", {resource : resource});
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
  searchGroup('');
  searchUser('');
}

exports.documentReady = function (hooks, context, cb) {
  //	    console.log(context);
  if (context == 'admin/user_pad_groups') groups(hooks, context, cb);
  else if (context == 'admin/user_pad_group') group(hooks, context, cb);
  else if (context == 'admin/user_pad_users') users(hooks, context, cb);
  else if (context == 'admin/user_pad_user') user(hooks, context, cb);
  else if (context == 'admin/user_pad') main(hooks, context, cb);
  else return;
};
