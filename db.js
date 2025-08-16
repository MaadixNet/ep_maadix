var settings = require('ep_etherpad-lite/node/utils/Settings');
const mysql = require('mysql2/promise');
var dbAuth = settings.dbSettings;
var dbAuthParams = {
  host: dbAuth.host,
  user: dbAuth.user,
  password: dbAuth.password,
  database: dbAuth.database,
  insecureAuth: true,
  stringifyObjects: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0

};
const pool = mysql.createPool(dbAuthParams);
module.exports = { pool };
