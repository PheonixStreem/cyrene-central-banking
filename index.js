import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from 'discord.js';
import { createClient } from '@supabase/supabase-js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== SUPABASE =====
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ===== MED SHOP ITEMS =====
const medShop = {
  "med stim": 50,
  "recovery potion": 75,
  "nanobot healing vial": 120,
  "oxygen rebreather mask": 90,
  "detox injector": 60,
  "neural stabilizer shot": 110
};

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Check your credits'),
  new SlashCommandBuilder().setName('inventory').setDescription('View your inventory'),
  new SlashCommandBuilder()
    .setName('medshop')
    .setDescription('View medical shop items'),
  new SlashCommandBuilder()
    .setName('medbuy')
    .setDescription('Buy medical items')
    .addStringOption(opt =>
      opt.setName('item')
        .setDescription('Item name')
        .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Amount to buy')
        .setRequired(true))
];

// ===== REGISTER COMMANDS =====
client.once('ready', async () => {
  console.log(`Online as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log('Commands registered.');
});

// ===== NEW USER DEFAULT BALANCE =====
async function ensureUser(userId) {
  const { data } = await supabase
    .from('balances')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!data) {
    await supabase.from('balances').insert({ user_id: userId, credits: 300 });
  }
}

// ===== COMMAND HANDLER =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  await ensureUser(userId);

  // ===== BALANCE =====
  if (interaction.commandName === 'balance') {
    const { data } = await supabase
      .from('balances')
      .select('credits')
      .eq('user_id', userId)
      .single();

    return interaction.reply(`Central Banking confirms a balance of **${data.credits} credits**.`);
  }

  // ===== INVENTORY =====
  if (interaction.commandName === 'inventory') {
    const { data } = await supabase
      .from('inventory')
      .select('item')
      .eq('user_id', userId);

    if (!data || data.length === 0) {
      return interaction.reply('No registered assets.');
    }

    const items = data.map(i => `• ${i.item}`).join('\n');
    return interaction.reply(`Registered Assets:\n${items}`);
  }

  // ===== MED SHOP =====
  if (interaction.commandName === 'medshop') {
    const list = Object.entries(medShop)
      .map(([item, price]) => `• ${item} — ${price} credits`)
      .join('\n');

    return interaction.reply(`🩺 **Cyrene Medical Supply**\n${list}`);
  }

  // ===== BUY MED ITEM =====
  if (interaction.commandName === 'medbuy') {
    const itemName = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    if (!medShop[itemName]) {
      return interaction.reply('Item not found in medical shop.');
    }

    const totalCost = medShop[itemName] * amount;

    const { data } = await supabase
      .from('balances')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (data.credits < totalCost) {
      return interaction.reply('Insufficient credits.');
    }

    // Deduct credits
    await supabase
      .from('balances')
      .update({ credits: data.credits - totalCost })
      .eq('user_id', userId);

    // Add items
    for (let i = 0; i < amount; i++) {
      await supabase.from('inventory').insert({
        user_id: userId,
        item: itemName
      });
    }

    return interaction.reply(`Purchased ${amount} ${itemName}(s) for ${totalCost} credits.`);
  }
});

client.login(process.env.DISCORD_TOKEN);
