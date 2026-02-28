require('dotenv').config();

const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

console.log("Starting Cyrene Central Banking...");
console.log("TOKEN exists:", !!process.env.TOKEN);
console.log("SUPABASE_URL exists:", !!process.env.SUPABASE_URL);

// Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Discord Client
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('clientReady', () => {
  console.log(`Online as ${client.user.tag}`);
});

// =========================
// MED SHOP ITEMS
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
// DATABASE FUNCTIONS
// =========================

async function getBalance(userId) {
  const { data } = await supabase
    .from('balances')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!data) {
    await supabase.from('balances').insert({ user_id: userId, credits: 300 });
    return 300;
  }

  return data.credits;
}

async function updateBalance(userId, amount) {
  const balance = await getBalance(userId);
  const newBalance = balance + amount;

  await supabase
    .from('balances')
    .upsert({ user_id: userId, credits: newBalance });

  return newBalance;
}

async function addItem(userId, item, qty) {
  for (let i = 0; i < qty; i++) {
    await supabase.from('inventory').insert({ user_id: userId, item });
  }
}

async function getInventory(userId) {
  const { data } = await supabase
    .from('inventory')
    .select('item')
    .eq('user_id', userId);

  if (!data || data.length === 0) return [];

  const counts = {};
  data.forEach(row => {
    counts[row.item] = (counts[row.item] || 0) + 1;
  });

  return counts;
}

// =========================
// COMMAND HANDLER
// =========================

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  // /balance
  if (interaction.commandName === 'balance') {
    const credits = await getBalance(userId);
    return interaction.reply(`Balance: ${credits} credits`);
  }

  // /inventory
  if (interaction.commandName === 'inventory') {
    const items = await getInventory(userId);

    if (Object.keys(items).length === 0)
      return interaction.reply("Inventory is empty.");

    const list = Object.entries(items)
      .map(([item, qty]) => `${item} x${qty}`)
      .join('\n');

    return interaction.reply(`Your Inventory:\n${list}`);
  }

  // /medshop
  if (interaction.commandName === 'medshop') {
    const list = Object.entries(medShop)
      .map(([item, price]) => `${item} — ${price} credits`)
      .join('\n');

    return interaction.reply(`Med Shop:\n${list}`);
  }

  // /medbuy
  if (interaction.commandName === 'medbuy') {
    const item = interaction.options.getString('item');
    const qty = interaction.options.getInteger('quantity');

    if (!medShop[item]) {
      return interaction.reply("Item not found in med shop.");
    }

    const totalCost = medShop[item] * qty;
    const balance = await getBalance(userId);

    if (balance < totalCost) {
      return interaction.reply(`Insufficient credits. Need ${totalCost}, you have ${balance}.`);
    }

    await updateBalance(userId, -totalCost);
    await addItem(userId, item, qty);

    return interaction.reply(`Purchased ${qty} ${item} for ${totalCost} credits.`);
  }
});

// =========================
// REGISTER COMMANDS
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
    .setDescription('View medical shop items'),

  new SlashCommandBuilder()
    .setName('medbuy')
    .setDescription('Buy medical items')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Item name')
        .setRequired(true)
        .addChoices(
          ...Object.keys(medShop).map(name => ({ name, value: name }))
        ))
    .addIntegerOption(option =>
      option.setName('quantity')
        .setDescription('Amount to buy')
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
