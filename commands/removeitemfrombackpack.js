// /removeitemfrombackpack
const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType
} = require('discord.js');
const db = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeitemfrombackpack')
    .setDescription('Remove an item from a user backpack (OWNER ONLY)')
    .addUserOption(option =>
      option.setName('user').setDescription('User').setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({
        content: 'Only owners can use this.',
        flags: 64
      });

    const target = interaction.options.getUser('user');

    // FIX: Fetch items ONLY from user_backpack
    const items = await db.all(
      `SELECT item_id, item_name, quantity 
       FROM user_backpack 
       WHERE user_id = ?`,
      [target.id]
    );

    if (!items.length)
      return interaction.reply({
        content: 'User has no items.',
        flags: 64
      });

    // Build menu (fallback if item_name is NULL)
    const menu = new StringSelectMenuBuilder()
      .setCustomId('remove_item')
      .setPlaceholder('Select an item to remove')
      .addOptions(
        items.map(i => ({
          label: i.item_name || `Item #${i.item_id}`,
          value: i.item_id.toString()
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    // Send EPHEMERAL reply
    const msg = await interaction.reply({
      content: 'Select an item to remove:',
      components: [row],
      flags: 64
    });

    // Collector on the *ephemeral reply*
    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000
    });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id)
        return i.reply({
          content: "You can't control this menu.",
          flags: 64
        });

      await i.deferUpdate(); // keeps interaction alive

      const itemId = i.values[0];

      // Look up item name WITHOUT relying on shop_items
      const item = await db.get(
        `SELECT item_name 
         FROM user_backpack 
         WHERE user_id = ? AND item_id = ?`,
        [target.id, itemId]
      );

      // Delete item from backpack
      await db.run(
        'DELETE FROM user_backpack WHERE user_id = ? AND item_id = ?',
        [target.id, itemId]
      );

      return i.editReply({
        content: `🗑️ Removed **${item?.item_name || `Item #${itemId}`}** from ${target.username}'s backpack.`,
        components: []
      });
    });
  }
};
