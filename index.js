const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===== In-memory storage =====
const balances = {};
const inventories = {};

// ===== Slash Commands =====
const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your credits'),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Give credits to a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount').setDescription('Amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('grant-item')
    .setDescription('Register an asset to a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User').setRequired(true))
    .addStringOption(option =>
      option.setName('item').setDescription('Item name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your registered assets'),

  new SlashCommandBuilder()
    .setName('remove-item')
    .setDescription('Remove an asset from a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User').setRequired(true))
    .addStringOption(option =>
      option.setName('item').setDescription('Item name').setRequired(true)),

  // 🏥 MEDPOINT DISPLAY
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

// ===== Bot Ready =====
client.once('ready', () => {
  console.log(`Online as ${client.user.tag}`);
});

// ===== Command Handling =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user, options } = interaction;

  if (!balances[user.id]) balances[user.id] = 0;
  if (!inventories[user.id]) inventories[user.id] = [];

  // 🏥 MEDPOINT SHOP DISPLAY
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

  // BALANCE
  if (commandName === 'balance') {
    return interaction.reply(
      `Central Banking confirms a balance of **${balances[user.id]} credits**.`
    );
  }

  // GIVE (Port Authority only)
  if (commandName === 'give') {
    const member = interaction.member;
    const hasRole = member.roles.cache.some(role => role.name === "Port Authority");

    if (!hasRole) {
      return interaction.reply("Access denied. Central Banking recognizes no authority.");
    }

    const target = options.getUser('user');
    const amount = options.getInteger('amount');

    if (!balances[target.id]) balances[target.id] = 0;
    balances[target.id] += amount;

    return interaction.reply(
      `Port Authority authorized a disbursement of **${amount} credits** to ${target.username}.`
    );
  }

  // GRANT ITEM (Port Authority only)
  if (commandName === 'grant-item') {
    const member = interaction.member;
    const hasRole = member.roles.cache.some(role => role.name === "Port Authority");

    if (!hasRole) {
      return interaction.reply("Access denied. Central Banking recognizes no authority.");
    }

    const target = options.getUser('user');
    const item = options.getString('item');

    if (!inventories[target.id]) inventories[target.id] = [];
    inventories[target.id].push(item);

    return interaction.reply(
      `Asset registered to ${target.username}: **${item}**`
    );
  }

  // INVENTORY
  if (commandName === 'inventory') {
    const items = inventories[user.id];

    if (!items.length) {
      return interaction.reply('No registered assets.');
    }

    return interaction.reply(
      `Registered Assets:\n• ${items.join('\n• ')}`
    );
  }

  // REMOVE ITEM (Port Authority only)
  if (commandName === 'remove-item') {
    const member = interaction.member;
    const hasRole = member.roles.cache.some(role => role.name === "Port Authority");

    if (!hasRole) {
      return interaction.reply("Access denied. Central Banking recognizes no authority.");
    }

    const target = options.getUser('user');
    const item = options.getString('item');

    inventories[target.id] = inventories[target.id].filter(i => i !== item);

    return interaction.reply(
      `Asset removed from ${target.username}: **${item}**`
    );
  }
});

client.login(token);

// Prevent Render worker from exiting
setInterval(() => {}, 1000 * 60 * 60);
