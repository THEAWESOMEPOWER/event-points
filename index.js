const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const express = require('express');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.commands = new Collection();

/* -----------------------------
   Load Commands
------------------------------*/
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

/* -----------------------------
   Handle Slash Commands
------------------------------*/
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: '❌ There was an error executing this command!'
      });
    } else {
      await interaction.reply({
        content: '❌ There was an error executing this command!',
        ephemeral: true
      });
    }
  }
});

/* -----------------------------
   Bot Ready
------------------------------*/
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* -----------------------------
   Simple Render Health Route
------------------------------*/
app.get('/', (req, res) => {
  res.send('🤖 Discord bot is running!');
});

/* -----------------------------
   Optional Debug Endpoint
------------------------------*/
app.get('/status', (req, res) => {
  res.json({
    bot: client.user ? client.user.tag : "Not logged in",
    uptime: process.uptime(),
    commands: client.commands.size
  });
});

/* -----------------------------
   Start Web Server
------------------------------*/
app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

/* -----------------------------
   Login
------------------------------*/
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error('ERROR: No bot token provided!');
  process.exit(1);
}

client.login(TOKEN);
