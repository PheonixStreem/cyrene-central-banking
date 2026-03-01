const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionsBitField
} = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ============================
// DATA STORAGE (IN MEMORY)
// ============================

const balances = new Map();
const inventories = new Map();
const razeTimers = new Map();

function getBalance(userId) {
  if (!balances.has(userId)) balances.set(userId, 300);
  return balances.get(userId);
}

function getInventory(userId) {
  if (!inventories.has(userId)) inventories.set(userId, {});
  return inventories.get(userId);
}

// ============================
// SHOPS
// ============================

const shops = {
  med: {
    "nanobot healing vials": 40,
    "portable blood toxin filters": 35,
    "oxygen rebreather masks": 50,
    "detox injectors": 45,
    "neural stabilizer shots": 55
  },
  chopshop: {
    "raze": 120
  }
};

// ============================
// COMMANDS
// ============================

const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Check your credits'),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Admin: give credits')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View a shop')
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Shop name')
        .setRequired(true)
        .addChoices(
          { name: 'Med Shop', value: 'med' },
          { name: "Fahren's Chop Shop", value: 'chopshop' }
        )
    ),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item')
    .addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Quantity').setRequired(true)),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Check inventory'),

  new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an item')
    .addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true))
].map(c => c.toJSON());

// ============================
// REGISTER COMMANDS
// ============================

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands
    });
    console.log('Commands registered');
  } catch (err) {
    console.error(err);
  }
})();

// ============================
// BOT READY
// ============================

client.once('ready', () => {
  console.log(`Online as ${client.user.tag}`);
});

// ============================
// NEW MEMBER STARTING CREDITS
// ============================

client.on('guildMemberAdd', member => {
  balances.set(member.id, 300);
});

// ============================
// INTERACTIONS
// ============================

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  // BALANCE
  if (interaction.commandName === 'balance') {
    return interaction.reply(`Balance: ${getBalance(userId)} credits`);
  }

  // GIVE
  if (interaction.commandName === 'give') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'No permission', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    const newBalance = getBalance(user.id) + amount;
    balances.set(user.id, newBalance);

    return interaction.reply(`Gave ${amount} credits to ${user.tag}. New balance: ${newBalance}`);
  }

  // SHOP VIEW
  if (interaction.commandName === 'shop') {
    const name = interaction.options.getString('name');
    const shop = shops[name];

    let msg = `**${name.toUpperCase()} SHOP**\n`;
    for (const item in shop) {
      msg += `${item} — ${shop[item]} credits\n`;
    }

    return interaction.reply(msg);
  }

  // BUY
  if (interaction.commandName === 'buy') {
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    let price = null;
    for (const shop in shops) {
      if (shops[shop][item]) price = shops[shop][item];
    }

    if (!price) return interaction.reply({ content: 'Item not found.', ephemeral: true });

    const total = price * amount;
    const balance = getBalance(userId);

    if (balance < total) {
      return interaction.reply({ content: 'Not enough credits.', ephemeral: true });
    }

    balances.set(userId, balance - total);

    const inv = getInventory(userId);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply(`Purchased ${amount} ${item}.`);
  }

  // INVENTORY
  if (interaction.commandName === 'inventory') {
    const inv = getInventory(userId);
    if (Object.keys(inv).length === 0) {
      return interaction.reply('Inventory empty.');
    }

    let msg = '**Inventory**\n';
    for (const item in inv) {
      msg += `${item} x${inv[item]}\n`;
    }

    return interaction.reply(msg);
  }

  // USE ITEM
  if (interaction.commandName === 'use') {
    const item = interaction.options.getString('item').toLowerCase();
    const inv = getInventory(userId);

    if (!inv[item]) {
      return interaction.reply({ content: 'You do not have that item.', ephemeral: true });
    }

    inv[item]--;

    // RAZE EFFECT
    if (item === 'raze') {
      const addicted = Math.random() < 0.4;

      if (addicted) {
        interaction.user.send('The surge hits hard. Your body craves more.');

        if (razeTimers.has(userId)) clearInterval(razeTimers.get(userId));

        let warnings = 0;
        const timer = setInterval(() => {
          warnings++;

          interaction.user.send('Your body aches for another dose of Raze.');

          if (warnings >= 3) {
            interaction.user.send('Withdrawal sets in. Pain floods back.');
            clearInterval(timer);
            razeTimers.delete(userId);
          }
        }, 3 * 60 * 1000); // 3 min intervals

        razeTimers.set(userId, timer);
      }

      return interaction.reply('You inject Raze. Your nerves go silent.');
    }

    return interaction.reply(`Used ${item}.`);
  }
});

client.login(TOKEN);
