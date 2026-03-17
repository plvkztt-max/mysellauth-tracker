const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

// NOTE: Keep your Discord token safe. Never commit it to source control.
//       Use environment variables (DISCORD_TOKEN, DISCORD_GUILD_ID, DISCORD_CHANNEL_ID).


const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

let client;
let commandRegistered = false;
let shopPublisher; // Store the publisher object for use in event handlers

async function startBot(publishShop) {
  if (!TOKEN) {
    console.log('DISCORD_TOKEN not set; Discord bot will not go online.');
    return;
  }

  console.log('Initializing Discord bot with token and IDs...');
  shopPublisher = publishShop; // Save the publisher

  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
  });

  client.once('ready', async () => {
    console.log(`✅ Discord bot logged in as ${client.user.tag}`);

    if (GUILD_ID && !commandRegistered) {
      await registerCommands();
      commandRegistered = true;
    }

    if (CHANNEL_ID) {
      const channel = await client.channels.fetch(CHANNEL_ID).catch((err) => {
        console.error('Failed to fetch channel:', err.message);
        return null;
      });
      if (channel) {
        channel.send('✅ SellAuth tracker bot is online and monitoring for new shops.').catch(err => {
          console.error('Failed to send startup message:', err.message);
        });
      }
    }

    if (publishShop && typeof publishShop.onLive === 'function') {
      console.log('Setting up live shop notifications...');
      publishShop.onLive((shop) => {
        if (!CHANNEL_ID) return;
        client.channels.fetch(CHANNEL_ID).then(channel => {
          if (!channel || !channel.send) return;
          const embed = new EmbedBuilder()
            .setTitle('🚨 New Live SellAuth Shop')
            .setDescription(`**${shop.domain}** is now live!`)
            .addFields(
              { name: 'Status', value: shop.status, inline: true },
              { name: 'Discovered', value: new Date(shop.discoveredAt).toLocaleString(), inline: true }
            )
            .setColor(0x00AE86)
            .setTimestamp();

          channel.send({ embeds: [embed] }).catch(() => null);
        }).catch(() => null);
      });
    }
  });

  client.on('error', (err) => {
    console.error('Discord bot error:', err.message);
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'shops') {
      const shops = shopPublisher.getAll();
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

    if (interaction.commandName === 'live') {
      const shops = shopPublisher.getAll().filter(s => s.status === 'live');
      const embed = new EmbedBuilder()
        .setTitle('Live SellAuth Shops')
        .setDescription(shops.length ? shops.map(s => `• ${s.domain}`).join('\n') : 'No live shops found.')
        .setColor(0x00AE86)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.commandName === 'dead') {
      const shops = shopPublisher.getAll().filter(s => s.status === 'dead');
      const embed = new EmbedBuilder()
        .setTitle('Dead SellAuth Shops')
        .setDescription(shops.length ? shops.map(s => `• ${s.domain}`).join('\n') : 'No dead shops found.')
        .setColor(0xDC3545)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  });

  try {
    console.log('Logging into Discord...');
    await client.login(TOKEN);
  } catch (err) {
    console.error('Failed to login to Discord:', err.message);
  }
}

async function registerCommands() {
  if (!GUILD_ID || !TOKEN) return;

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  const commands = [
    new SlashCommandBuilder().setName('shops').setDescription('Show latest SellAuth shops found.'),
    new SlashCommandBuilder().setName('live').setDescription('Show currently live SellAuth shops.'),
    new SlashCommandBuilder().setName('dead').setDescription('Show currently dead SellAuth shops.')
  ].map(cmd => cmd.toJSON());

  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
    console.log('Registered slash commands.');
  } catch (err) {
    console.warn('Failed to register slash commands:', err.message);
  }
}

module.exports = { startBot };
