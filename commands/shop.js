const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View the shop and buy items'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const items = await db.all('SELECT * FROM shop_items');
    if (!items.length) return interaction.editReply('The shop is empty!');

    let page = 0;
    const totalPages = items.length;

    const generateEmbed = idx => {
      const item = items[idx];
      return new EmbedBuilder()
        .setColor('#65B7E8')
        .setTitle(`**${item.name}**`)
        .setDescription(`${item.description}\n\n**Cost:** ${item.cost} points\n**Availability:** ${item.stock ?? '∞'} left\n**Your Limit:** ${item.purchase_limit ?? '∞'}`)
        .setFooter({ text: `Page ${idx + 1}/${totalPages}` });
    };

    const createButtons = (idx) => {
      const item = items[idx];
      const outOfStock = (item.stock !== null && item.stock <= 0);
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back').setLabel('BACK').setStyle(ButtonStyle.Primary).setDisabled(idx === 0),
        new ButtonBuilder()
          .setCustomId('buy')
          .setLabel(outOfStock ? 'OUT OF STOCK' : 'BUY')
          .setStyle(outOfStock ? ButtonStyle.Danger : ButtonStyle.Success)
          .setDisabled(outOfStock),
        new ButtonBuilder().setCustomId('next').setLabel('NEXT').setStyle(ButtonStyle.Primary).setDisabled(idx === totalPages - 1)
      );
    };

    const msg = await interaction.editReply({ embeds: [generateEmbed(page)], components: [createButtons(page)] });

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id)
        return i.reply({ content: "You can't control this.", ephemeral: true });

      const item = items[page];

      if (i.customId === 'back') page--;
      if (i.customId === 'next') page++;
      if (i.customId === 'buy') {
        try {
          const userPointsRow = await db.get('SELECT points FROM users WHERE user_id = ?', [interaction.user.id]);
          const points = userPointsRow?.points ?? 0;

          if (points < item.cost)
            return i.reply({ content: `You need ${item.cost - points} more points to buy this item.`, ephemeral: true });

          // Check global stock
          if (item.stock !== null && item.stock <= 0)
            return i.reply({ content: `❌ This item is out of stock!`, ephemeral: true });

          // Check user-specific purchase limit
          let maxPurchasable = Infinity;
          if (item.purchase_limit !== null) {
            const userItemRow = await db.get('SELECT quantity FROM user_backpack WHERE user_id = ? AND item_id = ?', [interaction.user.id, item.item_id]);
            const userQuantity = userItemRow?.quantity ?? 0;
            if (userQuantity >= item.purchase_limit)
              return i.reply({ content: `❌ You have reached your purchase limit for this item!`, ephemeral: true });
            maxPurchasable = item.purchase_limit - userQuantity;
          }

          if (item.stock !== null)
            maxPurchasable = Math.min(maxPurchasable, item.stock);

          if (maxPurchasable <= 0)
            return i.reply({ content: `❌ You cannot buy any more of this item.`, ephemeral: true });

          // Deduct points
          await db.run('UPDATE users SET points = points - ? WHERE user_id = ?', [item.cost, interaction.user.id]);

          // Add to backpack
          const existing = await db.get('SELECT quantity FROM user_backpack WHERE user_id = ? AND item_id = ?', [interaction.user.id, item.item_id]);
          if (existing) {
            await db.run('UPDATE user_backpack SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?', [interaction.user.id, item.item_id]);
          } else {
            await db.run(
              'INSERT INTO user_backpack (user_id, item_id, item_name, purchased_at, quantity) VALUES (?, ?, ?, ?, ?)',
              [interaction.user.id, item.item_id, item.name, Date.now(), 1]
            );
          }

          // Reduce stock if limited
          if (item.stock !== null) {
            await db.run('UPDATE shop_items SET stock = stock - 1 WHERE item_id = ?', [item.item_id]);
            item.stock -= 1;
          }

          // Update the shop message with new stock & button state
          await i.update({ embeds: [generateEmbed(page)], components: [createButtons(page)] });

          // Ephemeral confirmation to user
          await i.followUp({ content: `✅ You bought **${item.name}**!`, ephemeral: true });

          // Public notification in server
          const notifyChannel = await interaction.client.channels.fetch('1447319259842875522');
          if (notifyChannel)
            notifyChannel.send(`💰 **${interaction.user.tag}** bought **${item.name}** for ${item.cost} points!`);
        } catch (err) {
          console.error(err);
          return i.followUp({ content: 'An error occurred while buying the item.', ephemeral: true });
        }
      }

      // Update pagination if back/next
      if (i.customId === 'back' || i.customId === 'next')
        await i.update({ embeds: [generateEmbed(page)], components: [createButtons(page)] });
    });

    collector.on('end', async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back').setLabel('BACK').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('buy').setLabel('BUY').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('next').setLabel('NEXT').setStyle(ButtonStyle.Primary).setDisabled(true)
      );
      await msg.edit({ components: [disabledRow] }).catch(() => {});
    });
  }
};
