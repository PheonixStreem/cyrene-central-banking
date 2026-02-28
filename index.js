const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionsBitField } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== In-memory storage =====
const balances = new Map();
const inventories = new Map();

// ===== Helpers =====
function getBalance(userId) {
  if (!balances.has(userId)) balances.set(userId, 300);
  return balances.get(userId);
}

function getInventory(userId) {
  if (!inventories.has(userId)) inventories.set(userId, {});
  return inventories.get(userId);
}

// ===== Slash Commands =====
const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your credits'),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Admin: give credits to a user')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('giveitem')
    .setDescription('Admin: give an item to a user')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User').setRequired(true))
    .addStringOption(opt =>
      opt.setName('item').setDescription('Item name').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Check your inventory')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

// Register commands
(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Commands registered');
  } catch (err) {
    console.error(err);
  }
})();

// ===== Events =====
client.once('clientReady', () => {
  console.log(`Online as ${client.user.tag}`);
});

client.on('guildMemberAdd', member => {
  balances.set(member.id, 300);
  inventories.set(member.id, {});
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // ===== BALANCE =====
  if (interaction.commandName === 'balance') {
    const credits = getBalance(interaction.user.id);
    return interaction.reply(`Balance: ${credits} credits`);
  }

  // ===== GIVE CREDITS =====
  if (interaction.commandName === 'give') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    const newBalance = getBalance(user.id) + amount;
    balances.set(user.id, newBalance);

    return interaction.reply(`Gave ${amount} credits to ${user.tag}. New balance: ${newBalance}`);
  }

  // ===== GIVE ITEM =====
  if (interaction.commandName === 'giveitem') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    const inventory = getInventory(user.id);
    inventory[item] = (inventory[item] || 0) + amount;

    return interaction.reply(`Gave ${amount} ${item}(s) to ${user.tag}`);
  }

  // ===== INVENTORY =====
  if (interaction.commandName === 'inventory') {
    const inventory = getInventory(interaction.user.id);

    if (Object.keys(inventory).length === 0) {
      return interaction.reply('Your inventory is empty.');
    }

    const list = Object.entries(inventory)
      .map(([item, amt]) => `${item}: ${amt}`)
      .join('\n');

    return interaction.reply(`Your inventory:\n${list}`);
  }
});

client.login(TOKEN);
