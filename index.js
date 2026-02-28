require('dotenv').config();

const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');

console.log("Starting Cyrene Central Banking...");
console.log("TOKEN exists:", !!process.env.TOKEN);
console.log("CLIENT_ID exists:", !!process.env.CLIENT_ID);

// Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('clientReady', () => {
  console.log(`Online as ${client.user.tag}`);
});

// =========================
// MEMORY STORAGE
// =========================

const balances = {};
const inventories = {};

// =========================
// MED SHOP
// =========================

const medShop = {
  "Med Stim": 50,
  "Recovery Potion": 75,
  "Nanobot Healing Vial": 120,
  "Oxygen Rebreather Mask": 90,
  "Detox Injector": 110,
  "Neural Stabilizer Shot": 140
};

// =========================
// HELPERS
// =========================

function getBalance(userId) {
  if (!balances[userId]) balances[userId] = 300;
  return balances[userId];
}

function addCredits(userId, amount) {
  balances[userId] = getBalance(userId) + amount;
}

function addItem(userId, item, qty) {
  if (!inventories[userId]) inventories[userId] = {};
  inventories[userId][item] = (inventories[userId][item] || 0) + qty;
}

// =========================
// COMMAND HANDLER
// =========================

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  if (interaction.commandName === 'balance') {
    return interaction.reply(`Balance: ${getBalance(userId)} credits`);
  }

  if (interaction.commandName === 'inventory') {
    const inv = inventories[userId];

    if (!inv || Object.keys(inv).length === 0)
      return interaction.reply("Inventory is empty.");

    const list = Object.entries(inv)
      .map(([item, qty]) => `${item} x${qty}`)
      .join('\n');

    return interaction.reply(`Your Inventory:\n${list}`);
  }

  if (interaction.commandName === 'medshop') {
    const list = Object.entries(medShop)
      .map(([item, price]) => `${item} — ${price} credits`)
      .join('\n');

    return interaction.reply(`Med Shop:\n${list}`);
  }

  if (interaction.commandName === 'medbuy') {
    const item = interaction.options.getString('item');
    const qty = interaction.options.getInteger('quantity');

    if (!medShop[item]) {
      return interaction.reply("Item not found.");
    }

    const cost = medShop[item] * qty;
    const balance = getBalance(userId);

    if (balance < cost) {
      return interaction.reply(`You need ${cost} credits but only have ${balance}.`);
    }

    addCredits(userId, -cost);
    addItem(userId, item, qty);

    return interaction.reply(`Purchased ${qty} ${item} for ${cost} credits.`);
  }
});

// =========================
// SLASH COMMANDS
// =========================

const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('View your credits'),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your inventory'),

  new SlashCommandBuilder()
    .setName('medshop')
    .setDescription('View medical shop'),

  new SlashCommandBuilder()
    .setName('medbuy')
    .setDescription('Buy medical items')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Item')
        .setRequired(true)
        .addChoices(
          ...Object.keys(medShop).map(name => ({ name, value: name }))
        ))
    .addIntegerOption(option =>
      option.setName('quantity')
        .setDescription('Amount')
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Registering commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('Commands registered.');
  } catch (error) {
    console.error(error);
  }
})();

client.login(process.env.TOKEN);
