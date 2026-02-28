const { Client, GatewayIntentBits, SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Storage
let accounts = {};
let inventories = {};

// 🏥 MedPoint Shop
const medpointShop = {
  "Med Stim": 150,
  "Recovery Potion": 250,
  "Nanobot Healing Vials": 350,
  "Portable Blood-Toxin Filters": 180,
  "Oxygen Rebreather Mask": 220,
  "Detox Injector": 200,
  "Neural Stabilizer Shot": 300
};

// Commands
const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Check your credits'),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Disburse credits')
    .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(option => option.setName('amount').setDescription('Amount').setRequired(true)),

  new SlashCommandBuilder().setName('inventory').setDescription('View registered assets'),

  new SlashCommandBuilder()
    .setName('grant-item')
    .setDescription('Register an asset to a user')
    .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
    .addStringOption(option => option.setName('item').setDescription('Item name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('remove-item')
    .setDescription('Remove an asset from a user')
    .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
    .addStringOption(option => option.setName('item').setDescription('Item name').setRequired(true)),

  // 🏥 Shop command
  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View shop inventory')
    .addStringOption(option =>
      option.setName('location')
        .setDescription('Shop name')
        .setRequired(true)
        .addChoices({ name: 'MedPoint', value: 'medpoint' })
    ),

  // 🛒 Buy command
  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Purchase an item')
    .addStringOption(option =>
      option.setName('location')
        .setDescription('Shop name')
        .setRequired(true)
        .addChoices({ name: 'MedPoint', value: 'medpoint' })
    )
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Item name')
        .setRequired(true)
    ),
];

const rest = new REST({ version: '10' }).setToken(token);
rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  if (!accounts[userId]) accounts[userId] = 0;
  if (!inventories[userId]) inventories[userId] = [];

  // /balance
  if (interaction.commandName === 'balance') {
    return interaction.reply(`Central Banking confirms a balance of **${accounts[userId]} credits**.`);
  }

  // /give
  if (interaction.commandName === 'give') {
    const member = interaction.member;
    const hasRole = member.roles.cache.some(role => role.name === "Port Authority");

    if (!hasRole) {
      return interaction.reply("Access denied. Central Banking recognizes no authority.");
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (!accounts[target.id]) accounts[target.id] = 0;
    accounts[target.id] += amount;

    return interaction.reply(`Port Authority authorized a disbursement of **${amount} credits** to ${target.username}.`);
  }

  // /inventory
  if (interaction.commandName === 'inventory') {
    const items = inventories[userId];

    if (!items || items.length === 0) {
      return interaction.reply("No registered assets.");
    }

    const list = items.map(item => `• ${item}`).join('\n');
    return interaction.reply(`Registered Assets:\n${list}`);
  }

  // /shop
  if (interaction.commandName === 'shop') {
    const location = interaction.options.getString('location');

    if (location === 'medpoint') {
      const items = Object.entries(medpointShop)
        .map(([name, price]) => `• ${name} — ${price} credits`)
        .join('\n');

      return interaction.reply(`**MedPoint Inventory**\n${items}`);
    }
  }

  // /buy
  if (interaction.commandName === 'buy') {
    const location = interaction.options.getString('location');
    const itemName = interaction.options.getString('item');

    if (location === 'medpoint') {
      const price = medpointShop[itemName];

      if (!price) return interaction.reply("Item not found.");

      if (accounts[userId] < price) {
        return interaction.reply("Insufficient credits.");
      }

      accounts[userId] -= price;
      inventories[userId].push(itemName);

      return interaction.reply(`Purchase approved. ${itemName} added to registered assets.`);
    }
  }
});

client.login(token);];

const rest = new REST({ version: '10' }).setToken(token);
rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  if (!accounts[userId]) accounts[userId] = 0;
  if (!inventories[userId]) inventories[userId] = [];

  // /balance
  if (interaction.commandName === 'balance') {
    return interaction.reply(`Central Banking confirms a balance of **${accounts[userId]} credits**.`);
  }

  // /give
  if (interaction.commandName === 'give') {
    const member = interaction.member;
    const hasRole = member.roles.cache.some(role => role.name === "Port Authority");

    if (!hasRole) {
      return interaction.reply("Access denied. Central Banking recognizes no authority.");
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (!accounts[target.id]) accounts[target.id] = 0;
    accounts[target.id] += amount;

    return interaction.reply(`Port Authority authorized a disbursement of **${amount} credits** to ${target.username}.`);
  }

  // /inventory
  if (interaction.commandName === 'inventory') {
    const items = inventories[userId];

    if (!items || items.length === 0) {
      return interaction.reply("No registered assets.");
    }

    const list = items.map(item => `• ${item}`).join('\n');
    return interaction.reply(`Registered Assets:\n${list}`);
  }

  // /grant-item
  if (interaction.commandName === 'grant-item') {
    const member = interaction.member;
    const hasRole = member.roles.cache.some(role => role.name === "Port Authority");

    if (!hasRole) {
      return interaction.reply("Access denied. Central Banking recognizes no authority.");
    }

    const target = interaction.options.getUser('user');
    const itemName = interaction.options.getString('item');

    if (!inventories[target.id]) inventories[target.id] = [];
    inventories[target.id].push(itemName);

    return interaction.reply(`Asset registered to ${target.username}: **${itemName}**`);
  }

  // /remove-item
  if (interaction.commandName === 'remove-item') {
    const member = interaction.member;
    const hasRole = member.roles.cache.some(role => role.name === "Port Authority");

    if (!hasRole) {
      return interaction.reply("Access denied. Central Banking recognizes no authority.");
    }

    const target = interaction.options.getUser('user');
    const itemName = interaction.options.getString('item');

    if (!inventories[target.id]) inventories[target.id] = [];

    inventories[target.id] = inventories[target.id].filter(item => item !== itemName);

    return interaction.reply(`Asset removed from ${target.username}: **${itemName}**`);
  }
});

client.login(token);
