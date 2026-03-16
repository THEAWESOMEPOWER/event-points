const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('getinfo')
    .setDescription('Get Roblox user information to Verify them as @Members (Authorized Staff ONLY)')
    .addStringOption(option =>
      option
        .setName('robloxuser')
        .setDescription('Roblox username')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const allowedUsers = [
        '595286037622685912',
        '1183595885846859817',
        '1379925247842713752',
        '1275873688696127488'
      ];

      if (!allowedUsers.includes(interaction.user.id)) {
        return interaction.editReply({ content: '❌ Not authorized to use this command.' });
      }

      const username = interaction.options.getString('robloxuser');

      // Fetch Roblox user ID
      const userRes = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernames: [username],
          excludeBannedUsers: false
        })
      });

      if (!userRes.ok) {
        throw new Error(`Roblox API error: ${userRes.status}`);
      }

      const userData = await userRes.json();

      if (!userData.data || userData.data.length === 0) {
        return interaction.editReply({ content: '❌ Roblox user not found.' });
      }

      const userId = userData.data[0].id;

      // Fetch profile info
      const infoRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);

      if (!infoRes.ok) {
        throw new Error(`Roblox API error: ${infoRes.status}`);
      }

      const info = await infoRes.json();

      const createdUnix = Math.floor(new Date(info.created).getTime() / 1000);
      const profileUrl = `https://www.roblox.com/users/${userId}/profile`;

      const embed = new EmbedBuilder()
        .setColor('#1C1F3A')
        .setTitle(`🎮 ${info.displayName}`)
        .setURL(profileUrl)
        .setDescription(`🆔 **Roblox ID:** ${userId}`)
        .addFields(
          {
            name: '📝 Roblox Username',
            value: `@${info.name}`,
            inline: false
          },
          {
            name: '📅 Account Created',
            value: `<t:${createdUnix}:F>`,
            inline: false
          },
          {
            name: '💬 Description',
            value: info.description?.length
              ? info.description.slice(0, 1024)
              : '*No description set.*',
            inline: false
          }
        )
        .setFooter({
          text: interaction.client.user.username,
          iconURL: interaction.client.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('GETINFO ERROR:', error);

      await interaction.editReply({
        content: '❌ Failed to fetch Roblox information. Please try again later.'
      });
    }
  }
};
