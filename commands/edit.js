const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType
} = require('discord.js');
const db = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit')
    .setDescription('Edit shop items (OWNER ONLY)'),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: 'Only owners can edit items.', ephemeral: true });

    const items = await db.all('SELECT item_id, name FROM shop_items');
    if (!items.length) return interaction.reply({ content: 'No items to edit.', ephemeral: true });

    const select = new StringSelectMenuBuilder()
      .setCustomId('edit_item_menu')
      .setPlaceholder('Choose an item to edit')
      .addOptions(items.map(i => ({ label: i.name, value: i.item_id.toString() })));

    const row = new ActionRowBuilder().addComponents(select);
    const msg = await interaction.reply({ content: 'Select an item to edit:', components: [row], ephemeral: true });

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id)
        return i.reply({ content: "You cannot use this menu.", ephemeral: true });

      const itemId = i.values[0];
      const item = await db.get('SELECT * FROM shop_items WHERE item_id = ?', [itemId]);

      const modal = new ModalBuilder().setCustomId(`edit_modal_${itemId}`).setTitle(`Edit: ${item.name}`);

      // Name input
      const nameInput = new TextInputBuilder()
        .setCustomId('name')
        .setLabel('Item Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder(item.name ?? '');

      // Description input
      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder(item.description ?? '');

      // Purchase limit input
      const limitInput = new TextInputBuilder()
        .setCustomId('limit')
        .setLabel('Purchase Limit (leave blank for unlimited)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder(item.purchase_limit !== null ? item.purchase_limit.toString() : 'Unlimited');

      // Stock input
      const stockInput = new TextInputBuilder()
        .setCustomId('stock')
        .setLabel('Stock (0 = unlimited)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder(item.stock !== null ? item.stock.toString() : 'Unlimited');

      // Add a note showing what “Out of Stock” would look like
      const outOfStockNote = new TextInputBuilder()
        .setCustomId('stock_note')
        .setLabel('Preview (Out of Stock will disable button)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder(item.stock === 0 ? '🔴 Out of Stock button' : '🟢 Buyable');


      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(limitInput),
        new ActionRowBuilder().addComponents(stockInput),
        new ActionRowBuilder().addComponents(outOfStockNote)
      );

      await i.showModal(modal);

      const submitted = await i.awaitModalSubmit({
        filter: m => m.customId === `edit_modal_${itemId}` && m.user.id === interaction.user.id,
        time: 120000
      });

      const newName = submitted.fields.getTextInputValue('name') || item.name;
      const newDesc = submitted.fields.getTextInputValue('description') || item.description;
      const newLimitRaw = submitted.fields.getTextInputValue('limit');
      const newLimit = newLimitRaw !== '' ? parseInt(newLimitRaw) : item.purchase_limit;
      const newStockRaw = submitted.fields.getTextInputValue('stock');
      const newStock = newStockRaw !== '' ? parseInt(newStockRaw) : item.stock;

      await db.run(
        'UPDATE shop_items SET name = ?, description = ?, purchase_limit = ?, stock = ? WHERE item_id = ?',
        [newName, newDesc, newLimit, newStock, itemId]
      );

      await submitted.reply({ content: `✅ **${newName}** has been updated!`, ephemeral: true });
    });
  }
};
