const { pool } = require('./db');

exports.expressPreSession = async function (hookName, context) {
  console.log("ep_maadix: *******Upgrading database structure********");
  // 
  try {
    const [tables] = await pool.query("SHOW TABLES LIKE 'User'");
    if (tables.length > 0) {
    const [userCols] = await pool.query("SHOW COLUMNS FROM `User` LIKE 'confirmationString'");
    if (userCols.length > 0) {
      const col = userCols[0];
      const lengthMatch = col.Type.match(/varchar\((\d+)\)/i);
      if (lengthMatch && parseInt(lengthMatch[1], 10) < 255) {
        console.log("Actualizando User.confirmationString a VARCHAR(255)");
        await pool.query(
          "ALTER TABLE `User` MODIFY `confirmationString` VARCHAR(255) COLLATE utf8_bin"
        );
      }
    }
    } else {
    // else, create table User
await pool.query(`
  CREATE TABLE IF NOT EXISTS \`User\` (
    \`userID\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(255) COLLATE utf8_bin NOT NULL DEFAULT '',
    \`email\` varchar(255) NOT NULL,
    \`password\` varchar(255) COLLATE utf8_bin DEFAULT NULL,
    \`confirmed\` tinyint(11) DEFAULT NULL,
    \`FullName\` varchar(255) COLLATE utf8_bin DEFAULT NULL,
    \`confirmationString\` varchar(255) COLLATE utf8_bin DEFAULT NULL,
    \`salt\` varchar(255) COLLATE utf8_bin DEFAULT NULL,
    \`active\` int(1) DEFAULT NULL,
    PRIMARY KEY (\`userID\`, \`name\`)
  );
`);
console.log("[ep_maadix] - Table User created");
	}
  } catch (err) {
    console.error("Error Updating table User . It may not exists. Skipping :", err);
  }
    try {
await pool.query(`
  CREATE TABLE IF NOT EXISTS \`Settings\` (
    \`key\` varchar(255) COLLATE utf8_bin NOT NULL,
    \`value\` int(11) NOT NULL,
    PRIMARY KEY (\`key\`)
  );
`);
    // Create GroupPads\
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`GroupPads\` (
        \`GroupID\` int(11) NOT NULL,
        \`PadName\` varchar(255) COLLATE utf8_bin NOT NULL,
        PRIMARY KEY (\`GroupID\`,\`PadName\`)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`Groups\` (
        \`groupID\` int(11) NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) COLLATE utf8_bin NOT NULL DEFAULT '',
        PRIMARY KEY (\`groupID\`,\`name\`)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`UserGroup\` (
        \`userID\` int(11) NOT NULL DEFAULT '0',
        \`groupID\` int(11) NOT NULL DEFAULT '0',
        \`Role\` int(11) DEFAULT NULL,
        PRIMARY KEY (\`userID\`,\`groupID\`)
      )
    `);

    // Insert default config if do no exists
    const defaults = [
      { key: 'register_enabled', value: 1 },
      { key: 'public_pads', value: 1 },
      { key: 'recover_pw', value: 1 }
    ];

    for (const setting of defaults) {
      await pool.query(
        "INSERT IGNORE INTO `Settings` (`key`, `value`) VALUES (?, ?)",
        [setting.key, setting.value]
      );
    }

    console.log("Database structure created");
  } catch (err) {
    console.error("Error setting database structure in ep_maadix:", err);
  }
};
