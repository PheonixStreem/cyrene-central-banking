const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===== Storage =====
const balances = {};
const inventories = {};

// ===== Commands =====
const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your credits'),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your registered assets'),

  new SlashCommandBuilder()
    .setName('medpoint')
    .setDescription('View MedPoint medical inventory')
].map(cmd => cmd.toJSON());

// ===== Register Commands =====
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('Commands registered.');
  } catch (err) {
    console.error(err);
  }
})();

client.once('ready', () => {
  console.log(`Online as ${client.user.tag}`);
});

// ===== Command Handling =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user } = interaction;

  if (!balances[user.id]) balances[user.id] = 500;
  if (!inventories[user.id]) inventories[user.id] = [];

  if (commandName === 'balance') {
    return interaction.reply(
      `Central Banking confirms a balance of **${balances[user.id]} credits**.`
    );
  }

  if (commandName === 'inventory') {
    if (!inventories[user.id].length) {
      return interaction.reply('No registered assets.');
    }

    return interaction.reply(
      `Registered Assets:\n• ${inventories[user.id].join('\n• ')}`
    );
  }

  if (commandName === 'medpoint') {
    return interaction.reply(
`**MedPoint Inventory**
• Med Stim — 150 credits
• Recovery Potion — 250 credits
• Nanobot Healing Vials — 350 credits
• Portable Blood-Toxin Filters — 180 credits
• Oxygen Rebreather Mask — 220 credits
• Detox Injector — 200 credits
• Neural Stabilizer Shot — 300 credits`
    );
  }
});

client.login(token);

// Prevent Render worker from exiting
setInterval(() => {}, 1000 * 60 * 60);
