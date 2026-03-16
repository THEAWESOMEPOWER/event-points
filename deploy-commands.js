require('dotenv').config();
console.log('Loaded TOKEN:', process.env.TOKEN ? '✅ yes' : '❌ no');

const { REST, Routes } = require('discord.js');
const fs = require('fs');

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;
const rest = new REST({ version: '10' }).setToken(TOKEN);

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (!command.data) {
    console.warn(`⚠️ Skipping ${file}: missing "data"`);
    continue;
  }
  commands.push(command.data.toJSON());
}

(async () => {
  try {
    console.log(`🧹 Clearing old commands...`);
    // Delete all global commands
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
    // Delete all guild commands
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });

    console.log(`✅ Old commands removed.`);
    console.log(`📦 Deploying ${commands.length} new guild commands...`);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });

    console.log('✅ Successfully deployed new commands!');
  } catch (err) {
    console.error('❌ Error:', err);
  }
})();

