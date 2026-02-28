const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, PermissionsBitField } = require('discord.js');
const { REST } = require('@discordjs/rest');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===== STORAGE =====
const balances = new Map();

function getBalance(userId) {
  if (!balances.has(userId)) balances.set(userId, 300);
  return balances.get(userId);
}

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your credits'),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Admin: give credits')
    .addUserOption(o =>
      o.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(o =>
      o.setName('amount').setDescription('Amount').setRequired(true))
].map(cmd => cmd.toJSON());

// ===== REGISTER COMMANDS (SAFE) =====
client.once('clientReady', async () => {
  console.log(`Online as ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Commands registered.');
  } catch (err) {
    console.error('Command registration failed:', err);
  }
});

// ===== EVENTS =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // BALANCE
  if (interaction.commandName === 'balance') {
    return interaction.reply(`Balance: ${getBalance(interaction.user.id)} credits`);
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
});

// ===== LOGIN =====
client.login(TOKEN);
