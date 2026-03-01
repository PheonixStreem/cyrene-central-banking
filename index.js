const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.TOKEN;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', () => console.log(`Online as ${client.user.tag}`));

client.login(TOKEN);

/* ===== Credits ===== */

const balances = new Map();
const getBalance = id => balances.has(id) ? balances.get(id) : (balances.set(id, 300), 300);

/* ===== Inventory ===== */

const inventories = new Map();
const getInventory = id => inventories.has(id) ? inventories.get(id) : (inventories.set(id, {}), inventories.get(id));

/* ===== Command Handler ===== */

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // BALANCE
  if (interaction.commandName === 'balance')
    return interaction.reply(`Balance: ${getBalance(interaction.user.id)} credits`);

  // INVENTORY
  if (interaction.commandName === 'inventory')
    return interaction.reply(
      Object.keys(getInventory(interaction.user.id)).length
        ? 'Your inventory:\n' + Object.entries(getInventory(interaction.user.id)).map(([i,q]) => `${i}: ${q}`).join('\n')
        : 'Your inventory is empty.'
    );

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
