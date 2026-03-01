const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionsBitField } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

///////////////////////////
// SAFE REPLY (prevents crashes)
///////////////////////////
async function safeReply(interaction, payload) {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (err) {
    console.error("Reply failed:", err.message);
  }
}

///////////////////////////
// DATA STORES
///////////////////////////
const balances = new Map();
const inventories = new Map();
const statuses = new Map();
const addictionTimers = new Map();

///////////////////////////
// DEFAULTS
///////////////////////////
function getBalance(id) {
  if (!balances.has(id)) balances.set(id, 300);
  return balances.get(id);
}

function getInventory(id) {
  if (!inventories.has(id)) inventories.set(id, {});
  return inventories.get(id);
}

function getStatus(id) {
  if (!statuses.has(id)) statuses.set(id, {});
  return statuses.get(id);
}

///////////////////////////
// SHOPS
///////////////////////////
const shops = {
  medshop: {
    "nanobot healing vials": 75,
    "portable blood toxin filters": 120,
    "oxygen rebreather masks": 150,
    "detox injectors": 100,
    "neural stabilizer shots": 200
  },
  chopshop: {
    "raze": 250
  }
};

///////////////////////////
// COMMANDS
///////////////////////////
const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Check credits'),
  new SlashCommandBuilder().setName('inventory').setDescription('View inventory'),
  new SlashCommandBuilder().setName('status').setDescription('View status effects'),

  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View a shop')
    .addStringOption(o =>
      o.setName('name')
        .setDescription('medshop or chopshop')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item')
    .addStringOption(o => o.setName('shop').setRequired(true))
    .addStringOption(o => o.setName('item').setRequired(true)),

  new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an item')
    .addStringOption(o => o.setName('item').setRequired(true)),

  new SlashCommandBuilder()
    .setName('givecredits')
    .setDescription('Admin give credits')
    .addUserOption(o => o.setName('user').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('giveitem')
    .setDescription('Admin give item')
    .addUserOption(o => o.setName('user').setRequired(true))
    .addStringOption(o => o.setName('item').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log("Commands registered");
})();

client.once('clientReady', () => console.log(`Online as ${client.user.tag}`));

///////////////////////////
// ADDICTION TIMER SYSTEM
///////////////////////////
function startWithdrawal(userId) {
  clearInterval(addictionTimers.get(userId));

  let ticks = 0;

  const interval = setInterval(() => {
    ticks++;
    const status = getStatus(userId);
    status.razeAddicted = true;

    if (ticks >= 3) {
      clearInterval(interval);
      addictionTimers.delete(userId);
    }
  }, 5 * 60 * 1000); // 5 minutes

  addictionTimers.set(userId, interval);
}

///////////////////////////
// INTERACTIONS
///////////////////////////
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  ////////////////// BALANCE
  if (interaction.commandName === 'balance') {
    return safeReply(interaction, `Balance: ${getBalance(userId)} credits`);
  }

  ////////////////// INVENTORY
  if (interaction.commandName === 'inventory') {
    const inv = getInventory(userId);
    if (!Object.keys(inv).length) return safeReply(interaction, "Inventory empty.");
    return safeReply(interaction, Object.entries(inv).map(([k,v]) => `${k}: ${v}`).join('\n'));
  }

  ////////////////// STATUS
  if (interaction.commandName === 'status') {
    const status = getStatus(userId);
    if (!Object.keys(status).length) return safeReply(interaction, "No active effects.");
    return safeReply(interaction, JSON.stringify(status, null, 2));
  }

  ////////////////// SHOP
  if (interaction.commandName === 'shop') {
    const name = interaction.options.getString('name').toLowerCase();
    if (!shops[name]) return safeReply(interaction, "Shop not found.");
    const items = Object.entries(shops[name]).map(([k,v]) => `${k} — ${v} credits`).join('\n');
    return safeReply(interaction, items);
  }

  ////////////////// BUY
  if (interaction.commandName === 'buy') {
    const shop = interaction.options.getString('shop').toLowerCase();
    const item = interaction.options.getString('item').toLowerCase();

    if (!shops[shop] || !shops[shop][item]) {
      return safeReply(interaction, "Item not found.");
    }

    const price = shops[shop][item];
    const balance = getBalance(userId);

    if (balance < price) {
      return safeReply(interaction, "Not enough credits.");
    }

    balances.set(userId, balance - price);
    const inv = getInventory(userId);
    inv[item] = (inv[item] || 0) + 1;

    return safeReply(interaction, `Purchased ${item}.`);
  }

  ////////////////// USE ITEM
  if (interaction.commandName === 'use') {
    const item = interaction.options.getString('item').toLowerCase();
    const inv = getInventory(userId);

    if (!inv[item]) return safeReply(interaction, "You don't have that item.");

    inv[item]--;

    if (item === "raze") {
      const addicted = Math.random() < 0.5;
      const status = getStatus(userId);

      if (addicted) {
        status.razeAddicted = true;
        startWithdrawal(userId);
      }

      const responses = addicted ? [
        "As you use Raze, you feel unstoppable.",
        "Your pulse hammers — power surges through every nerve.",
        "The world slows. You feel built for war.",
        "Your body hums with violent potential."
      ] : [
        "The Raze hits your system and your senses are sharpened.",
        "As the Raze hits your system you bounce in place to burn off the excess energy.",
        "The Raze floods your system and you feel warm and tingly.",
        "A surge of focus locks your mind into perfect clarity."
      ];

      return safeReply(interaction, { content: responses[Math.floor(Math.random()*responses.length)], ephemeral: true });
    }

    return safeReply(interaction, `${item} used.`);
  }

  ////////////////// ADMIN GIVE CREDITS
  if (interaction.commandName === 'givecredits') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return safeReply(interaction, { content: "No permission.", ephemeral: true });

    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    balances.set(user.id, getBalance(user.id) + amount);
    return safeReply(interaction, `Gave ${amount} credits to ${user.tag}`);
  }

  ////////////////// ADMIN GIVE ITEM
  if (interaction.commandName === 'giveitem') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return safeReply(interaction, { content: "No permission.", ephemeral: true });

    const user = interaction.options.getUser('user');
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    const inv = getInventory(user.id);
    inv[item] = (inv[item] || 0) + amount;

    return safeReply(interaction, `Gave ${amount} ${item} to ${user.tag}`);
  }

});

client.login(TOKEN);
