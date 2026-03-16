const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const sqlite3 = require('sqlite3');

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unverify')
        .setDescription('Remove Roblox verification')
        .addUserOption(option => option.setName('target').setDescription('User to unverify').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const allowedUsers = ['595286037622685912', '1183595885846859817', '1379925247842713752', '1275873688696127488'];
            if (!allowedUsers.includes(interaction.user.id)) return interaction.editReply('❌ Not authorized.');

            const target = interaction.options.getUser('target');

            db.get('SELECT * FROM verifications WHERE discord_id = ?', [target.id], async (err, row) => {
                if (err) return console.error('DB error:', err.message);
                if (!row) return interaction.editReply('❌ User not verified.');

                db.run('DELETE FROM verifications WHERE discord_id = ?', [target.id], (err) => {
                    if (err) console.error('DB delete error:', err.message);
                });

                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (member) {
                    const originalNick = row.original_nickname || null;
                    if (member.nickname !== originalNick) await member.setNickname(originalNick).catch(console.error);

                    const memberRole = interaction.guild.roles.cache.find(r => r.name === 'Members');
                    const verifiedRole = interaction.guild.roles.cache.find(r => r.name === 'Verified');
                    const unverifiedRole = interaction.guild.roles.cache.find(r => r.name === 'Unverified');

                    if (memberRole && member.roles.cache.has(memberRole.id)) await member.roles.remove(memberRole).catch(console.error);
                    if (verifiedRole && member.roles.cache.has(verifiedRole.id)) await member.roles.remove(verifiedRole).catch(console.error);
                    if (unverifiedRole && !member.roles.cache.has(unverifiedRole.id)) await member.roles.add(unverifiedRole).catch(console.error);
                }

                const embed = new EmbedBuilder()
                    .setColor('#E86B6B')
                    .setTitle('❌ Unverified')
                    .setDescription(`Removed Roblox verification for ${target}`)
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            });

        } catch (err) {
            console.error('Unverify error:', err);
            return interaction.editReply('❌ Failed to unverify. Check logs.');
        }
    }
};
