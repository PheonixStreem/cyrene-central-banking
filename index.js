const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

/* ================= STORAGE ================= */

const balances = new Map();
const inventories = new Map();

/* ================= SHOP ITEMS ================= */

const shop = {
  medkit: 50,
  stim: 75,
  nanobots: 120,
  rebreather: 90
};

/* ================= HELPERS ================= */

function getBalance(userId) {
  if (!balances.has(userId)) balances.set(userId, 300);
  return balances.get(userId);
}

function getInventory(userId) {
  if (!inventories.has(userId)) inventories.set(userId, {});
  return inventories.get(userId);
}

/* ================= READY ================= */

client.once('clientReady', () => {
  console.log(`Online as ${client.user.tag}`);
});

/* ================= NEW MEMBER ================= */

client.on('guildMemberAdd', member => {
  balances.set(member.id, 300);
  inventories.set(member.id, {});
});

/* ================= COMMAND HANDLER ================= */

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  /* ---------- BALANCE ---------- */
  if (interaction.commandName === 'balance') {
    return interaction.reply(`Balance: ${getBalance(userId)} credits`);
  }

  /* ---------- INVENTORY ---------- */
  if (interaction.commandName === 'inventory') {
    const inv = getInventory(userId);
    if (Object.keys(inv).length === 0)
      return interaction.reply('Your inventory is empty.');

    const list = Object.entries(inv).map(([i,q]) => `${i}: ${q}`).join('\n');
    return interaction.reply(`Your inventory:\n${list}`);
  }

  /* ---------- SHOP ---------- */
  if (interaction.commandName === 'shop') {
    const items = Object.entries(shop)
      .map(([item, price]) => `${item} — ${price} credits`)
      .join('\n');
    return interaction.reply(`Available items:\n${items}`);
  }

  /* ---------- BUY ---------- */
  if (interaction.commandName === 'buy') {
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    if (!shop[item]) return interaction.reply('Item not found.');

    const cost = shop[item] * amount;
    const balance = getBalance(userId);

    if (balance < cost) {
      return interaction.reply(`You need ${cost} credits but have ${balance}.`);
    }

    balances.set(userId, balance - cost);

    const inv = getInventory(userId);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply(`Purchased ${amount} ${item}(s) for ${cost} credits.`);
  }

  /* ---------- GIVE CREDITS (ADMIN) ---------- */
  if (interaction.commandName === 'give') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: 'No permission.', ephemeral: true });

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    balances.set(target.id, getBalance(target.id) + amount);
    return interaction.reply(`Gave ${amount} credits to ${target.tag}.`);
  }

  /* ---------- GIVE ITEM (ADMIN) ---------- */
  if (interaction.commandName === 'giveitem') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: 'No permission.', ephemeral: true });

    const target = interaction.options.getUser('user');
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    const inv = getInventory(target.id);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply(`Gave ${amount} ${item}(s) to ${target.tag}.`);
  }
});

client.login(TOKEN);
