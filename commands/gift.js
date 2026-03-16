const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Give a purchased item to another user')
    .addUserOption(option => option.setName('user').setDescription('Recipient').setRequired(true))
    .addStringOption(option => option.setName('item').setDescription('Item to gift').setRequired(true)),
  async execute(interaction) {
    const giver = interaction.user;
    const recipient = interaction.options.getUser('user');
    const itemName = interaction.options.getString('item');

    const item = await db.get('SELECT item_id FROM shop_items WHERE name = ?', [itemName]);
    if (!item) return interaction.reply({ content: 'Item not found.', ephemeral: true });

    const owns = await db.get('SELECT quantity FROM user_backpack WHERE user_id = ? AND item_id = ?', [giver.id, item.item_id]);
    if (!owns) return interaction.reply({ content: 'You do not own this item.', ephemeral: true });

    // Remove from giver
    await db.run('DELETE FROM user_backpack WHERE user_id = ? AND item_id = ?', [giver.id, item.item_id]);

    // Add to recipient
    const existing = await db.get('SELECT quantity FROM user_backpack WHERE user_id = ? AND item_id = ?', [recipient.id, item.item_id]);
    if (existing) {
      await db.run('UPDATE user_backpack SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?', [recipient.id, item.item_id]);
    } else {
      await db.run('INSERT INTO user_backpack (user_id, item_id, purchased_at) VALUES (?, ?, ?)', [recipient.id, item.item_id, Date.now()]);
    }

    const embed = new EmbedBuilder()
      .setColor('#65B7E8')
      .setAuthor({ name: giver.username, iconURL: giver.displayAvatarURL({ dynamic: true }) })
      .setTitle('🎁 Gift Sent!')
      .setDescription(`${giver} gifted **${itemName}** to ${recipient}.`)
      .setFooter({ text: interaction.client.user.username, iconURL: interaction.client.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
