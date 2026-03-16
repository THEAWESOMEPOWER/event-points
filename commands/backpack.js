const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backpack')
    .setDescription('Check your backpack or another user’s backpack')
    .addUserOption(option => option.setName('user').setDescription('User to check')),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    try {
      const items = await db.all(
        'SELECT item_name, purchased_at, quantity FROM user_backpack WHERE user_id = ?',
        [targetUser.id]
      );

      if (!items.length) {
        return interaction.reply({
          content: `${targetUser.username}'s backpack is empty!`,
          flags: 64 // EPHEMERAL
        });
      }

      let text = '';
      for (const item of items) {
        const date = new Date(item.purchased_at);
        text += `• **${item.item_name || 'Unknown Item'}** — Purchased on ${date.toLocaleString('en-US', { timeZone: 'America/New_York' })} (x${item.quantity})\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`${targetUser.username}'s Backpack`)
        .setDescription(text)
        .setColor('#00AEEF');

      return interaction.reply({
        embeds: [embed],
        flags: 64 // EPHEMERAL ( stays in SERVER, private to the user )
      });

    } catch (err) {
      console.error(err);
      return interaction.reply({
        content: 'An error occurred while fetching the backpack.',
        flags: 64
      });
    }
  }
};
