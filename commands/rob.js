const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database.js');

// 🔒 Toggle this to enable/disable the command
const ROB_ENABLED = false;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Rob MR_RICH for up to 50 points. (3 attempts per 7 days)'),

  async execute(interaction) {

    // 🚫 If disabled, stop here
    if (!ROB_ENABLED) {
      return interaction.reply({
        content: "🚫 The **/rob** command is currently disabled.",
        ephemeral: true
      });
    }

    try {
      const robber = interaction.user;

      // --- CONFIG ---
      const OWNER_USERNAME = "thepower7173";
      const MIN_POINT_REQUIRED = 50;
      const MAX_ATTEMPTS = 3;
      const COOLDOWN_DAYS = 7;
      const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

      function getRarityAmount() {
        const roll = Math.random();

        if (roll <= 0.01) {
          return Math.floor(Math.random() * 11) + 40;
        } else if (roll <= 0.10) {
          return Math.floor(Math.random() * 15) + 25;
        } else if (roll <= 0.40) {
          return Math.floor(Math.random() * 15) + 10;
        } else {
          return Math.floor(Math.random() * 9) + 1;
        }
      }

      const now = Date.now();

      await db.run(`
        CREATE TABLE IF NOT EXISTS rob_attempts (
          user_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);

      const attempts = await db.all(
        "SELECT timestamp FROM rob_attempts WHERE user_id = ?",
        [robber.id]
      );

      const recentAttempts = attempts.filter(a => now - a.timestamp < COOLDOWN_MS);

      if (recentAttempts.length >= MAX_ATTEMPTS) {
        const earliest = recentAttempts.sort((a, b) => a.timestamp - b.timestamp)[0].timestamp;
        const resetTime = earliest + COOLDOWN_MS;
        const timeLeft = resetTime - now;

        const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
        const hours = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

        return interaction.reply({
          content:
            `⏳ **Robbery Limit Reached**\nYou can only rob **3 times every 7 days**.\n\n` +
            `You can rob again in **${days}d ${hours}h ${minutes}m**.`,
          ephemeral: true
        });
      }

      await db.run(
        "INSERT INTO rob_attempts (user_id, timestamp) VALUES (?, ?)",
        [robber.id, now]
      );

      const ownerMember = interaction.guild.members.cache.find(
        m => m.user.username === OWNER_USERNAME
      );

      if (!ownerMember) {
        return interaction.reply({
          content: "❌ The owner could not be found in this server.",
          ephemeral: true
        });
      }

      const owner = ownerMember.user;

      let robberRow = await db.get("SELECT points FROM users WHERE user_id = ?", [robber.id]);
      let ownerRow = await db.get("SELECT points FROM users WHERE user_id = ?", [owner.id]);

      let robberPoints = robberRow?.points || 0;
      let ownerPoints = ownerRow?.points || 0;

      if (robberPoints < MIN_POINT_REQUIRED) {
        return interaction.reply({
          content: `❌ You need **at least ${MIN_POINT_REQUIRED} points** to attempt a robbery!`,
          ephemeral: true
        });
      }

      if (ownerPoints < MIN_POINT_REQUIRED) {
        return interaction.reply({
          content: `❌ The owner does not have enough points to be robbed.`,
          ephemeral: true
        });
      }

      const success = Math.random() < 0.5;
      const amount = getRarityAmount();

      const successPrompts = [
        "You slipped inside unnoticed and grabbed whatever you could!",
        "You cracked the safe and struck gold!",
        "The owner left a window open… lucky you!",
        "A distraction outside let you sneak in perfectly.",
        "You found a jar labeled 'DO NOT TOUCH' and touched it anyway."
      ];

      const failPrompts = [
        "You broke into the house but found nothing. You even lost your wallet in the process.",
        "You tripped and alerted the owner—big mistake.",
        "Security cameras caught you instantly.",
        "You sneezed so loud you got caught immediately.",
        "You tried to sneak in but the dog chased you away."
      ];

      const prompt = success
        ? successPrompts[Math.floor(Math.random() * successPrompts.length)]
        : failPrompts[Math.floor(Math.random() * failPrompts.length)];

      let newRobberBalance = robberPoints;
      let newOwnerBalance = ownerPoints;

      if (success) {
        newRobberBalance += amount;
        newOwnerBalance = Math.max(0, newOwnerBalance - amount);
      } else {
        newRobberBalance = Math.max(0, newRobberBalance - amount);
      }

      await db.run("UPDATE users SET points = ? WHERE user_id = ?", [newRobberBalance, robber.id]);
      await db.run("UPDATE users SET points = ? WHERE user_id = ?", [newOwnerBalance, owner.id]);

      const color = success ? "#1cf04f" : "#ff4b4b";
      const title = success
        ? "🎉 GAME ROBBERY WAS A SUCCESS :)"
        : "💀 GAME ROBBERY WAS A FAIL :(";

      const robberName =
        interaction.guild.members.cache.get(robber.id)?.nickname || robber.username;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
          name: robberName,
          iconURL: robber.displayAvatarURL({ dynamic: true })
        })
        .setTitle(title)
        .setDescription(prompt)
        .addFields(
          {
            name: "**Amount**",
            value: `\`${amount} Points\`\n**New Balance:** \`${newRobberBalance}\``,
            inline: true
          },
          {
            name: "**Victim**",
            value: `${owner}`,
            inline: true
          }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      return interaction.reply({
        content: "❌ An error occurred while attempting the robbery.",
        ephemeral: true
      });
    }
  }
};