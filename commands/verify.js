const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const sqlite3 = require('sqlite3');
const fetch = require('node-fetch');

// Database (auto-created)
const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error('DB connection error:', err.message);
    console.log('Connected to DB');
});

db.run(`CREATE TABLE IF NOT EXISTS verifications (
    discord_id TEXT PRIMARY KEY,
    roblox_id TEXT,
    roblox_username TEXT,
    original_nickname TEXT
)`);

async function getRobloxUsername(robloxId) {
    try {
        const res = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
        if (!res.ok) throw new Error('Invalid Roblox ID');
        const data = await res.json();
        return data.name;
    } catch (err) {
        throw new Error('Failed to fetch Roblox username: ' + err.message);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Link a Discord user to a Roblox account')
        .addUserOption(option => option.setName('target').setDescription('User to verify').setRequired(true))
        .addStringOption(option => option.setName('roblox_id').setDescription('Roblox ID').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const allowedUsers = ['595286037622685912', '1183595885846859817', '1379925247842713752', '1275873688696127488'];
            if (!allowedUsers.includes(interaction.user.id)) return interaction.editReply('❌ Not authorized.');

            const target = interaction.options.getUser('target');
            const robloxId = interaction.options.getString('roblox_id');
            const robloxUsername = await getRobloxUsername(robloxId);

            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            if (!member) return interaction.editReply('❌ Could not fetch member.');

            const originalNick = member.nickname || member.user.username;
            if (member.nickname !== robloxUsername) await member.setNickname(robloxUsername).catch(console.error);

            const memberRole = interaction.guild.roles.cache.find(r => r.name === 'Members');
            const verifiedRole = interaction.guild.roles.cache.find(r => r.name === 'Verified');
            const unverifiedRole = interaction.guild.roles.cache.find(r => r.name === 'Unverified');

            if (memberRole && !member.roles.cache.has(memberRole.id)) await member.roles.add(memberRole).catch(console.error);
            if (verifiedRole && !member.roles.cache.has(verifiedRole.id)) await member.roles.add(verifiedRole).catch(console.error);
            if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) await member.roles.remove(unverifiedRole).catch(console.error);

            db.run(`INSERT INTO verifications (discord_id, roblox_id, roblox_username, original_nickname)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(discord_id) DO UPDATE SET roblox_id = ?, roblox_username = ?, original_nickname = ?`,
                [target.id, robloxId, robloxUsername, originalNick, robloxId, robloxUsername, originalNick],
                (err) => { if (err) console.error('DB error:', err.message); }
            );

            const embed = new EmbedBuilder()
                .setColor('#65B7E8')
                .setTitle('✅ Verified')
                .addFields(
                    { name: 'User', value: `${target}`, inline: true },
                    { name: 'Roblox ID', value: robloxId, inline: true },
                    { name: 'Roblox Username', value: robloxUsername, inline: true }
                ).setTimestamp();

            return interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('Verify error:', err);
            return interaction.editReply('❌ Verification failed. Check logs.');
        }
    }
};
