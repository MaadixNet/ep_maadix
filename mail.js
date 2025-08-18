const nodemailer = require('nodemailer');
const os = require('os');
const settings = require('ep_etherpad-lite/node/utils/Settings');
const ueberdb = require('ueberdb2'); // Etherpad uses ueberdb for DB access
// Async function to get email transporter
async function mailTransporterAsync() {

const db = await getDB();
  let eMailAuth = {};

  // 1. Try to load config from email.json
  try {
    eMailAuth = require(__dirname + '/email.json');
    console.log('Email config loaded from file');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('Email config file not found, trying DB...');
      // 2. Try to load config from DB
      try {
        eMailAuth = await db.get('email:config');
        if (!eMailAuth) {
          console.log('Email config not found in DB, using fallback...');
          eMailAuth = null;
        } else {
          console.log('Email config loaded from DB');
        }
      } catch (dbErr) {
        console.error('Error loading email config from DB:', dbErr);
        eMailAuth = null;
      }
    } else {
      console.log("No email configs found");
      //throw err; // Re-throw unexpected errors
    }
  }

  // 3. If no config found, fallback to etherpad@FQDN
  if (!eMailAuth) {
    
    const fqdn = os.hostname(); // gets FQDN (hostname -f)
    eMailAuth = {
      smtp: 'false', // use sendmail
      user: `etherpad@${fqdn}`,
      
    };
  }

  // 4. Create transporter depending on config
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

// Helper: get DB instance
async function getDB() {
  return new Promise((resolve, reject) => {
    const db = new ueberdb.Database(settings.dbType, settings.dbSettings, {});
    db.init((err) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}

module.exports = mailTransporterAsync;

async function setMailConfig(data) {
const db = await getDB();
await db.set('email:config', {
  smtp: data.smtp,
  host: data.host,
  port: data.pot,
  ssl: data.ssl,
  tls: data.tls,
  user: data.user,
  password: data.password
});
}
module.exports = setMailConfig;

