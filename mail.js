const nodemailer = require('nodemailer');
const os = require('os');
// Async function to get email transporter
async function mailTransporterAsync() {
  let eMailAuth = null;

  // 1. Try to load config from email.json
  try {
    eMailAuth = require(__dirname + '/email.json');
    console.log('Email config loaded from file');
  } catch (err) {
    console.log('Email config file not found,using default...');
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
  if (eMailAuth.smtp === 'true') {
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
  return nodemailer.createTransport({
    sendmail: true,
    newline: 'unix',
    path: '/usr/sbin/sendmail',
  });
}

module.exports = mailTransporterAsync;
