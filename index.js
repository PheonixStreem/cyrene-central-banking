const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===== In-memory storage =====
const balances = {};
const inventories = {};

// ===== MedPoint Shop =====
const medpointItems = {
  "Med Stim": 150,
  "Recovery Potion": 250,
  "Nanobot Healing Vials": 350,
  "Portable Blood-Toxin Filters": 180,
  "Oxygen Rebreather Mask": 220,
  "Detox Injector": 200,
  "Neural Stabilizer Shot": 300
};

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
    .setDescription('View MedPoint medical inventory'),

  // 🛒 BUY (Dropdown Items)
  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Purchase an item from MedPoint')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Select item')
        .setRequired(true)
        .addChoices(
          { name: 'Med Stim', value: 'Med Stim' },
          { name: 'Recovery Potion', value: 'Recovery Potion' },
          { name: 'Nanobot Healing Vials', value: 'Nanobot Healing Vials' },
          { name: 'Portable Blood-Toxin Filters', value: 'Portable Blood-Toxin Filters' },
          { name: 'Oxygen Rebreather Mask', value: 'Oxygen Rebreather Mask' },
          { name: 'Detox Injector', value: 'Detox Injector' },
          { name: 'Neural Stabilizer Shot', value: 'Neural Stabilizer Shot' }
        ))
    .addIntegerOption(option =>
      option.setName('quantity')
        .setDescription('Amount to purchase')
        .setRequired(true))
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

  const { commandName, user, options } = interaction;

  if (!balances[user.id]) balances[user.id] = 0;
  if (!inventories[user.id]) inventories[user.id] = [];

  // 🏥 MEDPOINT DISPLAY
  if (commandName === 'medpoint') {
    const list = Object.entries(medpointItems)
      .map(([name, price]) => `• ${name} — ${price} credits`)
      .join('\n');

    return interaction.reply(`**MedPoint Inventory**\n${list}`);
  }

  // 🛒 BUY ITEMS
  if (commandName === 'buy') {
    const item = options.getString('item');
    const quantity = options.getInteger('quantity');

    const price = medpointItems[item];
    const totalCost = price * quantity;

    if (balances[user.id] < totalCost) {
      return interaction.reply("Insufficient credits.");
    }

    balances[user.id] -= totalCost;

    for (let i = 0; i < quantity; i++) {
      inventories[user.id].push(item);
    }

    return interaction.reply(
      `Purchase approved. ${quantity} × ${item} added to registered assets.`
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

    inventories[target.id].push(item);

    return interaction.reply(
      `Asset registered to ${target.username}: **${item}**`
    );
  }

  // INVENTORY
  if (commandName === 'inventory') {
    if (!inventories[user.id].length) {
      return interaction.reply('No registered assets.');
    }

    return interaction.reply(
      `Registered Assets:\n• ${inventories[user.id].join('\n• ')}`
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
