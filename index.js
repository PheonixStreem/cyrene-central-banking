const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  Routes,
  PermissionsBitField
} = require('discord.js');
const { REST } = require('@discordjs/rest');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

console.log("Boot sequence starting...");

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

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your credits'),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your inventory'),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Admin: give credits')
    .addUserOption(o =>
      o.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(o =>
      o.setName('amount').setDescription('Amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('giveitem')
    .setDescription('Admin: give an item')
    .addUserOption(o =>
      o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o =>
      o.setName('item').setDescription('Item').setRequired(true))
    .addIntegerOption(o =>
      o.setName('amount').setDescription('Amount').setRequired(true))
].map(cmd => cmd.toJSON());

/* ================= READY ================= */

client.once('clientReady', async () => {
  console.log(`Online as ${client.user.tag}`);

  // Register commands AFTER login (prevents silent crash)
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Slash commands registered.");
  } catch (err) {
    console.error("Command registration failed:", err);
  }
});

/* ================= EVENTS ================= */

client.on('guildMemberAdd', member => {
  balances.set(member.id, 300);
  inventories.set(member.id, {});
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // BALANCE
  if (interaction.commandName === 'balance') {
    return interaction.reply(`Balance: ${getBalance(interaction.user.id)} credits`);
  }

  // INVENTORY
  if (interaction.commandName === 'inventory') {
    const inv = getInventory(interaction.user.id);
    if (Object.keys(inv).length === 0)
      return interaction.reply('Your inventory is empty.');

    const list = Object.entries(inv)
      .map(([i, q]) => `${i}: ${q}`)
      .join('\n');

    return interaction.reply(`Your inventory:\n${list}`);
  }

  // GIVE CREDITS
  if (interaction.commandName === 'give') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    const newBal = getBalance(user.id) + amount;
    balances.set(user.id, newBal);

    return interaction.reply(`Gave ${amount} credits to ${user.tag}.`);
  }

  // GIVE ITEM
  if (interaction.commandName === 'giveitem') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    const inv = getInventory(user.id);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply(`Gave ${amount} ${item}(s) to ${user.tag}.`);
  }
});

/* ================= LOGIN ================= */

client.login(TOKEN).catch(err => {
  console.error("Login failed:", err);
});
