const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database.js');

// 🔒 Toggle this to enable/disable the command
const COINFLIP_ENABLED = false;

async function ensureColumns() {
  try {
    await db.run('ALTER TABLE users ADD COLUMN coinflips_today INTEGER DEFAULT 0;');
  } catch {}
  try {
    await db.run('ALTER TABLE users ADD COLUMN last_coinflip_reset INTEGER DEFAULT 0;');
  } catch {}
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Place a bet on the coin flip')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('The amount to bet')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(5)
    )
    .addStringOption(option =>
      option
        .setName('side')
        .setDescription('The side to bet on')
        .setRequired(true)
        .addChoices(
          { name: 'Heads', value: 'heads' },
          { name: 'Tails', value: 'tails' }
        )
    ),

  async execute(interaction) {

    // 🚫 If disabled, stop immediately
    if (!COINFLIP_ENABLED) {
      return interaction.reply({
        content: "🚫 The **/coinflip** command is currently disabled.",
        ephemeral: true
      });
    }

    const user = interaction.user;
    const member = await interaction.guild.members.fetch(user.id);
    const amount = interaction.options.getInteger('amount');
    const chosenSide = interaction.options.getString('side');
    const now = Date.now();

    await ensureColumns();

    let row = await db.get(
      'SELECT points, coinflips_today, last_coinflip_reset FROM users WHERE user_id = ?',
      [user.id]
    );

    if (!row) {
      await db.run(
        'INSERT INTO users (user_id, points, coinflips_today, last_coinflip_reset) VALUES (?, ?, ?, ?)',
        [user.id, 0, 0, 0]
      );
      row = { points: 0, coinflips_today: 0, last_coinflip_reset: 0 };
    }

    let { points, coinflips_today, last_coinflip_reset } = row;

    const DAY_MS = 24 * 60 * 60 * 1000;
    if (now - last_coinflip_reset >= DAY_MS) {
      coinflips_today = 0;
      last_coinflip_reset = now;
      await db.run(
        'UPDATE users SET coinflips_today = 0, last_coinflip_reset = ? WHERE user_id = ?',
        [now, user.id]
      );
    }

    const MAX_FLIPS_PER_DAY = 3;
    if (coinflips_today >= MAX_FLIPS_PER_DAY) {
      const nextReset = last_coinflip_reset + DAY_MS;
      const remaining = nextReset - now;

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      return interaction.reply({
        content: `You’ve reached your daily coinflip limit (\`${MAX_FLIPS_PER_DAY}\`).\nYou can play again in **${hours}h ${minutes}m ${seconds}s**.`,
        ephemeral: true
      });
    }

    if (points < amount) {
      const needed = amount - points;
      return interaction.reply({
        content: `You need \`${needed} more points\` to do this!`,
        ephemeral: true
      });
    }

    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const win = result === chosenSide;

    if (win) points += amount;
    else points -= amount;

    coinflips_today += 1;

    await db.run(
      'UPDATE users SET points = ?, coinflips_today = ?, last_coinflip_reset = ? WHERE user_id = ?',
      [points, coinflips_today, last_coinflip_reset, user.id]
    );

    const embed = new EmbedBuilder()
      .setColor(win ? '#00FF7F' : '#FF4D4D')
      .setAuthor({
        name: member.displayName,
        iconURL: user.displayAvatarURL({ dynamic: true })
      })
      .setDescription(
        `🪙 **Coin landed on:** ${result.charAt(0).toUpperCase() + result.slice(1)}\n` +
        (win
          ? `🎉 You **won** ${amount} points!`
          : `😢 You **lost** ${amount} points.`) +
        `\n\n**Balance**\n${points} points\n\n` +
        `🕒 **Flips left today:** ${MAX_FLIPS_PER_DAY - coinflips_today}/${MAX_FLIPS_PER_DAY}`
      )
      .setFooter({
        text: `${interaction.client.user.username}`,
        iconURL: interaction.client.user.displayAvatarURL({ dynamic: true })
      });

    await interaction.reply({ embeds: [embed] });
  }
};