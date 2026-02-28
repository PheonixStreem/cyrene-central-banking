const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionsBitField } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// In-memory storage
const balances = {};
const inventory = {};

// Starter credits
function ensureUser(userId) {
  if (!balances[userId]) balances[userId] = 300;
  if (!inventory[userId]) inventory[userId] = [];
}

// Med shop items
const medShop = {
  "med stim": 50,
  "recovery potion": 75,
  "nanobot healing vial": 120,
  "detox injector": 90,
  "oxygen rebreather mask": 140
};

// Slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your credit balance'),

  new SlashCommandBuilder()
    .setName('medshop')
    .setDescription('View medical shop items'),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item from the med shop')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Item name')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('How many to buy')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Admin: give credits to a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to give credits to')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of credits')
        .setRequired(true))
].map(cmd => cmd.toJSON());

// Register commands
client.once('ready', async () => {
  console.log(`Online as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log('Commands registered.');
});

// Command handling
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  ensureUser(userId);

  // BALANCE
  if (interaction.commandName === 'balance') {
    return interaction.reply(`Balance: ${balances[userId]} credits`);
  }

  // MED SHOP
  if (interaction.commandName === 'medshop') {
    let shopText = "**Medical Shop**\n";
    for (const item in medShop) {
      shopText += `• ${item} — ${medShop[item]} credits\n`;
    }
    return interaction.reply(shopText);
  }

  // BUY
  if (interaction.commandName === 'buy') {
    const itemName = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount') || 1;

    if (!medShop[itemName]) {
      return interaction.reply(`Item not found: ${itemName}`);
    }

    const totalCost = medShop[itemName] * amount;

    if (balances[userId] < totalCost) {
      return interaction.reply(`Not enough credits. Need ${totalCost}.`);
    }

    balances[userId] -= totalCost;

    for (let i = 0; i < amount; i++) {
      inventory[userId].push(itemName);
    }

    return interaction.reply(`Purchased ${amount} ${itemName}(s) for ${totalCost} credits.`);
  }

  // GIVE (ADMIN ONLY)
  if (interaction.commandName === 'give') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "Admin only.", ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    ensureUser(target.id);
    balances[target.id] += amount;

    return interaction.reply(`Gave ${amount} credits to ${target.username}.`);
  }
});

client.login(TOKEN);
