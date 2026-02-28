require('dotenv').config();

const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');

console.log("Booting Cyrene Central Banking...");
console.log("TOKEN present:", !!process.env.TOKEN);
console.log("CLIENT_ID present:", !!process.env.CLIENT_ID);
console.log("GUILD_ID present:", !!process.env.GUILD_ID);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ================= MEMORY STORAGE =================

const balances = {};
const inventories = {};

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

// ================= MED SHOP =================

const medShop = {
  "Med Stim": 50,
  "Recovery Potion": 75,
  "Nanobot Healing Vial": 120,
  "Oxygen Rebreather Mask": 90,
  "Detox Injector": 110,
  "Neural Stabilizer Shot": 140
};

// ================= COMMANDS =================

const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('View credits'),
  new SlashCommandBuilder().setName('inventory').setDescription('View inventory'),
  new SlashCommandBuilder().setName('medshop').setDescription('View med shop'),
  new SlashCommandBuilder()
    .setName('medbuy')
    .setDescription('Buy med items')
    .addStringOption(o =>
      o.setName('item')
        .setDescription('Item')
        .setRequired(true)
        .addChoices(...Object.keys(medShop).map(name => ({ name, value: name })))
    )
    .addIntegerOption(o =>
      o.setName('quantity')
        .setDescription('Amount')
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

// ================= REGISTER COMMANDS =================

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    console.log("Registering slash commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("Slash commands registered.");
  } catch (err) {
    console.error("Command registration error:", err);
  }
}

// ================= INTERACTIONS =================

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

    const list = Object.entries(inv).map(([i, q]) => `${i} x${q}`).join('\n');
    return interaction.reply(`Inventory:\n${list}`);
  }

  if (interaction.commandName === 'medshop') {
    const list = Object.entries(medShop)
      .map(([i, p]) => `${i} — ${p} credits`)
      .join('\n');
    return interaction.reply(`Med Shop:\n${list}`);
  }

  if (interaction.commandName === 'medbuy') {
    const item = interaction.options.getString('item');
    const qty = interaction.options.getInteger('quantity');

    if (!medShop[item]) return interaction.reply("Item not found.");

    const cost = medShop[item] * qty;
    const bal = getBalance(userId);

    if (bal < cost)
      return interaction.reply(`Need ${cost} credits. You have ${bal}.`);

    addCredits(userId, -cost);
    addItem(userId, item, qty);

    return interaction.reply(`Purchased ${qty} ${item} for ${cost} credits.`);
  }
});

// ================= START BOT =================

client.once('clientReady', async () => {
  console.log(`Online as ${client.user.tag}`);
  await registerCommands();
});

client.login(process.env.TOKEN);
