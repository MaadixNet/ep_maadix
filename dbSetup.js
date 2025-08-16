const { pool } = require('./db');

exports.pluginInstall = async function (hookName, context) {
  try {
    // Verificar y modificar la columna confirmationString si es necesario
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

    // Verificar y modificar la columna value en Settings si es necesario
    const [settingsCols] = await pool.query("SHOW COLUMNS FROM `Settings` LIKE 'value'");
    if (settingsCols.length > 0) {
      const col = settingsCols[0];
      const typeMatch = col.Type.match(/int/i);
      if (typeMatch) {
        console.log("Actualizando Settings.value a VARCHAR(255)");
        await pool.query(
          "ALTER TABLE `Settings` MODIFY `value` VARCHAR(255) COLLATE utf8_bin"
        );
      }
    }

    // Crear tablas adicionales si no existen
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

    // Insertar configuraciones por defecto si no existen
    const defaults = [
      { key: 'register_enabled', value: '1' },
      { key: 'public_pads', value: '1' },
      { key: 'recover_pw', value: '1' }
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
