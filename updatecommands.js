require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

const rest = new REST({ version: '10' }).setToken(TOKEN);

// Name of the command you want to update
const commandName = 'getinfo'; // <-- change this to any command you want

(async () => {
  try {
    console.log(`🔎 Reading command "${commandName}"...`);

    // Find the command file
    const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
    const file = commandFiles.find(f => f.replace('.js', '') === commandName);

    if (!file) return console.error(`❌ Command file "${commandName}.js" not found in ./commands`);

    const commandFile = require(`./commands/${file}`);

    if (!commandFile.data) return console.error(`❌ Command "${commandName}" is missing "data"`);

    console.log(`🌐 Fetching guild commands...`);
    const guildCommands = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID));

    // Check if command already exists
    const existing = guildCommands.find(c => c.name === commandName);

    if (!existing) {
      console.log(`⚠️ Command "${commandName}" not found. Creating...`);
      await rest.post(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: commandFile.data.toJSON()
      });
      console.log(`✅ Command "${commandName}" created!`);
    } else {
      console.log(`✏️ Command "${commandName}" found. Updating...`);
      await rest.patch(Routes.applicationGuildCommand(CLIENT_ID, GUILD_ID, existing.id), {
        body: commandFile.data.toJSON()
      });
      console.log(`✅ Command "${commandName}" updated!`);
    }

  } catch (err) {
    console.error('❌ Error:', err);
  }
})();
