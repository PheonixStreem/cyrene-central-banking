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

/* =========================
   In-Memory Storage
========================= */

const balances = new Map();
const inventories = new Map();

function getBalance(userId) {
  if (!balances.has(userId)) {
    balances.set(userId, 300);
  }
  return balances.get(userId);
}

function getInventory(userId) {
  if (!inventories.has(userId)) {
    inventories.set(userId, {});
  }
  return inventories.get(userId);
}

/* =========================
   Slash Commands
========================= */

const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your credits'),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your items'),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Admin: give credits to a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to give credits to')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of credits')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('giveitem')
    .setDescription('Admin: give an item to a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to receive the item')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Item name')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of item')
        .setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

/* =========================
   Register Commands
========================= */

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Commands registered.');
  } catch (err) {
    console.error(err);
  }
})();

/* =========================
   Bot Ready
========================= */

client.once('clientReady', () => {
  console.log(`Online as ${client.user.tag}`);
});

/* =========================
   New Member → 300 credits
========================= */

client.on('guildMemberAdd', member => {
  balances.set(member.id, 300);
});

/* =========================
   Command Handler
========================= */

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  /* ---------- BALANCE ---------- */
  if (interaction.commandName === 'balance') {
    const credits = getBalance(interaction.user.id);
    return interaction.reply(`Balance: ${credits} credits`);
  }

  /* ---------- INVENTORY ---------- */
  if (interaction.commandName === 'inventory') {
    const inventory = getInventory(interaction.user.id);

    if (Object.keys(inventory).length === 0) {
      return interaction.reply('Your inventory is empty.');
    }

    const items = Object.entries(inventory)
      .map(([item, amount]) => `${item}: ${amount}`)
      .join('\n');

    return interaction.reply(`Your items:\n${items}`);
  }

  /* ---------- GIVE CREDITS (ADMIN) ---------- */
  if (interaction.commandName === 'give') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    const newBalance = getBalance(user.id) + amount;
    balances.set(user.id, newBalance);

    return interaction.reply(
      `Gave ${amount} credits to ${user.tag}. New balance: ${newBalance}`
    );
  }

  /* ---------- GIVE ITEM (ADMIN) ---------- */
  if (interaction.commandName === 'giveitem') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    if (amount <= 0) {
      return interaction.reply({ content: 'Amount must be positive.', ephemeral: true });
    }

    const inventory = getInventory(user.id);
    inventory[item] = (inventory[item] || 0) + amount;

    return interaction.reply(`Gave ${amount} ${item}(s) to ${user.tag}.`);
  }
});

client.login(TOKEN);
