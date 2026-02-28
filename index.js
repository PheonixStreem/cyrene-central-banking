const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===== Storage =====
const balances = {};
const inventories = {};

// ===== MedPoint Items =====
const medpointItems = {
  "med stim": { name: "Med Stim", price: 150 },
  "recovery potion": { name: "Recovery Potion", price: 250 },
  "nanobot healing vials": { name: "Nanobot Healing Vials", price: 350 },
  "blood toxin filter": { name: "Portable Blood-Toxin Filters", price: 180 },
  "oxygen mask": { name: "Oxygen Rebreather Mask", price: 220 },
  "detox injector": { name: "Detox Injector", price: 200 },
  "neural stabilizer": { name: "Neural Stabilizer Shot", price: 300 }
};

// ===== Commands =====
const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your credits'),

  new SlashCommandBuilder()
    .setName('medpoint')
    .setDescription('View MedPoint inventory'),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Purchase an item from MedPoint')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Item name (flexible)')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('quantity')
        .setDescription('Amount to purchase')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your registered assets')
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

  if (!balances[user.id]) balances[user.id] = 500; // starter credits for testing
  if (!inventories[user.id]) inventories[user.id] = [];

  // SHOW MEDPOINT
  if (commandName === 'medpoint') {
    const list = Object.values(medpointItems)
      .map(item => `• ${item.name} — ${item.price} credits`)
      .join('\n');

    return interaction.reply(`**MedPoint Inventory**\n${list}`);
  }

  // FLEXIBLE BUY
  if (commandName === 'buy') {
    const input = options.getString('item').toLowerCase();
    const quantity = options.getInteger('quantity');

    const match = Object.keys(medpointItems).find(key =>
      input.includes(key) || key.includes(input)
    );

    if (!match) {
      return interaction.reply("MedPoint doesn't recognize that item.");
    }

    const item = medpointItems[match];
    const totalCost = item.price * quantity;

    if (balances[user.id] < totalCost) {
      return interaction.reply("Insufficient credits.");
    }

    balances[user.id] -= totalCost;

    for (let i = 0; i < quantity; i++) {
      inventories[user.id].push(item.name);
    }

    return interaction.reply(
      `Purchase approved. ${quantity} × ${item.name} added to registered assets.`
    );
  }

  // BALANCE
  if (commandName === 'balance') {
    return interaction.reply(
      `Central Banking confirms a balance of **${balances[user.id]} credits**.`
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
});

client.login(token);
setInterval(() => {}, 1000 * 60 * 60);
