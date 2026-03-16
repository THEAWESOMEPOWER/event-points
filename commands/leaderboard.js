const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const db = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the points leaderboard')
    .addIntegerOption(option =>
      option.setName('page')
        .setDescription('Page number to view')
        .setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const requestedPage = interaction.options.getInteger('page') || 1;

      let rows = await db.all('SELECT user_id, points FROM users ORDER BY points DESC');

// Filter out users not in the server
const validRows = [];

for (const row of rows) {
  try {
    await interaction.guild.members.fetch(row.user_id);
    validRows.push(row);
  } catch {
    // User not in guild anymore → remove from DB
    await db.run('DELETE FROM users WHERE user_id = ?', row.user_id);
  }
}

rows = validRows;
      if (!rows || rows.length === 0)
        return interaction.editReply('No leaderboard data found.');

      const pageSize = 10;
      const totalPages = Math.ceil(rows.length / pageSize);

      if (requestedPage > totalPages) {
        return interaction.followUp({
          content: `Invalid page. There are only ${totalPages} page(s).`,
          ephemeral: true
        });
      }

      let currentPage = requestedPage - 1;

      const generateEmbed = async page => {
        const start = page * pageSize;
        const slice = rows.slice(start, start + pageSize);

        const leaderboardText = await Promise.all(
          slice.map(async (row, index) => {
            try {
              const member = await interaction.guild.members.fetch(row.user_id);
              return `**${start + index + 1})** ${member} - ${row.points} points`;
            } catch {
              return `**${start + index + 1})** Unknown User - ${row.points} points`;
            }
          })
        );

        return new EmbedBuilder()
          .setColor('#65B7E8')
          .setTitle('Leaderboard')
          .setDescription(leaderboardText.join('\n'))
          .setFooter({ text: `Page ${page + 1}/${totalPages}` });
      };

      const createButtons = () =>
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('back')
            .setLabel('BACK')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('NEXT')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === totalPages - 1)
        );

      const message = await interaction.editReply({
        embeds: [await generateEmbed(currentPage)],
        components: [createButtons()]
      });

      // FIXED — v14 requires ComponentType.Button
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
      });

      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id)
          return i.reply({
            content: "You can't control this leaderboard.",
            ephemeral: true
          });

        if (i.customId === 'back' && currentPage > 0) currentPage--;
        if (i.customId === 'next' && currentPage < totalPages - 1) currentPage++;

        await i.update({
          embeds: [await generateEmbed(currentPage)],
          components: [createButtons()]
        });
      });

      collector.on('end', async () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('back')
            .setLabel('BACK')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('NEXT')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
        );

        await message.edit({ components: [disabledRow] }).catch(() => {});
      });

    } catch (err) {
      console.error('Leaderboard command error:', err);
      await interaction.editReply({
        content: 'Failed to load leaderboard.',
        embeds: [],
        components: []
      }).catch(() => {});
    }
  }
};
