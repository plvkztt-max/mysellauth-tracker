const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

let client;
let commandRegistered = false;

async function startBot(publishShop) {
  if (!TOKEN) {
    console.log('DISCORD_TOKEN not set; Discord bot disabled.');
    return;
  }

  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
  });

  client.once('ready', async () => {
    console.log(`Discord bot logged in as ${client.user.tag}`);

    if (GUILD_ID && !commandRegistered) {
      await registerCommands();
      commandRegistered = true;
    }

    if (CHANNEL_ID) {
      const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
      if (channel) {
        channel.send('✅ SellAuth tracker bot is online.');
      }
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'shops') {
      const shops = publishShop.getAll();
      const live = shops.filter(s => s.status === 'live').length;
      const dead = shops.filter(s => s.status === 'dead').length;

      const embed = new EmbedBuilder()
        .setTitle('SellAuth shops overview')
        .setDescription(`Total: **${shops.length}**\nLive: **${live}**\nDead: **${dead}**`)
        .setColor(0x00AE86)
        .setTimestamp();

      if (shops.length > 0) {
        embed.addFields({
          name: 'Latest discovered',
          value: shops.slice(0, 5).map(s => `• ${s.domain} (${s.status})`).join('\n'),
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  });

  await client.login(TOKEN);
}

async function registerCommands() {
  if (!GUILD_ID || !TOKEN) return;

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  const commands = [
    new SlashCommandBuilder().setName('shops').setDescription('Show latest SellAuth shops found.')
  ].map(cmd => cmd.toJSON());

  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
    console.log('Registered slash commands.');
  } catch (err) {
    console.warn('Failed to register slash commands:', err.message);
  }
}

module.exports = { startBot };
