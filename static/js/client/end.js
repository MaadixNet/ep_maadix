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

var setPw = function (groupId, padName, Password) {
  //      console.log(groupId);
};

var getBaseURL = function (slice, cb) {
  var loc = document.location,
    port = loc.port == '' ? (loc.protocol == 'https:' ? 443 : 80) : loc.port,
    url = loc.protocol + '//' + loc.hostname,
    pathComponents = location.pathname.split('/'),
    // Strip admin/plugins
    baseURL = pathComponents.slice(0, pathComponents.length - slice).join('/') + '/';
  if (loc.port) url = url + ':' + loc.port;
  url = url + baseURL;

  console.log('AAAAAAAAA');
  console.log(url);
  console.log(baseURL);
  console.log('<<<<<<<<<');

  cb(url);
};

var first = true;

function post(data, url, cb) {
  $.ajax({
    type: 'POST',
    data: JSON.stringify(data),
    contentType: 'application/json',
    url: url,
    success: function (data) {
      cb(data);
    },
    error: function (xhr, ajaxOptions, thrownError) {
      cb(null);
    },
  });
}

function getSlice(cb) {
  var slice;
  if (window.location.href.indexOf('$') > -1) slice = 4;
  else if (window.location.href.indexOf('group.html') > -1) slice = 2;
  else if (window.location.href.indexOf('public_pad') > -1) slice = 2;
  else slice = 1;
  cb(slice);
}
function randomPadNameCreate() {
  // the number of distinct chars (64) is chosen to ensure that
  // the selection will be uniform when using the PRNG below
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
  // the length of the pad name is chosen to get 120-bit security:
  // log2(64^20) = 120
  var string_length = 20;
  // make room for 8-bit integer values that span from 0 to 255.
  var randomarray = new Uint8Array(string_length);
  // use browser's PRNG to generate a "unique" sequence
  var cryptoObj = window.crypto || window.msCrypto; // for IE 11
  cryptoObj.getRandomValues(randomarray);
  var randomstring = '';
  for (var i = 0; i < string_length; i++) {
    // instead of writing "Math.floor(randomarray[i]/256*64)"
    // we can save some cycles.
    var rnum = Math.floor(randomarray[i] / 4);
    randomstring += chars.substring(rnum, rnum + 1);
  }
  return randomstring;
}

var userRole = function (numrole) {
  var textrole = '';
  switch (numrole) {
    case 1:
      textrole = 'Group Admin';
      break;
    case 2:
      textrole = 'Group Manager';
      break;
    case 3:
      textrole = 'Group Author';
      break;
    default:
      textrole = 'Undefined';
  }
  return textrole;
};

jQuery(document).ready(function () {
  // minimize the elements
  $('#minimize').click(function () {
    $('header').delay(0).slideUp(800);
    $('#groupNav').delay(0).slideUp(800);
    $('footer').delay(0).slideUp(800);
    $('#minimize').delay(0).slideUp(800);
    $('#maximize').delay(1200).slideDown(800);

    $('#iframePad').animate({ height: $(window).height() - 4 }, 800);
    $('#iframePad').css('display', 'block');
  });

  // maximize the elements
  $('#maximize').click(function () {
    $('header').delay(300).slideDown(800);
    $('#groupNav').delay(300).slideDown(800);
    $('footer').delay(300).slideDown(800);
    $('#minimize').delay(1500).slideDown(800);
    $('#maximize').delay(0).slideUp(800);

    $('#iframePad')
      .delay(300)
      .animate({ height: $(window).height() - $('header').height() - $('#groupNav').height() - $('footer').height() - 8 }, 800);
  });

  // adjust the height of the iframe
  $('#iframePad').css('height', $(window).height() - $('header').height() - $('#groupNav').height() - $('footer').height() - 8);
  $(window).resize(function () {
    if ($('header').css('display') != 'none') $('#iframePad').css('height', $(window).height() - $('header').height() - $('#groupNav').height() - $('footer').height() - 8);
    else $('#iframePad').css('height', $(window).height() - 4);
  });

  // adjust the height of main > inside for the iframe (border of 4px )
  $('#iframePad')
    .parent()
    .css('height', $(window).height() - $('header').height() - $('#groupNav').height() - $('footer').height() - 4);
  $(window).resize(function () {
    $('#iframePad')
      .parent()
      .css('height', $(window).height() - $('header').height() - $('#groupNav').height() - $('footer').height() - 4);
  });

  $('#formEtherpadEditProfile').submit(function (e) {
    e.preventDefault();
    var url;
    var data = {};
    //url = baseurl;
    getBaseURL(1, function (baseurl) {
    data.userid = $('#userid').val();
    data.email = $('#email').val();
    data.username = $('#username').val();
    data.password = $('#password').val();
    data.fullname = $('#fullname').val();
    data.passwordrepeat = $('#passwordrepeat').val();
    post(data, baseurl + 'updateprofile', function (data) {
      if (data.success) {
          $('h3.title').after('<div class="resMessage" lang="en">Profile succesfully updated</div>');
      } else {
        console.log(data.error);
        $('#wrapper').find('.errorRight').remove();
        $('h3.title').after('<div class="errorRight"><span class="arrowRight"></span><span class="errorUp error" lang="en">' + data.error + '</span></div>');
        }
  });
});
});
  //Function to create a new Group. Used in dashboard.ejs
  $('#createPrivateGroupForm').submit(function (e) {
    e.preventDefault();
    var data = {};
    var url;
    getBaseURL(1, function (baseurl) {
      url = baseurl;
      data.location = url;
      data.groupName = $('#groupName').val();
      post(data, url + 'createGroup', function (data) {
        if (!data.success) {
          $('#createPrivateGroupForm input').each(function () {
            if ($(this).next().hasClass('errorUp')) $(this).next().remove();
            $(this)
              .parent()
              .append('<div class="errorUp error"><span class="arrowUp"></span><span lang="en">' + data.error + '</span></div>');
            $('#createPrivateGroupForm .errorUp').delay(2000).fadeOut(1000);
          });
        } else {
          $('#groupName').val('');
          $('#wrapper').append('<div id="overlay"></div>');
          $('#wrapper').append('<div id="lightBox">' + '<div id="lightBoxMain" data-groupid= "' + data.groupid + '" ><div class="headline"></div><div class="content"><h3 lang="en" calss="center">Creating Group</h3></div></div></div>');

          $('#lightBox').css('margin-top', -$('#lightBox').height() / 2);

          window.location.reload();
        }
      });
    });
  });

  //Function to add a private pad to a group, used in group.ejs
  $('#createPrivateGroupPad').click(function (e) {
    e.preventDefault();
    var data = {};
    var url;
    var loc;
    getBaseURL(2, function (baseurl) {
      loc = document.location;
      url = baseurl;
      data.location = url;
      data.padName = $('#createGroupPad').val();
      data.groupId = $('#createPrivateGroupPad').data('groupid');
      console.log(data);
      post(data, url + 'createPad', function (data) {
        if (!data.success) {
          console.log(data.error);
          $('#createPrivatePadForm input').each(function () {
            if ($(this).next().hasClass('errorUp')) $(this).next().remove();
            $(this)
              .parent()
              .append('<div class="errorUp error"><span class="arrowUp"></span><span lang="en">' + data.error + '</span></div>');
            $('#createPrivatePadForm .errorUp').delay(2000).fadeOut(1000);
          });
        } else {
          console.log('pad has been created');
          $('#groupName').val('');
          $('#wrapper').append('<div id="overlay"></div>');
          $('#wrapper').append('<div id="lightBox">' + '<div id="lightBoxMain" data-groupid= "' + data.groupid + '" ><div class="headline"></div><div class="content"><h3 lang="en" class="center">Creating Pad</h3></div></div></div>');

          $('#lightBox').css('margin-top', -$('#lightBox').height() / 2);

          window.location = loc;
        }
      });
    });
  });

  //Function to go to pad iframe - Used in group.ejs
  $('.padClick').click(function (e) {
    e.preventDefault();
    var groupId = $(this).data('groupid');
    var padname = $(this).data('name');
    var data = {};
    var url;
    getBaseURL(2, function (baseurl) {
      url = baseurl;
      data.location = url;
      data.groupId = groupId;
      data.padname = padname;
      console.log(data);
      post(data, url + 'directToPad', function (data) {
        document.cookie = 'sessionID=' + data.session + '; path=/';
        window.location = window.location + '/pad/' + data.group + '$' + data.pad_name;
      });
    });
  });

  $('#openPublicPad').click(function (e) {
    e.preventDefault();
    getBaseURL(1, function (baseurl) {
      var padname = $('#openPadName').val();
      var url = $('#baseurl').val();
      if (padname.length > 0) {
        window.location = baseurl + 'pads/' + padname;
      } else {
        $('#openPadName').parent().append('<div class="errorUp"><span class="arrowUp"></span><span lang="en">Please enter a name</span></div>');
        $('.errorUp').delay(2000).fadeOut(1000);
        console.log(url);
      }
    });
  });

  $('#createPublicPadByName').click(function (e) {
    e.preventDefault();
    getBaseURL(1, function (baseurl) {
      var padname = $('#createPadName').val();
      if (padname.length > 0) {
        window.location = baseurl + 'p/' + padname;
      } else {
        $('#createPublicPadByName').after('<div class="errorUp"><span class="arrowUp"></span><span lang="en">Please enter a name</span></div>');
        $('.errorUp').delay(2000).fadeOut(1000);
      }
    });
  });
  $('#createPublicPadRandomName').click(function (e) {
    e.preventDefault();
    getBaseURL(1, function (baseurl) {
      var padname = randomPadNameCreate();
      window.location = baseurl + 'p/' + padname;
    });
  });
  $('#formEtherpadRegister').submit(function (e) {
    e.preventDefault();
    var data = {};
    var url;
    var loc;
    getBaseURL(1, function (baseurl) {
      data.location = baseurl;
      data.userEmail = $('#email').val();
      post(data, baseurl + 'register', function (data) {
        if (data.error) {
          console.log('Data error: ' + data.error);
          $('.errorUp').hide();
          $('#formEtherpadRegister').before('<div class="errorUp error"><span class="arrowUp"></span><span lang="en">' + data.error + '</span></div>');
        } else {
          console.log('success');
          $('.errorUp').hide();
          $('#formEtherpadRegister').before('<div class="errorUp success"><span class="arrowUp"></span><span lang="en">An email has been sent to you. Please check your inbox folder</span></div>');
        }
      });
    });
  });

  $('#formEtherpadRcover').submit(function (e) {
    e.preventDefault();
    var data = {};
    var url;
    var loc;
    getBaseURL(1, function (baseurl) {
      data.location = baseurl;
      data.userEmail = $('#email').val();
      post(data, baseurl + 'recover', function (data) {
        console.log(data);
        if (data.error) {
          console.log('Data error: ' + data.error);
          $('.errorUp').hide();
          $('#formEtherpadRcover').before('<div class="errorUp error"><span class="arrowUp"></span><span lang="en">' + data.error + '</span></div>');
        } else {
          console.log('success');
          $('.errorUp').hide();
          $('#formEtherpadRcover').before('<div class="errorUp success"><span class="arrowUp"></span><span lang="en">An email has been sent to you. Please check your inbox folder</span></div>');
        }
      });
    });
  });
  $('#formEtherpadReset').submit(function (e) {
    e.preventDefault();
    var url;
    getBaseURL(2, function (baseurl) {
      var data = {};
      url = baseurl;
      data.email = $('#email').val();
      data.password = $('#password').val();
      data.passwordrepeat = $('#passwordrepeat').val();
      data.tok = $('#tok').val();
      data.location = url;
      post(data, baseurl + 'resetpsw', function (data) {
        console.log('SAAAAAA' + data);
        if (data.success) {
          window.location = url + 'login?act=ok';
        } else {
          console.log('Data error: ' + data.error);
          $('.errorUp').hide();
          $('#formEtherpadReset #email').before('<div class="errorUp error"><span class="arrowUp"></span><span lang="en">' + data.error + '</span></div>');
        }
      });
    });
  });

  $('#InviteUserForm').submit(function (e) {
    e.preventDefault();
    var data = {};
    var url;
    var loc;
    getBaseURL(2, function (baseurl) {
      loc = document.location;
      url = baseurl;
      console.log(url);
      data.location = url;
      data.userEmail = $('#email').val();
      data.groupId = $('#InviteUserToGroupForm').data('groupid');
      data.UserRole = $('#userRole').val();
      data.UserRole = $('input[name=userRole]:radio:checked').val();
      post(data, url + 'inviteUsers', function (data) {
        if (!data.success) {
          console.log(data.error);
          $('#InviteUserForm').each(function () {
            if ($(this).next().hasClass('errorUp')) $(this).next().remove();
            $(this)
              .parent()
              .append('<div class="errorUp"><span class="arrowUp"></span><span lang="en">' + data.error + '</span></div>');
            $('#InviteUserForm .errorUp').delay(2000).fadeOut(1000);
          });
        } else {
          $('#wrapper').append('<div id="overlay"></div>');
          $('#wrapper').append('<div id="lightBox">' + '<div id="lightBoxMain" data-groupid= "' + data.groupId + '" ><div class="headline"></div><div class="content"><h3 lang="en"class="center">Sending invitation</h3></div></div></div>');

          $('#lightBox').css('margin-top', -$('#lightBox').height() / 2);

          window.location = loc;
        }
      });
    });
  });

  $('#formEtherpadConfirm').submit(function (e) {
    e.preventDefault();
    var url;
    getBaseURL(2, function (baseurl) {
      var data = {};
      url = baseurl;
      data.email = $('#email').val();
      data.username = $('#username').val();
      data.password = $('#password').val();
      data.fullname = $('#fullname').val();
      data.passwordrepeat = $('#passwordrepeat').val();
      data.tok = $('#tok').val();
      data.location = url;
      console.log(data.location);
      console.log(document.location);
      post(data, url + 'confirminvitation', function (data) {
        console.log('DATATATATATATAT ' + data);
        if (data.success) {
          window.location = url + 'login?act=ok';
        } else {
          console.log('HHHHHHHHHHHHHHHHHH' + data.error);
          $('#wrapper').find('.errorRight').remove();
          $('#formEtherpadConfirm input').each(function () {
            if ($(this).is('#email') && (data.error == 'No valid E-Mail' || data.error == 'You need a valid invitation')) {
              $(this).before('<div class="errorRight"><span class="arrowRight errorUp error"></span>><span class="errorUp error" lang="en">' + data.error + '</span></div>');
            }
            if ($(this).is('#username') && (data.error == 'Username not available' || data.error == 'Username must contain Alphanumeric chars')) {
              $(this).before('<div class="errorRight"><span class="arrowRight"></span>><span class="errorUp error" lang="en">' + data.error + '</span></div>');
            }

            if ($(this).is('#password') && (data.error == 'Passwords do not match' || data.error == 'Password is empty')) {
              $(this).after('<div class="errorRight"><span class="arrowRight"></span><span class="errorUp error" lang="en">' + data.error + '</span></div>');
            }
            if ($(this).is('#password') && data.error == 'Password') {
              $(this).before('<div class="errorRight"><span class="arrowRight"></span><span class="errorUp error" lang="en">Password must be at least 12 characters long </span></div>');
            }
            if ($(this).is('#passwordrepeat') && data.error == 'Passwords do not match') {
              $(this).after('<div class="errorRight"><span class="arrowRight"></span>><span class="errorUp error" lang="en">' + data.error + '</span></div>');
            }
          });
          if (data.error == 'Unable to activate user') {
            $('#formEtherpadConfirm').after('<div class="errorRight"><span class="arrowRight"></span><span class="errorUp error" lang="en">' + data.error + '</span></div>');
          }
        }
      });
    });
  });

  $('select#changeRole').on('change', function () {
    $(this).after("<span class='updatestatus inprogress'>Loading</span>");
    var data = {};
    data.userid = $(this).data('userid');
    data.groupId = $(this).data('groupid');
    data.newrole = $(this).val();
    data.baseurl = $('#baseurl').val();
    var loc = document.location;
    post(data, data.baseurl + '/updateUserRole', function (data) {
      if (data.success) {
        $('span.updatestatus').addClass('success').html('Role changed').delay(2000).fadeOut(1000);
      } else {
        console.log(data.error);
        $('span.updatestatus').addClass('error').html(data.error).delay(2000).fadeOut(1000);
      }
    });

    console.log('Sata are ' + data);
  });

  $('option.newrole').each(function () {
    var roleid = $(this).val();
    var textrole = userRole(Number(roleid));

    $(this).html('');
    $(this).html(textrole);
  });

  $('td.userGroupRole').each(function () {
    var roleid = $(this).data('usergrouprole');

    var textrole = userRole(roleid);
    var span = $(this).find('.textrole');
    $(span).addClass(textrole);
    $(span).html('');
    $(span).html(textrole);
  });

  $(':input').each(function () {
    $(this).removeAttr('readonly');
  });

  $('.deletePad').click(function () {
    $('#wrapper').append('<div id="overlay"></div>');
    $('#wrapper').append('<div id="lightBox"><div id="lightBoxHeader"><span' + ' class="close"><i class="demo-icon icon-cancel-circled-outline">&#xe802;</i>' + '</span></div><div id="lightBoxMain"><div class="headline">' + '<h1 lang="en" class="red">Delete "' + $(this).data('padname') + '"' + '</h1></div><div class="content"><button lang="en" class="marginRight" id="deletePadButton"' + 'data-padname="' + $(this).data('padname') + '" data-groupid="' + $(this).data('groupid') + '">' + 'Delete</button><button lang="en" id = "cancelDelete">Cancel</button></div></div></div>');
    $('#lightBox').css('margin-top', -$('#lightBox').height() / 2);

    $('.close').click(function () {
      $('#overlay').remove();
      $('#lightBox').remove();
    });
    $('#cancelDelete').click(function () {
      console.log('clicked');
      $('#overlay').remove();
      $('#lightBox').remove();
    });

    $('#deletePadButton').click(function () {
      console.log('clicked delete here');
      var data = {};
      getBaseURL(2, function (baseurl) {
        var loc = document.location;
        url = baseurl;
        data.groupId = $('#deletePadButton').data('groupid');
        data.padName = $('#deletePadButton').data('padname');
        console.log(data);

        $.ajax({
          type: 'POST',
          data: JSON.stringify(data),
          contentType: 'application/json',
          url: url + 'deletePad',
          success: function (data) {
            if (data.success) {
              window.location = loc;
            } else {
              console.log(data.error);
            }
          },
          error: function (xhr, ajaxOptions, thrownError) {
            console.log(thrownError);
            console.log('WTH');
          },
        });
      });
    });
  });
});
