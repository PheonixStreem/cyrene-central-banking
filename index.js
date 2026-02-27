const { Client, GatewayIntentBits, SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Storage
let accounts = {};
let inventories = {};

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
