/* Copyright 2014 Alexander Oberegger
 * Copyright 2017 MaadiX
 *
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. */

function index(hooks, context, cb) {
  var socket,
    loc = document.location,
    port = loc.port == '' ? (loc.protocol == 'https:' ? 443 : 80) : loc.port,
    url = loc.protocol + '//' + loc.hostname + ':' + port + '/',
    pathComponents = location.pathname.split('/'),
    // Strip admin/plugins
    baseURL = pathComponents.slice(0, pathComponents.length - 1).join('/') + '/',
    resource = baseURL.substring(1) + 'socket.io';
  socket = io.connect(url, { resource: resource }).of('/pluginfw/user_pad_frontend_unlogged');

  function handlers() {
    //		$('#loginButton').unbind('click').bind('click', function(e){
    //			e.preventDefault();
    //			var username = $("#username").val();
    //			var password = $("#password").val();
    //			console.log(username);
    //			console.log(password);
    //			socket.emit("login", username, password ,function(success){
    //				console.log("called");
    //				console.log(success);
    //				window.location.reload();
    //			});
    //		});
  }
  handlers();

  //	var currentGroups = [];
  //
  //	var sortByIdAsc = function(a,b){
  //		return a.id - b.id;
  //	};
  //	var sortByIdDesc = function(a,b){
  //	 	return b.id - a.id;
  //	};
  //	var sortByNameAsc = function(a,b){
  //		 var nameA=a.name.toLowerCase(), nameB=b.name.toLowerCase();
  //		 if (nameA < nameB) //sort string ascending
  //		  return -1;
  //		 if (nameA > nameB)
  //		  return 1;
  //		 return 0; //default return value (no sorting)
  //	};
  //	var sortByNameDesc = function(a,b){
  //   	     var nameA=a.name.toLowerCase(), nameB=b.name.toLowerCase();
  //		 if (nameA < nameB) //sort string desc
  //		  return 1;
  //		 if (nameA > nameB)
  //		  return -1;
  //		 return 0; //default return value (no sorting)
  //	};
  //	function Werteliste (querystring) {
  //		  if (querystring == '') return;
  //		  var wertestring = querystring.slice(1);
  //		  var paare = wertestring.split("&");
  //		  var paar, name, wert;
  //		  for (var i = 0; i < paare.length; i++) {
  //		    paar = paare[i].split("=");
  //		    name = paar[0];
  //		    wert = paar[1];
  //		    name = unescape(name).replace("+", " ");
  //		    wert = unescape(wert).replace("+", " ");
  //		    this[name] = wert;
  //		  }
  //	};
  //
  //
  //	var addGroup = function(id){
  //		var userGroup = {};
  //		userGroup.groupid = id;
  //		var list = new Werteliste(document.location.search);
  //		userGroup.userID = list.id;
  //		socket.emit("add-group-to-user", userGroup, function(added){
  //			if(added){
  //				searchAllGroupsOfUser('');
  //				searchAllGroupsNotInUser('');
  //				$('#textfield-group').html('Group added!');
  //			}else{
  //				$('#textfield-group').html('Group already exists!');
  //			}
  //		});
  //	};
  //
  //	var searchAllGroupsOfUser = function(name){
  //		var list = new Werteliste(document.location.search);
  //		var val_list = {};
  //		val_list.id = list.id;
  //		val_list.name = name;
  //		socket.emit("search-groups-of-user", val_list, function(allGroups){
  //			currentGroups = allGroups;
  //			showGroups(allGroups, sortByNameAsc);
  //		});
  //	};
  //
  //	var searchAllGroupsNotInUser = function(name){
  //		var list = new Werteliste(document.location.search);
  //		var val_list = {};
  //		val_list.id = list.id;
  //		val_list.name = name;
  //		socket.emit("search-groups-not-in-user", val_list, function(allGroups){
  //			showGroupsGroupBox(allGroups);
  //		});
  //	};
  //
  //	function handlers(){
  //		$('.sort.up').unbind('click').click(function(e) {
  //    		var row = $(e.target).closest("th");
  //    		var re = /<a.+/;
  //    		var text = row.html().toString().replace(re, '');
  //			if(text.toLowerCase() == 'id'){
  //				showGroups(currentGroups, sortByIdAsc);
  //      		}else if(text.toLowerCase() == 'group name'){
  //      			showGroups(currentGroups, sortByNameAsc);
  //      		}
  //	    });
  //    	$('.sort.down').unbind('click').click(function(e) {
  //      		var row = $(e.target).closest("th");
  //    		var re = /<a.+/;
  //    		var text = row.html().toString().replace(re, '');
  //			if(text.toLowerCase() == 'id'){
  //				showGroups(currentGroups, sortByIdDesc);
  //      		}else if(text.toLowerCase() == 'group name'){
  //      			showGroups(currentGroups, sortByNameDesc);
  //      		}
  //    	});
  //       	$('#addGroupButton').unbind('click').bind('click', function(e){
  //			e.preventDefault();
  //			$("#GroupBox").css('display', 'block');
  //			$("#fade").css('display', 'block');
  //			searchAllGroupsNotInUser('');
  //		});
  //
  //
  //	}
  //	handlers();
  //
  //	var showGroups = function(groups, sortFunc){
  //		groups.sort(sortFunc);
  //		var widget = $('.group-results-div');
  //		var resultList =widget.find('.group-results');
  //		resultList.html("");
  //		for(var i = 0; i < groups.length; i++){
  //			var row = widget.find('.template tr').clone();
  //			row.find(".ID").html('<a class="groupID">' + groups[i].id)+ '</a>';
  //			row.find(".Name").html('<a href = "../groups/group?id='+ groups[i].id+'" class="groupName">' + groups[i].name + '</a>');
  //			row.find(".escapeButton").bind('click',function(e){
  //				var row = $(e.target).closest("tr");
  //	       		var id = row.find('.groupID').html();
  //	       		var usergroup = {};
  //	       		usergroup.groupid = id;
  //	    		var list = new Werteliste(document.location.search);
  //	       		usergroup.userid = list.id;
  //
  //	       		socket.emit("suspend-user-from-group", usergroup, function(){
  //	       			searchAllGroupsOfUser('');
  //	       		});
  //			});
  //			resultList.append(row);
  //		}
  //
  //	};
  //	var showGroupsGroupBox = function(groups){
  //		var widget = $(".whitebox-result-div");
  //		var resultList=widget.find('.results');
  //		resultList.html("");
  //		for(var i = 0; i < groups.length; i++){
  //			var row = widget.find(".template tr").clone();
  //		      row.find(".name").html('<a class="groupName">' +groups[i].name+'</a>');
  //		      row.find(".id").html('<a class="groupID">' + groups[i].id + '</a>');
  //		      row.find(".name").bind('click', function(e){
  //		    	var row = $(e.target).closest("tr");
  //		       	var id = row.find('.groupID').html();
  //		    	addGroup(id);
  //		      });
  //		      resultList.append(row);
  //		};
  //
  //	};
  //
  //	socket.on('search-all-groups-from-user-result', function(user){
  //		showGroupsGroupBox(user);
  //	});
  //	searchAllGroupsOfUser('');
}

exports.documentReady = function (hooks, context, cb) {
  //console.log(context);

  if (context == '/user_pad_frontend/index') index(hooks, context, cb);
  //		else if(context == "admin/user_pad_group")
  //			group(hooks,context,cb);
  //		else if(context == "admin/user_pad_users")
  //		    users(hooks,context,cb);
  //		else if(context == "admin/user_pad_user")
  //			user(hooks, context,cb);
  else return;
};
