const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

/* ================= STORAGE ================= */

const balances = new Map();
const inventories = new Map();

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

    if (Object.keys(inv).length === 0) {
      return interaction.reply('Your inventory is empty.');
    }

    const list = Object.entries(inv)
      .map(([item, qty]) => `${item}: ${qty}`)
      .join('\n');

    return interaction.reply(`Your inventory:\n${list}`);
  }

  /* ---------- GIVE CREDITS (ADMIN) ---------- */
  if (interaction.commandName === 'give') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    const newBalance = getBalance(target.id) + amount;
    balances.set(target.id, newBalance);

    return interaction.reply(`Gave ${amount} credits to ${target.tag}. New balance: ${newBalance}`);
  }

  /* ---------- GIVE ITEM (ADMIN) ---------- */
  if (interaction.commandName === 'giveitem') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    if (amount <= 0) {
      return interaction.reply({ content: 'Amount must be positive.', ephemeral: true });
    }

    const inv = getInventory(target.id);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply(`Gave ${amount} ${item}(s) to ${target.tag}.`);
  }
});

client.login(TOKEN);
