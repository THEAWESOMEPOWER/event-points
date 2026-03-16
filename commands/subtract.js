const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('subtract')
    .setDescription('Subtract points from a member (OWNER ONLY)')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The member to subtract points from')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of points to subtract')
        .setRequired(true)),

  async execute(interaction) {
    try {
      // Owner-only protection
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
        updatedPoints = 0;
        await db.run('INSERT INTO users (user_id, points) VALUES (?, ?)', [target.id, updatedPoints]);
      } else {
        updatedPoints = Math.max(row.points - amount, 0);
        await db.run('UPDATE users SET points = ? WHERE user_id = ?', [updatedPoints, target.id]);
      }

      // Build embed
      const embed = new EmbedBuilder()
         .setColor('#65B7E8')
        .setAuthor({
          name: giver.username,
          iconURL: giver.displayAvatarURL({ dynamic: true })
        })
        .setTitle('**Transaction Complete**')
        .setDescription(
          `${giver} subtracted ${amount} points from ${target}.\n\n` +
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
