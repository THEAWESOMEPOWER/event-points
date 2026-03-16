const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.commands = new Collection();

// Load commands
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// Handle interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    // IMPORTANT: prevent double replies
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

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Use environment variable if exists, otherwise fallback to hardcoded token
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error('ERROR: No bot token provided!');
  process.exit(1);
}

client.login(TOKEN);
