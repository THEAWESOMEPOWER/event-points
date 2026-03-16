const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType
} = require('discord.js');
const db = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Delete items from the shop (OWNER ONLY)'),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({
        content: 'Only owners can delete items.',
        flags: 64 // ephemeral
      });

    const items = await db.all('SELECT item_id, name FROM shop_items');

    if (!items.length)
      return interaction.reply({
        content: 'No items exist.',
        flags: 64
      });

    const select = new StringSelectMenuBuilder()
      .setCustomId('delete_item_menu')
      .setPlaceholder('Select an item to delete')
      .addOptions(
        items.map(i => ({
          label: i.name,
          value: i.item_id.toString()
        }))
      );

    const row = new ActionRowBuilder().addComponents(select);

    // Send ephemeral menu
    const message = await interaction.reply({
      content: 'Choose an item to delete:',
      components: [row],
      flags: 64 // ephemeral
    });

    // Collector on ephemeral message
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000
    });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id)
        return i.reply({
          content: "You can't use this menu.",
          flags: 64
        });

      // Must defer to keep interaction alive
      await i.deferUpdate();

      const itemId = i.values[0];
      const item = await db.get(
        'SELECT name FROM shop_items WHERE item_id = ?',
        [itemId]
      );

      if (!item) {
        return i.editReply({
          content: 'Item no longer exists.',
          components: []
        });
      }

      await db.run('DELETE FROM shop_items WHERE item_id = ?', [itemId]);

      return i.editReply({
        content: `🗑️ Deleted **${item.name}** from the shop.`,
        components: []
      });
    });
  }
};
