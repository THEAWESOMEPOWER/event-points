const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('points')
    .setDescription('Check the balance for the given user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check the balance of')
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    // 🔧 Fetch member (needed for nickname)
    const member = await interaction.guild.members.fetch(targetUser.id);

    // Get points from DB
    const row = await db.get('SELECT points FROM users WHERE user_id = ?', [targetUser.id]);

    // Initialize if user doesn't exist
    let points;
    if (!row) {
      await db.run('INSERT INTO users (user_id, points) VALUES (?, 0)', [targetUser.id]);
      points = 0;
    } else {
      points = row.points ?? 0;
    }

    // Create the embed
    const embed = new EmbedBuilder()
      .setColor('#65B7E8') // blue color
      .setAuthor({
        name: member.displayName,
        iconURL: targetUser.displayAvatarURL({ dynamic: true })
      })
      .setDescription(`**Balance**\n${points} points`)
      .setFooter({
        text: `${interaction.client.user.username}`,
        iconURL: interaction.client.user.displayAvatarURL({ dynamic: true })
      });

    // Send the embed
    await interaction.reply({
      embeds: [embed]
    });
  }
};
