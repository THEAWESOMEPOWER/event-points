const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const db = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new shop item (OWNER ONLY)'),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: 'Only owners can create items.', ephemeral: true });

    // Build modal for item creation
    const modal = new ModalBuilder()
      .setCustomId('create_modal')
      .setTitle('Create New Item');

    const nameInput = new TextInputBuilder()
      .setCustomId('name')
      .setLabel('Item Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Description')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    const costInput = new TextInputBuilder()
      .setCustomId('cost')
      .setLabel('Cost (points)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const limitInput = new TextInputBuilder()
      .setCustomId('limit')
      .setLabel('Purchase Limit (0 = unlimited)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const stockInput = new TextInputBuilder()
      .setCustomId('stock')
      .setLabel('Stock (0 = unlimited)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(costInput),
      new ActionRowBuilder().addComponents(limitInput),
      new ActionRowBuilder().addComponents(stockInput)
    );

    await interaction.showModal(modal);

    // Await modal submit
    const submitted = await interaction.awaitModalSubmit({
      filter: m => m.customId === 'create_modal' && m.user.id === interaction.user.id,
      time: 120000
    });

    const name = submitted.fields.getTextInputValue('name');
    const description = submitted.fields.getTextInputValue('description') || '';
    const cost = parseInt(submitted.fields.getTextInputValue('cost'));
    const purchase_limit_raw = submitted.fields.getTextInputValue('limit');
    const purchase_limit = purchase_limit_raw !== '' ? parseInt(purchase_limit_raw) : 0;
    const stock_raw = submitted.fields.getTextInputValue('stock');
    const stock = stock_raw !== '' ? parseInt(stock_raw) : 0;

    // Save new item in DB
    await db.run(
      'INSERT INTO shop_items (name, description, cost, purchase_limit, stock) VALUES (?, ?, ?, ?, ?)',
      [name, description, cost, purchase_limit, stock]
    );

    // Initial ephemeral confirmation
    await submitted.reply({
      content: `✅ Item **${name}** has been created successfully!`,
      ephemeral: true
    });

    // Ask if the user wants to announce in announcement channel
    const announceRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('announce_yes')
        .setLabel('Yes, announce it!')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('announce_no')
        .setLabel('No, do not announce')
        .setStyle(ButtonStyle.Danger)
    );

    const followupMessage = await interaction.followUp({
      content: 'Do you want to announce this new item in the announcement channel?',
      components: [announceRow],
      ephemeral: true
    });

    const filter = i => i.user.id === interaction.user.id;
    const collector = followupMessage.createMessageComponentCollector({ filter, time: 60000, max: 1 });

    collector.on('collect', async i => {
      if (i.customId === 'announce_yes') {
        const announcementChannel = await i.client.channels.fetch('1373159350553546852');
        await announcementChannel.send({
          content: `@everyone A NEW ITEM IS NOW IN THE SHOP! It's called: **${name}**\nCheck it out in bot-commands by doing /shop.`
        });
        await i.update({ content: '✅ Announcement sent!', components: [] });
      } else if (i.customId === 'announce_no') {
        await i.update({ content: '❌ No announcement sent.', components: [] });
      }
    });
  }
};
