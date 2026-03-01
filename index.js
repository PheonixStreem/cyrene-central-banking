const { Client, GatewayIntentBits, SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/* ===== Credits ===== */

const balances = new Map();
const getBalance = id => balances.has(id) ? balances.get(id) : (balances.set(id, 300), 300);

/* ===== Inventory ===== */

const inventories = new Map();
const getInventory = id => inventories.has(id) ? inventories.get(id) : (inventories.set(id, {}), inventories.get(id));

/* ===== Med Shop Items ===== */

const medShop = {
  "nanobot healing vials": 120,
  "portable blood toxin filters": 150,
  "oxygen rebreather masks": 90,
  "detox injectors": 110,
  "neural stabilizer shots": 130
};

/* ===== Slash Command Definitions ===== */

const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Check credits'),
  new SlashCommandBuilder().setName('inventory').setDescription('View inventory'),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Admin: give credits')
    .addUserOption(o => o.setName('user').setRequired(true).setDescription('User'))
    .addIntegerOption(o => o.setName('amount').setRequired(true).setDescription('Amount')),

  new SlashCommandBuilder()
    .setName('giveitem')
    .setDescription('Admin: give item')
    .addUserOption(o => o.setName('user').setRequired(true).setDescription('User'))
    .addStringOption(o => o.setName('item').setRequired(true).setDescription('Item'))
    .addIntegerOption(o => o.setName('amount').setRequired(true).setDescription('Amount')),

  new SlashCommandBuilder()
    .setName('medshop')
    .setDescription('View available medical supplies'),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item from available shops')
    .addStringOption(o => o.setName('item').setRequired(true).setDescription('Item name'))
    .addIntegerOption(o => o.setName('amount').setRequired(true).setDescription('Quantity'))
].map(cmd => cmd.toJSON());

/* ===== Register Commands ===== */

client.once('clientReady', async () => {
  console.log(`Online as ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered.');
  } catch (err) {
    console.error('Registration error:', err);
  }
});

/* ===== Command Handler ===== */

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  // BALANCE
  if (interaction.commandName === 'balance')
    return interaction.reply(`Balance: ${getBalance(userId)} credits`);

  // INVENTORY
  if (interaction.commandName === 'inventory')
    return interaction.reply(
      Object.keys(getInventory(userId)).length
        ? 'Your inventory:\n' + Object.entries(getInventory(userId)).map(([i,q]) => `${i}: ${q}`).join('\n')
        : 'Your inventory is empty.'
    );

  // MED SHOP
  if (interaction.commandName === 'medshop') {
    const items = Object.entries(medShop)
      .map(([name, price]) => `${name} — ${price} credits`)
      .join('\n');
    return interaction.reply(`Available medical supplies:\n${items}`);
  }

  // BUY
  if (interaction.commandName === 'buy') {
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    if (!medShop[item]) return interaction.reply('Item not found in med shop.');

    const cost = medShop[item] * amount;
    const balance = getBalance(userId);

    if (balance < cost) {
      return interaction.reply(`You need ${cost} credits but only have ${balance}.`);
    }

    balances.set(userId, balance - cost);

    const inv = getInventory(userId);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply(`Purchased ${amount} ${item}(s) for ${cost} credits.`);
  }

  // GIVE CREDITS (ADMIN)
  if (interaction.commandName === 'give' && interaction.member.permissions.has('Administrator')) {
    const u = interaction.options.getUser('user');
    const a = interaction.options.getInteger('amount');
    balances.set(u.id, getBalance(u.id) + a);
    return interaction.reply(`Gave ${a} credits to ${u.tag}.`);
  }

  // GIVE ITEM (ADMIN)
  if (interaction.commandName === 'giveitem' && interaction.member.permissions.has('Administrator')) {
    const u = interaction.options.getUser('user');
    const item = interaction.options.getString('item').toLowerCase();
    const amt = interaction.options.getInteger('amount');
    const inv = getInventory(u.id);
    inv[item] = (inv[item] || 0) + amt;
    return interaction.reply(`Gave ${amt} ${item}(s) to ${u.tag}.`);
  }
});

client.login(TOKEN);
