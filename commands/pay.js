const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Send points to another user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to pay')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('The amount of points to pay')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const sender = interaction.user;
      const receiver = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      if (receiver.id === sender.id)
        return interaction.reply({ content: "❌ You can't pay yourself.", ephemeral: true });

      // ❌ No decimals allowed & must be > 0
      if (amount <= 0 || amount % 1 !== 0)
        return interaction.reply({ content: "❌ Amount must be a **whole number greater than 0**.", ephemeral: true });

      // ❌ If amount > 50 → ticket required
      if (amount > 50) {
        return interaction.reply({
          content:
`⚠️ Payments over **50 points** require HR ticket validation.

Open a ticket here:
<https://discord.com/channels/1209634428725502033/1373112580859625492>

Then press **HR Support**.`,
          ephemeral: true
        });
      }

      // Fetch sender balance
      let senderRow = await db.get("SELECT points FROM users WHERE user_id = ?", [sender.id]);
      let senderBalance = senderRow?.points || 0;

      // ❌ Not enough points
      if (senderBalance < amount) {
        const needed = amount - senderBalance;
        return interaction.reply({
          content: `❌ You need **${needed} more points** to do this!`,
          ephemeral: true
        });
      }

      // Fetch receiver balance
      let receiverRow = await db.get("SELECT points FROM users WHERE user_id = ?", [receiver.id]);
      let receiverBalance = receiverRow?.points || 0;

      // Apply transaction
      const newSenderBalance = senderBalance - amount;
      const newReceiverBalance = receiverBalance + amount;

      await db.run("UPDATE users SET points = ? WHERE user_id = ?", [newSenderBalance, sender.id]);
      await db.run(
        "INSERT INTO users (user_id, points) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET points = ?",
        [receiver.id, newReceiverBalance, newReceiverBalance]
      );

      // Get nicknames
      const senderMember = interaction.guild.members.cache.get(sender.id);
      const receiverMember = interaction.guild.members.cache.get(receiver.id);

      const senderName = senderMember?.nickname || sender.username;
      const receiverName = receiverMember?.nickname || receiver.username;

      // Build embed
      const embed = new EmbedBuilder()
        .setColor('#00ff99')
        .setAuthor({
          name: receiverName,
          iconURL: receiver.displayAvatarURL({ dynamic: true })
        })
        .setTitle("**Transaction Complete**")
        .setDescription(`💸 **${sender} paid ${amount} points to ${receiver}**`)
        .addFields(
          {
            name: `${senderName}'s New Balance`,
            value: `\`${newSenderBalance} points\``,
            inline: false
          },
          {
            name: `${receiverName}'s New Balance`,
            value: `\`${newReceiverBalance} points\``,
            inline: false
          }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      return interaction.reply({
        content: "❌ An unexpected error occurred while processing this transaction!",
        ephemeral: true
      });
    }
  }
};
