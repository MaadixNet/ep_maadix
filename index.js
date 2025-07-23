/* Copyright 2014 Alexander Oberegger
 * Copyright 2017 Pablo Castellano
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

const { check, validationResult } = require('express-validator');
const multer = require('multer');

var path = require('path');
var eejs = require('ep_etherpad-lite/node/eejs');
var padManager = require('ep_etherpad-lite/node/db/PadManager');
var db = require('ep_etherpad-lite/node/db/DB').db;
var groupManager = require(__dirname + '/GroupManager');
var api = require('ep_etherpad-lite/node/db/API');
var Changeset = require('ep_etherpad-lite/static/js/Changeset');
var mysql = require('mysql2');
var settings = require('ep_etherpad-lite/node/utils/Settings');
var customError = require('ep_etherpad-lite/node/utils/customError');
var authorManager = require('ep_etherpad-lite/node/db/AuthorManager');
var sessionManager = require('ep_etherpad-lite/node/db/SessionManager');
var crypto = require('crypto');
var pkg = require('./package.json');
// TODO: Remove once updated all forms
//var formidable = require("formidable");
var fs = require('fs');
const util = require('util');

var eMailAuth = require(__dirname + '/email.json');
var dbAuth = settings.dbSettings;
var dbAuthParams = {
  host: dbAuth.host,
  user: dbAuth.user,
  password: dbAuth.password,
  database: dbAuth.database,
  insecureAuth: true,
  stringifyObjects: true,
};

var DEBUG_ENABLED = true;

function getAppBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}${req.baseUrl || ''}`;
}

var log = function (type, message) {
  if (typeof message == 'string') {
    if (type == 'error') {
      console.error(pkg.name + ': ' + message);
    } else if (type == 'debug') {
      if (DEBUG_ENABLED) {
        console.log('(debug) ' + pkg.name + ': ' + message);
      }
    } else {
      console.log(pkg.name + ': ' + message);
    }
  } else console.log(message);
};

var mySqlErrorHandler = function (err) {
  log('debug', 'mySqlErrorHandler');
  // TODO: Review error handling
  var msg;
  if ('fileName' in err && lineNumber in err) {
    msg = 'MySQLError in ' + err.fileName + ' line ' + err.lineNumber + ': ';
  } else {
    msg = 'MySQLError: ';
  }
  if (err.fatal) {
    msg += '(FATAL) ';
  }
  msg += err.message;
  log('error', msg);
};

//const queryAsync = util.promisify(connection.query).bind(connection);
const mysql2 = require('mysql2/promise');

//let conn;
let pool;
/*
async function initConnection() {
  conn = await mysql2.createConnection(dbAuthParams);
}
*/
async function initPoolConnection() {
  pool = await mysql2.createPool(dbAuthParams);
}
// Start database Pool connection
initPoolConnection()
  .then(() => {
    console.log('MySQL Pool connected');
    // Aquí arrancas el servidor o el resto del código
  })
  .catch((err) => {
    console.error('Error connecting to MySQL:', err);
  });

async function userAuthenticatedAsync(req) {
  log('debug', 'userAuthenticated');
  return !!(req.session?.username && req.session?.userId);
}
async function mailTransporterAsync() {
  const nodemailer = require('nodemailer');

  if (eMailAuth.smtp === 'false') {
    return nodemailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: '/usr/sbin/sendmail',
    });
  }

  return nodemailer.createTransport({
    host: eMailAuth.host,
    port: eMailAuth.port,
    secure: eMailAuth.ssl,
    tls: eMailAuth.tls,
    auth: {
      user: eMailAuth.user,
      pass: eMailAuth.password,
    },
  });
}

function getPasswordAsyncVersion() {
  return new Promise((resolve) => {
    getPassword(resolve);
  });
}

async function checkIfUserExistsAsync(sql, params) {

  //const result =await queryAsync(sql, params);
  const result = await pool.query(sql, params);
  return result.length > 0;
}

const { randomBytes } = require('crypto');

async function createSaltAsync(length = 16) {
  return (await randomBytes(length)).toString('hex');
}

async function getLastInsertIdAsync() {
  //const conn = await mysql2.createConnection(dbAuthParams);
  const [rows] = await pool.query('SELECT LAST_INSERT_ID() as id');
  //await conn.end();
  return rows[0].id;
}

function addUserToEtherpadAsync(userName) {
  return new Promise((resolve, reject) => {
    try {
      const author = authorManager.createAuthorIfNotExistsFor(userName, null);
      if (author === null) {
        reject(new Error('Error creating user in Etherpad'));
      } else {
        resolve(author);
      }
    } catch (err) {
      reject(err);
    }
  });
}

async function getOneValueSqlAsync(query, values) {
  const [rows] = await pool.query(query, values);
  return rows.length > 0 ? rows[0] : null;
}
async function registerInvitedUserAsync(user) {
  const salt = await createSaltAsync(); // Make sure we receive a Promise
  const encrypted = await encryptPasswordAsync(user.password, salt); // También debería ser async

  const updateQuery = `
    UPDATE User 
    SET name = ?, password = ?, confirmed = 1, FullName = ?, salt = ?, active = 1 
    WHERE email = ?
  `;

  try {
    const [result] = await pool.query(updateQuery, [user.username, encrypted, user.fullname, salt, user.email]);

    if (result.affectedRows === 0) {
      throw new Error('Unable to activate user');
    }
    return { success: true, error: null };
  } catch (err) {
    mySqlErrorHandler(err);
    throw new Error('Unable to activate user');
  }
}

async function encryptPasswordAsync(password, salt) {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

async function getAllSqlAsync(sql, params = []) {
  log('debug', 'getAllSql');
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    mySqlErrorHandler(error);
    throw error; // opcional, por si quieres capturarlo más arriba
  }
}
/*
| public_pads      |     1 |
| recover_pw       |     1 |
| register_enabled |     1 |
*/

async function getPadsSettingsAsync() {
  const getSettingsSql = 'SELECT * FROM Settings';
  const settings = {};

  try {
    const [rows] = await pool.query(getSettingsSql);
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  } catch (error) {
    mySqlErrorHandler(error);
    throw error; // por si quieres manejarlo más arriba
  }
}
async function getPadsOfGroupAsync(groupId, padname = '') {
  log('debug', 'getPadsOfGroupAsync');
  try {
    const [rows] = await pool.query('SELECT * FROM GroupPads WHERE GroupPads.GroupID = ?', [groupId]);

    const allPads = [];

    for (const foundPad of rows) {
      const name = foundPad.PadName;
      if (!name) continue;

      log('debug', 'pad name ' + name);

      const group = await getEtherpadGroupFromNormalGroupAsync(groupId); 

      const padId = `${group}$${name}`;
      const origPad = await padManager.getPad(padId);

      if (!origPad) {
        throw new customError('Error retrieving pad list', 'ep_maadix');
      }

      const resultObject = await api.getLastEdited(padId);
      const lastEdited = resultObject.lastEdited;

      allPads.push({
        name,
        lastedit: converterPad(lastEdited),
        timestampedit: lastEdited
      });
    }

    return allPads;

  } catch (error) {
    mySqlErrorHandler(error);
    throw error;
  }
}
async function getEtherpadGroupFromNormalGroupAsync(id) {
  try {
    const query = 'SELECT * FROM store WHERE store.key = ?';
    const [rows] = await pool.query(query, [`mapper2group:${id}`]);

    if (rows.length === 0) {
      throw new Error(`No mapping found for group ID: ${id}`);
    }

    return rows[0].value.replace(/"/g, '');
  } catch (error) {
    mySqlErrorHandler(error);
    throw error;
  }
}
async function getUserAsync(userId) {
  log('debug', 'getUser');
  const sql = 'SELECT * FROM User WHERE userID = ?';
  try {
    const user = await getOneValueSqlAsync(sql, [userId]);
    return user;
  } catch (error) {
    log('error', `Error in getUserAsync: ${error.message}`);
    throw error;
  }
}

async function getGroupAsync(groupId) {
  log('debug', 'getGroup');
  const sql = 'SELECT * FROM Groups WHERE groupID = ?';
  try {
    const group = await getOneValueSqlAsync(sql, [groupId]);
    return group;
  } catch (error) {
    log('error', `Error in getGroupAsync: ${error.message}`);
    throw error;
  }
}

async function getUserGroupAsync(groupId, userId) {
  log('debug', 'getUserGroup');
  const sql = 'SELECT * FROM UserGroup WHERE groupID = ? AND userID = ?';
  try {
    const userGroup = await getOneValueSqlAsync(sql, [groupId, userId]);
    return userGroup;
  } catch (error) {
    log('error', `Error in getUserGroupAsync: ${error.message}`);
    throw error;
  }
}
async function getUsersOfGroupAsync(groupId, userId) {
  const sql = `
    SELECT 
      User.name, 
      User.email, 
      User.active, 
      User.FullName, 
      User.userID, 
      UserGroup.Role 
    FROM User 
    LEFT JOIN UserGroup ON (UserGroup.userID = User.userID) 
    WHERE (UserGroup.groupID = ? AND UserGroup.userID NOT LIKE ?);
  `;

  try {
    const [rows] = await pool.query(sql, [groupId, userId]);
    return rows.filter(user => user.name !== '');
  } catch (err) {
    mySqlErrorHandler(err);
    return [];
  }
}
async function deletePadFromEtherpadAsync(name, groupId) {
  const group = await getEtherpadGroupFromNormalGroupAsync(groupId);
  await padManager.removePad(`${group}$${name}`);
  log('debug', 'Pad deleted');
}
/*
process.on('SIGINT', async () => {
  console.log('closing connexion...');
  await conn.end();
  process.exit(0);
});
*/


function getRandomNum(lbound, ubound) {
  return Math.floor(Math.random() * (ubound - lbound)) + lbound;
}

function getRandomChar(number, lower, upper, other, extra) {
  var numberChars = '0123456789';
  var lowerChars = 'abcdefghijklmnopqrstuvwxyz';
  var upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var otherChars = '`~!@#$%^&*()-_=+[{]}\|;:\'",<.>/? ';
  var charSet = extra;
  if (number == true) charSet += numberChars;
  if (lower == true) charSet += lowerChars;
  if (upper == true) charSet += upperChars;
  if (other == true) charSet += otherChars;
  return charSet.charAt(getRandomNum(0, charSet.length));
}

function setSetting(key, value, cb) {
  log('debug', 'set setting ' + key + ' to value ' + value);
  var setSettingsSql = 'UPDATE Settings SET Settings.value = ? WHERE Settings.key = ?';
  var setSettingsQuery = connection2.query(setSettingsSql, [value, key]);

  setSettingsQuery.on('error', function (err) {
    mySqlErrorHandler(err);
    var retval = {
      success: false,
    };
    cb(retval);
  });
  setSettingsQuery.on('end', function () {
    var retval = {
      success: true,
    };
    cb(retval);
  });
}
/*
| public_pads      |     1 |
| recover_pw       |     1 |
| register_enabled |     1 |
*/

async function asyncDeleteGroup(id) {
  try {
    const group = await getEtherpadGroupFromNormalGroupAsync(id);
    await groupManager.deleteGroup(group);
    log('debug', 'Group deleted');
    return true;
  } catch (err) {
    log('error', 'Something went wrong while deleting group from etherpad');
    log('error', err);
    return false;
  }
}

function mapAuthorWithDBKey(mapperkey, mapper, callback) {
  //try to map to an author
  db.get(mapperkey + ':' + mapper, function (err, author) {
    if (err) {
      callback(err);
      return;
    }
    //there is no author with this mapper, so create one
    if (author == null) {
      authorManager.createAuthor(null, function (err, author) {
        if (err) {
          callback(err);
          return;
        }

        //create the token2author relation
        db.set(mapperkey + ':' + mapper, author.authorID);

        //return the author
        callback(null, author);
      });
    }
    //there is a author with this mapper
    else {
      //update the timestamp of this author
      db.setSub('globalAuthor:' + author, ['timestamp'], new Date().getTime());

      //return the author
      callback(null, { authorID: author });
    }
  });
}

function deleteUserFromEtherPad(userid, cb) {
  mapAuthorWithDBKey('mapper2author', userid, function (err, author) {
    db.remove('globalAuthor:' + author.authorID);
    var mapper2authorSql = 'DELETE FROM store where store.key = ?';
    var mapper2authorQuery = connection2.query(mapper2authorSql, ['mapper2author:' + userid]);
    mapper2authorQuery.on('error', mySqlErrorHandler);
    mapper2authorQuery.on('end', function () {
      var token2authorSql = "DELETE FROM store where store.value = ? and store.key like 'token2author:%'";
      var token2authorQuery = connection2.query(token2authorSql, ['"' + author.authorID] + '"');
      token2authorQuery.on('error', mySqlErrorHandler);
      token2authorQuery.on('end', function () {
        log('debug', 'User deleted');
        cb();
      });
    });
  });
}


const userAuthentication = async function (username, password) {
  log('debug', 'userAuthentication');

  const userSql = 'SELECT * FROM User WHERE User.email = ? OR User.name = ?';
  let userFound = false;
  let confirmed = false;
  let active = true;

  try {
    const [rows] = await pool.query(userSql, [username, username]);

    if (rows.length === 0) {
      // No user found
      return { success: false, user: null, userFound: false, confirmed: false, active: false };
    }

    const foundUser = rows[0];
    userFound = true;
    confirmed = foundUser.confirmed;
    active = foundUser.active;

    const encrypted = await encryptPasswordAsync(password.toString(), foundUser.salt);

    if (foundUser.password === encrypted && confirmed && active) {
      // Valid user
      return { success: true, user: foundUser, userFound, confirmed, active };
    } else {
      // User exists, but credentials or status don't match
      return { success: false, user: null, userFound, confirmed, active };
    }
  } catch (error) {
    mySqlErrorHandler(error);
    return { success: false, user: null, userFound: false, confirmed: false, active: false };
  }
};

function sendError(error, res) {
  var data = {};
  data.success = false;
  data.error = error;
  log('error', error);
  res.send(data);
}

function updateSql(sqlUpdate, params, cb) {
  log('debug', 'updateSql');
  var updateQuery = connection.query(sqlUpdate, params);
  updateQuery.on('error', mySqlErrorHandler);
  updateQuery.on('end', function () {
    cb(true);
  });
}

// Add routes to Express app
exports.expressCreateServer = function (hook_name, args, cb) {
  const express = require('express');
  args.app.use(express.urlencoded({ extended: true }));

// Redirect url with final slash to none slash
args.app.use((req, res, next) => {
  if (req.path !== '/' && req.path.endsWith('/')) {
    const query = req.url.slice(req.path.length);
    res.redirect(301, req.path.slice(0, -1) + query);
  } else {
    next();
  }
});
// Rediect public pads to etherpad lite pads view
args.app.get('/pads/:id', (req, res) => {
  const id = req.params.id;
  res.redirect(301, `/p/${id}`);
});


  args.app.get('/logout', async (req, res) => {
    req.session.userId = null;
    req.session.username = null;
    const baseurl = req.session.baseurl;
    req.session.baseurl = null;

    res.redirect(baseurl + '/');
  });

  args.app.get('/login', async function (req, res) {
    try {
      let activated = '';
      if (req.query.act) activated = req.query.act;
      log('debug', activated);

      const settings = await getPadsSettingsAsync();
      const authenticated = await userAuthenticatedAsync(req);

      if (authenticated) {
        return res.redirect(req.session.baseurl + '/dashboard');
      }

      const render_args = {
        errors: [],
        activated: activated,
        settings: settings,
      };

      res.send(eejs.require('ep_maadix/templates/login2.ejs', render_args));
    } catch (err) {
      console.error('Error en GET /login:', err);
      res.status(500).send('Internal Server Error');
    }
  });
  args.app.post('/login', async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    var activated = '';
    var settings = getPadsSettingsAsync();
    var render_args = {
      errors: [],
      settings: settings,
      activated,
    };

    const result = await userAuthentication(email, password);
    console.log('RES', result);
    if (result.success) {
      req.session.userId = result.user.userID;
      req.session.username = result.user.name;
      req.session.baseurl = getAppBaseUrl(req);
      res.redirect(`${getAppBaseUrl(req)}` + '/dashboard');
      return;
    } else {
      if (result.userFound && !result.active == 1) {
        render_args.errors.push('User is inactive');
      } else if (result.userFound && !result.confirmed == 1) {
        render_args.errors.push('You have to confirm your registration first!');
      } else {
        render_args.errors.push('Wrong user or password!');
      }
    }
    console.log('·····················3' + render_args.errors);
    res.send(eejs.require('ep_maadix/templates/login2.ejs', render_args));
  });

  args.app.get('/register', async (req, res) => {
    try {
      const settings = await getPadsSettingsAsync();
      console.log(settings.register_enabled);

      const authenticated = await userAuthenticatedAsync(req);

      if (authenticated) {
        return res.redirect(req.session.baseurl + '/dashboard');
      }

      const render_args = {
        errors: [],
        settings: settings,
      };

      res.send(eejs.require('ep_maadix/templates/register.ejs', render_args));
    } catch (err) {
      console.error('Error en /register:', err);
      res.status(500).send('Internal Server Error');
    }
  });

  args.app.post('/register', [check('userEmail').isEmail().trim().escape()], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendError('Invalid input data', res);
      }

      const userEmail = req.body.userEmail;
      const baseUrl = getAppBaseUrl(req); // aquí sacás la url base directamente

      const exists = await checkIfUserExistsAsync('SELECT * FROM User WHERE email = ?', [userEmail]);
      if (exists) {
        return sendError('An account already exists with this Email address', res);
      }

      const salt = await createSaltAsync();
      const consString = await getPasswordAsyncVersion();

      //await queryAsync('INSERT INTO User VALUES(null, ?, ?, null, 0, null, ?, ?, 0)', [userEmail, userEmail, consString, salt]);
      await pool.query('INSERT INTO User VALUES(null, ?, ?, null, 0, null, ?, ?, 0)', [userEmail, userEmail, consString, salt]);
      const insertedUserId = await getLastInsertIdAsync();
      const mappedUser = await addUserToEtherpadAsync(insertedUserId);

      if (!mappedUser) {
        return sendError('Error adding user to Etherpad', res);
      }

      const confirmUrl = `${baseUrl}/confirm/${consString}`;
      let msg = eMailAuth.registrationtext.replace(/<url>/, confirmUrl);

      const message = {
        text: msg,
        from: eMailAuth.invitationfrom,
        to: `${userEmail} <${userEmail}>`,
        subject: eMailAuth.registrationsubject,
      };

      const transporter = await mailTransporterAsync();

      await transporter.sendMail(message);

      res.send({ success: true, error: false });
    } catch (error) {
      console.error('[register] Error:', error);
      sendError('Error processing registration', res);
    }
  });
  args.app.get('/recover', async (req, res) => {
    try {
      const settings = await getPadsSettingsAsync();
      const authenticated = await userAuthenticatedAsync(req);

      if (authenticated) {
        return res.redirect(req.session.baseurl + '/dashboard');
      }

      const render_args = {
        errors: [],
        settings: settings,
      };

      res.send(eejs.require('ep_maadix/templates/recover.ejs', render_args));
    } catch (err) {
      console.error('Error en /recover:', err);
      res.status(500).send('Internal Server Error');
    }
  });

  args.app.get('/reset/:token', async (req, res) => {
    var render_args = {};
    var tok;
    const settings = await getPadsSettingsAsync();
    const authenticated = await userAuthenticatedAsync(req);

    if (authenticated) {
      res.redirect(req.session.baseurl + '/dashboard');
    } else {
      var render_args = {
        errors: [],
        tok: req.params.token,
        settings: settings,
      };
      res.send(eejs.require('ep_maadix/templates/reset.ejs', render_args));
    }
  });

  args.app.post('/recover', [check('userEmail').isEmail().trim()], async (req, res) => {
    const errors = validationResult(req);
    const userEmail = req.body.userEmail;

    if (!errors.isEmpty()) {
      console.log('RTRTRTRT', errors);
      return sendError('Email is not valid!', res);
    }

    try {
      const userExists = await checkIfUserExistsAsync('SELECT * FROM User WHERE email = ?', [userEmail]);

      if (!userExists) {
        return sendError('This account does not exist', res);
      }

      const confirmationString = await getPasswordAsyncVersion();

      //await queryAsync('UPDATE User SET confirmationString = ? WHERE email = ?', [confirmationString, userEmail]);
      await pool.query('UPDATE User SET confirmationString = ? WHERE email = ?', [confirmationString, userEmail]);

      const resetUrl = `${getAppBaseUrl(req)}/reset/${confirmationString}`;
      const msgText = eMailAuth.pswdresetmsg.replace(/<url>/, resetUrl);

      const message = {
        text: msgText,
        from: eMailAuth.invitationfrom,
        to: `${userEmail} <${userEmail}>`,
        subject: eMailAuth.pswdresetsubject,
      };

      const transporter = await mailTransporterAsync();

      await transporter.sendMail(message);

      res.send({ success: true, message: 'Correo enviado con éxito (async)' });
    } catch (error) {
      console.error('Error en /recoverAsync:', error);
      sendError('Error al procesar la solicitud de recuperación.', res);
    }
  });

  args.app.post(
    '/resetpsw',
    [
      check('email').isEmail().trim().withMessage('Email is not valid!'),
      check('password').isLength({ min: 12 }).withMessage('Password must be at least 12 characters long '),
      check('passwordrepeat').custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendError(errors.array()[0].msg, res);
        //return sendError('Invalid input data', res);
      }

      const userEmail = req.body.email;
      const password = req.body.password;
      const tok = req.body.tok;
      try {
        var sql = 'SELECT * from User where User.email = ? AND confirmationString = ?';
        const exists = await checkIfUserExistsAsync(sql, [userEmail, tok]);
        console.log('ERRRRRRR', exists);
        if (!exists) {
          sendError('You cannot reset password for this email account', res);
          return;
        } else {
          var addUserSql = '';
          var salt = await createSaltAsync();
          var encrypted = await encryptPasswordAsync(password, salt);
          //var consString = await  createSaltAsync();
          /* Fields in User table are:u<<serID, name, email, password, confirmed, FullName, confirmationString, salt, active*/
          addUserSql = 'Update User SET confirmationString = ?, password = ?, salt = ? WHERE email = ?';
          const success = await pool.query(addUserSql, ['', encrypted, salt, userEmail]);
          if (success) {
            var data = {};
            data.success = success;
            console.log('DATATATATA ' + data);
            res.send(data);
          }
        }
      } catch (err) {
        console.error(err);
        sendError('Unexpected error during confirmation', res);
      }
    }
  );

  args.app.get('/group/:groupid', async (req, res) => {
    const settings = await getPadsSettingsAsync();
    const authenticated = await userAuthenticatedAsync(req);

    if (authenticated) {
    try {
    // Check if group exists
    const currGroup = await getGroupAsync(req.params.groupid);
    // Check if user is in group
    const pads = await getPadsOfGroupAsync(req.params.groupid);
    const currUser = await getUserAsync(req.session.userId);
    console.log("currUser. " + currUser.name )
    // Check if current user is in group
    const currUserGroup = await getUserGroupAsync(req.params.groupid, req.session.userId);
    console.log("currUserGroup " + currUserGroup);
    var render_args;
    if (currGroup && currUser && currUserGroup != null) {
      render_args = {
                      errors: [],
                      id: currGroup.name,
                      groupid: currGroup.groupID,
                      userid: req.session.userId,
                      username: req.session.username,
                      role: currUserGroup.Role,
                      pads: pads,
                      settings: settings,
                    };
                    res.send(eejs.require('ep_maadix/templates/group.ejs', render_args));
  } else {
    render_args = {
                      errors: [],
                      id: false,
                      groupid: false,
                      userid: req.session.userId,
                      username: req.session.username,
                      baseurl: req.session.baseurl,
                      role: false,
                      pads: false,
                      settings: settings,
                    };
                    res.send(eejs.require('ep_maadix/templates/group.ejs', render_args));
		  }
  } catch (err) {
    console.error("/group/:groupid", err);
    sendError("Internal server error", res);
  }

    } else {
	 res.redirect(`${getAppBaseUrl(req)}` + '/login');
        }
  });

args.app.get('/groupusers/:groupid', async function (req, res) {
  try {
    const settings = await getPadsSettingsAsync(); // Asegurate de tener esta versión async
    const authenticated = await userAuthenticatedAsync(req);


    if (!authenticated) {
	res.redirect(`${getAppBaseUrl(req)}` + '/login');  
    }

    const groupId = req.params.groupid;
    const userId = req.session.userId;

    const users = await getUsersOfGroupAsync(groupId, userId);
  for (let i = 0; i < users.length; i++) {
    console.log(users[i].email);
  }
    const currUser = await getUserAsync(userId);
    const currGroup = await getGroupAsync(groupId);
    const currUserGroup = await getUserGroupAsync(groupId, userId);

    const render_args = {
      errors: [],
      id: currGroup?.name || false,
      groupid: currGroup?.groupID || false,
      userid: userId,
      username: req.session.username,
      baseurl: req.session.baseurl,
      role: currUserGroup?.Role || false,
      users: users || false,
      settings: settings,
    };

    res.send(eejs.require('ep_maadix/templates/groupusers.ejs', render_args));
  } catch (err) {
    console.error('Error en /groupusers/:groupid:', err);
    res.status(500).send('Internal Server Error');
  }

});
  args.app.post('/createGroup', [check('groupName').isLength({ min: 2 }).isAlphanumeric().notEmpty().trim().escape()], async (req, res) => {
  try {
    const authenticated = await userAuthenticatedAsync(req); 
    const data = {};

    if (!authenticated) {
      return res.status(401).send("You are not logged in!!");
    }
    const errors = validationResult(req);
        if (!errors.isEmpty()) {
          sendError('Invalid Group Name. Need at least 2  alphanumeric chars.', res);
          return;
        }

    const groupName = req.body.groupName;

    if (!groupName) {
      return sendError("Group Name not defined", res);
    }

    const existGroupSql = "SELECT * FROM Groups WHERE Groups.name = ?";
    const found = await getOneValueSqlAsync(existGroupSql, [groupName]);

    if (found) {
      return sendError("Group already exists", res);
    }

    // Create group
    const addGroupSql = "INSERT INTO Groups VALUES(null, ?)";
    //const groupResult = await queryAsync(addGroupSql, [groupName]);
    const groupResult = await pool.query(addGroupSql, [groupName]);
    const groupId = groupResult.insertId;
    data.groupid = groupId;

    //Link group to user
    const addUserGroupSql = "INSERT INTO UserGroup VALUES(?, ?, 1)";
    //await queryAsync(addUserGroupSql, [req.session.userId, groupId]);
    await pool.query(addUserGroupSql, [req.session.userId, groupId]);

    // Crear grupo Etherpad
    try {
      await groupManager.createGroupIfNotExistsFor(groupId.toString());
    } catch (err) {
      log('error', 'failed to createGroupIfNotExistsFor: ' + err.message);
    }

    data.success = true;
    data.error = null;
    res.send(data);

  } catch (err) {
    console.error("Error in /createGroup:", err);
    sendError("Internal server error", res);
  }
});

args.app.post('/deletePad', async function (req, res) {
  const { groupId, padName } = req.body;
  console.log("GROP " + groupId + "pad "+ padName);
  const data = {};

  try {
    const authenticated = await userAuthenticatedAsync(req);
    if (!authenticated) return res.send('You are not logged in!!');

    if (!groupId) return sendError('Group-Id not defined', res);
    if (!padName) return sendError('Pad Name not defined', res);

    const [userGroup] = await pool
      .query(
        'SELECT * from UserGroup where UserGroup.userId = ? and UserGroup.groupID= ?',
        [req.session.userId, groupId]
      )
      .then(([rows]) => rows);

    if (!userGroup || userGroup.Role >= 3) {
      return sendError('User is not owner! Can not delete Pad', res);
    }

    await getEtherpadGroupFromNormalGroupAsync(groupId);

    await pool
      .query(
        'DELETE FROM GroupPads WHERE GroupPads.PadName = ? and GroupPads.GroupID = ?',
        [padName, groupId]
      );

    await deletePadFromEtherpadAsync(padName, groupId);

    data.success = true;
    data.error = null;
    res.send(data);
  } catch (err) {
    console.error('Error deleting pad:', err);
    sendError('Unexpected error while deleting pad', res);
  }
});

args.app.post('/deleteGroup', async (req, res) => {
  try {
    const authenticated = await userAuthenticatedAsync(req); 
    if (!authenticated) return res.send('You are not logged in!!');

    const { groupId } = req.body;
    if (!groupId) return sendError('Group-Id not defined', res);

    const userGroup = await getAllSqlAsync(
      'SELECT * FROM UserGroup WHERE userID = ? AND groupID = ?',
      [req.session.userId, groupId]
    );

    if (!userGroup || userGroup.length === 0) {
      return sendError('You are not in this Group.', res);
    }

    if (userGroup[0].Role !== 1) {
      return sendError('User is not Owner. Can not delete Group', res);
    }

    // Delete from Groups
    await pool.query('DELETE FROM Groups WHERE groupID = ?', [groupId]);

    // Delete from UserGroup
    await pool.query('DELETE FROM UserGroup WHERE groupID = ?', [groupId]);

    // Delete from GroupPads
    await pool.query('DELETE FROM GroupPads WHERE groupID = ?', [groupId]);

    // Call asyncDeleteGroup
    await asyncDeleteGroup(groupId);

    res.send({
      success: true,
      error: null,
    });
  } catch (error) {
    console.error('Error deleting group:', error);
    sendError('Unexpected error during group deletion', res);
  }
});

args.app.post('/directToPad', async (req, res) => {
  try {
    const { groupId, padname } = req.body;
    const userId = req.session.userId;

    if (!await userAuthenticatedAsync(req)) {
      res.redirect(`${getAppBaseUrl(req)}` + '/login');
    }

    if (!groupId) {
      return sendError('Group-Id not defined', res);
    }

    // Check if user belongs to group
    const [userGroup] = await pool.query(
      'SELECT * FROM UserGroup WHERE userId = ? AND groupID = ?',
      [userId, groupId]
    );

    if (!userGroup.length) {
      return sendError('User not in Group', res);
    }

    // Get pad's group
    const group = await getEtherpadGroupFromNormalGroupAsync(groupId);

    // Creat pad  author 
    const etherpadAuthor = await addUserToEtherpadAsync(userId);
    if (!etherpadAuthor) {
      return sendError('Error creating Etherpad author', res);
    }

    // Create session
    const session = await sessionManager.createSession(
      group,
      etherpadAuthor.authorID,
      Date.now() + 2 * 60 * 60 * 1000 // 2 horas
    );

    const data = {
      success: true,
      session: session.sessionID,
      group: group,
      username: req.session.username,
      pad_name: padname
    };

    console.log(data);
    res.send(data);
  } catch (err) {
    console.error('Error in /directToPad:', err);
    sendError('Unexpected server error', res);
  }
});


args.app.get('/group/:groupID/pad/:padID/?', async (req, res) => {
  try {
    const settings = await getPadsSettingsAsync();

    const authenticated = await userAuthenticatedAsync(req);
    if (!authenticated) return res.redirect(`${getAppBaseUrl(req)}` + '/login');
    const groupID = req.params.groupID;
    const rawPadID = req.params.padID;

    const [,padID] = rawPadID.split('$'); 
    console.log("padIDpadIDpadIDpadIDpadIDpadID" + padID);
    const userID = req.session.userId;

    const currGroup = await getGroupAsync(groupID);
    const currUser = await getUserAsync(userID);
    const [padExists] = await pool.query(
      'SELECT * FROM GroupPads WHERE PadName = ?',
      [padID]
    );

    const foundGroup = currGroup || false;
    const foundUser = currUser; 
    const render_args = {
      errors: [],
      padname: padExists.length ? padID : false,
      userid: userID,
      username: req.session.username,
      baseurl: req.session.baseurl,
      groupID: foundGroup ? groupID : false,
      groupName: foundGroup ? foundGroup.name : false,
      settings,
      padurl: padExists.length ? `${getAppBaseUrl(req)}/p/${rawPadID}` : false,
    };

    res.send(eejs.require('ep_maadix/templates/pad.ejs', render_args));

  } catch (err) {
    console.error('Error in /group/:groupID/pad/:padID:', err);
    res.status(500).send('Server error');
  }
});

  /*Users funtions*/
args.app.get('/confirm/:token', async (req, res) => {
  try {
    const authenticated = await userAuthenticatedAsync(req);
    
    if (authenticated) {
      return res.redirect(`${getAppBaseUrl(req)}`+ '/dashboard');
    }

    const render_args = {
      errors: [],
      tok: req.params.token,
    };

    res.send(eejs.require('ep_maadix/templates/confirm.ejs', render_args));
    
  } catch (err) {
    console.error('Error in /confirm/:token route:', err);
    res.status(500).send('Internal server error');
  }
});
  args.app.post(
    '/confirminvitation',
    [
      check('email').isEmail().withMessage('No valid E-Mail'),
      check('username').notEmpty().isAlphanumeric().trim().escape().withMessage('Username must contain Alphanumeric chars'),
      check('password').notEmpty().isLength({ min: 12 }).withMessage('Password'),
      check('passwordrepeat').custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
    ],
    async function (req, res) {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log(errors.array()[0].msg);
        //res.send(errors.array()[0].msg)
        sendError(errors.array()[0].msg, res);
        return;
      }

      const user = {
        fullname: req.body.fullname,
        email: req.body.email,
        password: req.body.password,
        username: req.body.username,
        tok: req.body.tok,
        location: getAppBaseUrl(req),
      };

      // make sure username is available
      const existing = await getOneValueSqlAsync('SELECT * FROM User WHERE User.name = ? AND User.email NOT LIKE ?', [user.username, user.email]);
      if (existing) {
        sendError('Username not available', res);
        return;
      }

      // Thiss useful when registration is closed. User can still invite others
      const existInvitation = 'SELECT * FROM User WHERE email = ? AND confirmationString = ?';
      try {
        const found = await getOneValueSqlAsync(existInvitation, [user.email, user.tok]);
        if (!found) {
          sendError('You need a valid invitation', res);
          return;
        }

        const { success, error } = await registerInvitedUserAsync(user);
        console.log('SSSSSSSSSSSSSS ' + success);
        if (success) {
          var data = {};
          data.success = success;
          console.log('DATATATATA ' + data);
          res.send(data);
        } else if (error) {
          sendError(error, res);
          return;
        }
      } catch (err) {
        console.error(err);
        sendError('Unexpected error during confirmation', res);
      }
    }
  );
args.app.post('/updateUserRole', async (req, res) => {
  const data = {};
  try {
    const authenticated = await userAuthenticatedAsync(req);
    if (!authenticated) {
     return res.redirect(`${getAppBaseUrl(req)}`+ '/login');
   
    }

    const { groupId, newrole, userid } = req.body;
    const baseurl = `${getAppBaseUrl(req)}`;

    if (!groupId) return sendError('Group-Id not defined', res);
    if (!newrole) return sendError('New Role not defined', res);
    if (!userid) return sendError('User not defined', res);

    const [userGroup] = await pool
      .query(
        'SELECT * FROM UserGroup WHERE userId = ? AND groupID = ?',
        [req.session.userId, groupId]
      );

    if (!userGroup || userGroup.length === 0) {
      return sendError('You are not in this Group.', res);
    }

    if (userGroup[0].Role > newrole) {
      return sendError('You cannot assign a Role higher than yours', res);
    }

    await pool
      .query(
        'UPDATE UserGroup SET Role = ? WHERE groupID = ? AND userID = ?',
        [newrole, groupId, userid]
      );

    data.success = true;
    data.error = null;
    res.send(data);
  } catch (err) {
    console.error('Error in /updateUserRole:', err);
    sendError('Internal server error', res);
  }
});

args.app.get('/user/:userId', async (req, res) => {
  try {
    const data = {};
    const settings = await getPadsSettingsAsync(); 
    const authenticated = await userAuthenticatedAsync(req); 

    if (!authenticated || req.session.userId != req.params.userId) {
      return res.redirect(req.session.baseurl + '/dashboard');
    }

    const user = await getUserAsync(req.session.userId);
    console.log("EEEEEE" + user);
    const render_args = {
      errors: [],
      userid: req.session.userId,
      user: user,
      settings,
      message: '',
    };
    res.send(eejs.require('ep_maadix/templates/user2.ejs', render_args));
  } catch (err) {
    console.error('Error in /user/:userId:', err);
    sendError('Internal server error', res);
  }
});
args.app.post(
  '/user/updateprofile',
  [
    check('email').optional().isEmail().withMessage('No valid E-Mail').trim(),
    check('username').optional().trim(),
    check('password').optional({ checkFalsy: true }).isLength({ min: 12 }).withMessage('Password must be at least 12 characters long '),
    check('userid').exists().withMessage('Missing userid'),
  ],
  async (req, res) => {
    // Validaciones automáticas
    const data ={};
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(errors.array().map(e => e.msg).join(', '), res);
    }

    const { fullname = '', email = '', password = '', passwordrepeat = '', username = '', userid } = req.body;

    if (password !== passwordrepeat) {
      return sendError('Passwords do not match', res);
    }

    // users can only edit their own profile
    if (userid != req.session.userId) {
      return sendError('You are not allowed to edit this user', res);
    }

    try {
      const existingUser = getUserAsync(req.session.userId);
      if (!existingUser) {
        return sendError('Invalid User', res);
      }

      const updatedFullname = fullname || existingUser.FullName;
      const updatedUsername = username || existingUser.name;
      const updatedEmail = email || existingUser.email;

      let updateUserSql = 'UPDATE User SET name = ?, FullName = ?, email = ?';
      const params = [updatedUsername, updatedFullname, updatedEmail];

      if (password) {
        const salt = await createSaltAsync();
        const encrypted = await encryptPasswordAsync(password, salt);
        updateUserSql += ', password = ?, salt = ?';
        params.push(encrypted, salt);
      }

      updateUserSql += ' WHERE userID = ?';
      params.push(req.session.userId);
      data.message = "Profile successfully update";
      await pool.query(updateUserSql, params);
	    data.success = true;
	    data.error = null;
	    res.send(data);
    } catch (err) {
      console.error('Error en /updateprofile:', err);
      sendError('Could not update profile', res);
    }
  }
);
args.app.post('/inviteUsers', async (req, res) => {
  try {
    const authenticated = await userAuthenticatedAsync(req);
    if (!authenticated) return sendError('You are not logged in!', res);

    const baseUrl = getAppBaseUrl(req);
    const { groupId, userEmail, UserRole } = req.body;
    if (!groupId) return sendError('Group ID not defined', res);
    if (!userEmail) return sendError('No User given', res);

    // First check if inviter has prmission to invite
    const userGroup = await getOneValueSqlAsync('SELECT * from UserGroup where UserGroup.userId = ? and UserGroup.groupID= ?', [req.session.userId, groupId]);
    if (!userGroup || userGroup.Role >= 3) return sendError('You can not send invitations to this group', res);
    if (UserRole < 0 || UserRole > 3 || UserRole < userGroup.Role) return sendError('You can not assign a role higher than yours', res);
    // Check if user to be invited is  already in group
    const existSql = 'SELECT * FROM UserGroup WHERE groupID = ? AND userID in (SELECT userID from User where email = ?)';
    const alreadyInvited = await getOneValueSqlAsync(existSql, [ groupId, userEmail]);

    if (alreadyInvited) {
      sendError('User is already invited to this group', res);
      return;
    }

    const currUser = await getUserAsync(req.session.userId);
    const result = await inviteUser(userEmail, groupId, UserRole, currUser.name, baseUrl);

    res.send({ success: true });
    
  } catch (err) {
    console.error('Error in /inviteUsers:', err);
    res.status(500).send({ success: false, error: 'Internal Server Error' });
  }
});

async function inviteUser(userEmail, groupId, UserRole, inviter, baseUrl) {
  try {
    // Get group name
    const query  = 'SELECT name FROM Groups  WHERE groupID = ?';
    const group  = await getOneValueSqlAsync(query, [groupId]);
    const sql = 'SELECT * FROM User WHERE email = ?';
    const user = await getOneValueSqlAsync(sql, [userEmail]);
    let userID;
    let msg;
    let url;
    if (!user) {
    // user does not exists yet and must be creates
    msg = eMailAuth.invitateunregisterednmsg;
    const consString = await getPasswordAsyncVersion();

    url = `${baseUrl}/confirm/${consString}`;
    const [result] = await pool.query(
      'INSERT INTO User VALUES(null, ?, ?, null, 0, null, ?, null, 0)',
      [userEmail, userEmail, consString]
    );
    userID = result.insertId;
    const mappedUser = await addUserToEtherpadAsync(userID);
    if (!mappedUser) {
      throw new Error('Failed to add user to Etherpad');
    }

    } else {
    userID = user.userID;
    msg = eMailAuth.invitationmsg;
    }

    // Add user to group
    // userID | groupID | Role 
    await pool.query(
      'INSERT INTO UserGroup VALUES (?, ?, ?)',
      [userID, groupId, UserRole]
    );
    // Finally send email
    msg = msg.replace(/<groupname>/g, group.name);
    msg = msg.replace(/<fromuser>/g, inviter);
    msg = msg.replace(/<url>/g, url);
      const message = {
        text: msg,
        from: eMailAuth.invitationfrom,
        to: `${userEmail} <${userEmail}>`,
        subject: eMailAuth.invitationsubject
      };

      const transporter = await mailTransporterAsync();
      await transporter.sendMail(message);

  } catch (err) {
    log('error', 'Error in inviteUser:');
    log('error', err);
    return { success: false, error: 'Error inviting user' };
  }
}

args.app.post('/deleteUserFromGroup', async function (req, res) {
  try {
    const authenticated = await userAuthenticatedAsync(req);
    if (!authenticated) {
      res.redirect('/login');
    }

    const { userID, groupID } = req.body;

    if (!userID || !groupID) {
      return sendError('No User ID or Group ID given', res);
    }

    const userGroup = await getOneValueSqlAsync('SELECT * from UserGroup where userId = ? and groupID = ?', [req.session.userId, groupID]);

    if (!userGroup || userGroup.length === 0 || userGroup.Role >= 3) {
      return sendError('You are not allowed to remove users from this group!!', res);
    }

    const success = await pool.query('DELETE FROM UserGroup WHERE userID = ? AND groupID = ?', [userID, groupID]);

    res.send({ success });

  } catch (err) {
    console.error(err);
    sendError('An error occurred while deleting the user from the group.', res);
  }
});

  /*END Users functions*/

args.app.post('/createPad', async function (req, res) {
  try {
    const fields = req.body;

    if (!fields.groupId) {
      return sendError('Group-Id not defined', res);
    }
    if (!fields.padName) {
      return sendError('Pad Name not defined', res);
    }

    const authenticated = await userAuthenticatedAsync(req);
    if (!authenticated) {
	res.redirect('/login');
    }

    const existPadInGroupSql = "SELECT * FROM GroupPads WHERE GroupPads.GroupID = ? AND GroupPads.PadName = ?";
    const found = await getOneValueSqlAsync(existPadInGroupSql, [fields.groupId, fields.padName]);

    if (found || fields.padName.length === 0) {
      return sendError('Pad already Exists', res);
    }

    const addPadToGroupSql = "INSERT INTO GroupPads VALUES(?, ?)";
    const query = await pool.query(addPadToGroupSql, [fields.groupId, fields.padName]);
    res.send({ success: true, error: null });


  } catch (err) {
    log('error', 'Unhandled error in /createPad: ' + err);
    res.status(500).send({ success: false, error: err.toString() });
  }
});

  args.app.get('/home', async (req, res) => {
    try {
      const settings = await getPadsSettingsAsync();
      const authenticated = await userAuthenticatedAsync(req);

      const username = authenticated ? req.session.username : '';
      const userid = authenticated ? req.session.userId : '';

      const render_args = {
        errors: [],
        settings,
        authenticated,
        username,
        userid,
      };

      res.send(eejs.require('ep_maadix/templates/index.ejs', render_args));
    } catch (err) {
      console.error('Error in /home:', err);
      res.status(500).send('Internal Server Error');
    }
  });

  args.app.get('/dashboard', async (req, res) => {
    if (await userAuthenticatedAsync(req)) {
      var settings = await getPadsSettingsAsync();
      var sql = 'Select Groups.*, UserGroup.Role from Groups inner join UserGroup on(UserGroup.groupID = Groups.groupID) where UserGroup.userID = ?';
      var groups = await getAllSqlAsync(sql, [req.session.userId]);
      var render_args = {
        username: req.session.username,
        userid: req.session.userId,
        baseurl: req.session.baseurl,
        groups: groups,
        settings: settings,
      };
      res.send(eejs.require('ep_maadix/templates/dashboard.ejs', render_args));
    } else {
      res.redirect('/login');
    }
  });

  args.app.get('/help', async (req, res) => {
    try {
      const authenticated = await userAuthenticatedAsync(req);

      if (!authenticated) {
        return res.redirect('/login');
      }

      const settings = await getPadsSettingsAsync();

      const render_args = {
        username: req.session.username,
        userid: req.session.userId,
        baseurl: req.session.baseurl,
        settings,
      };

      res.send(eejs.require('ep_maadix/templates/help.ejs', render_args));
    } catch (err) {
      console.error('Error in /help:', err);
      res.status(500).send('Internal Server Error');
    }
  });
  return cb();
};

exports.eejsBlock_adminMenu = function (hook_name, args, cb) {
  var hasAdminUrlPrefix = args.content.indexOf('<a href="admin/') != -1,
    hasOneDirDown = args.content.indexOf('<a href="../') != -1,
    hasTwoDirDown = args.content.indexOf('<a href="../../') != -1,
    urlPrefix = hasAdminUrlPrefix ? 'admin/' : hasTwoDirDown ? '../../' : hasOneDirDown ? '../' : '';
  args.content = args.content + '<li><a href="' + urlPrefix + 'userpadadmin">Users and groups</a> </li>';
  return cb();
};

exports.eejsBlock_indexWrapper = function (hook_name, args, cb) {
  args.content = eejs.require('ep_maadix/templates/index_redirect.ejs');
  return cb();
};
exports.eejsBlock_styles = function (hook_name, args, cb) {
  args.content = args.content + eejs.require('ep_maadix/templates/styles.ejs', {}, module);
  return cb();
};

var converterPad = function (UNIX_timestamp) {
  var a = new Date(UNIX_timestamp);
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var hour = (a.getHours() < 10 ? '0' : '') + a.getHours();
  var min = (a.getMinutes() < 10 ? '0' : '') + a.getMinutes();
  return date + '. ' + month + ' ' + year + ' ' + hour + ':' + min;
};
