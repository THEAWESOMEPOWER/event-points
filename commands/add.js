const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add to member balance (OWNER ONLY)')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The member to give points')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('The amount of points to add')
        .setRequired(true)),

  async execute(interaction) {
    try {
      // Only the owner can add points
      if (interaction.user.id !== process.env.OWNER_ID) {
        return interaction.reply({ content: '❌ You cannot use this command!', ephemeral: true });
      }

      const giver = interaction.user;
      const target = interaction.options.getUser('target');
      const amount = interaction.options.getInteger('amount');

      // Fetch current points
      let row = await db.get('SELECT points FROM users WHERE user_id = ?', [target.id]);
      let updatedPoints;

      if (!row) {
        // New entry
        updatedPoints = amount;
        await db.run('INSERT INTO users (user_id, points) VALUES (?, ?)', [target.id, updatedPoints]);
      } else {
        // Update existing balance
        updatedPoints = row.points + amount;
        await db.run('UPDATE users SET points = ? WHERE user_id = ?', [updatedPoints, target.id]);
      }

      // Build the embed
      const embed = new EmbedBuilder()
        .setColor('#65B7E8')
        .setAuthor({
          name: giver.username,
          iconURL: giver.displayAvatarURL({ dynamic: true })
        })
        .setTitle('**Transaction Complete**')
      .setDescription(
         `${giver} added **${amount}** points to ${target}.\n\n` +
         `**Balance**\n` +
        `${updatedPoints} points`
        )
        .setFooter({
          text: interaction.client.user.username,
          iconURL: interaction.client.user.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error(error);
      return interaction.reply({ content: '❌ There was an error executing this command!', ephemeral: true });
    }
  }
};
