const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionsBitField } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const balances = new Map();
if (interaction.commandName === 'inventory') {
  const inventory = getInventory(interaction.user.id);

  if (Object.keys(inventory).length === 0) {
    return interaction.reply('Your inventory is empty.');
  }

  const items = Object.entries(inventory)
    .map(([item, qty]) => `${item}: ${qty}`)
    .join('\n');

  await interaction.reply(`Your inventory:\n${items}`);
}

function getBalance(userId) {
  if (!balances.has(userId)) {
    balances.set(userId, 300);
  }
  return balances.get(userId);
}

const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your credits'),

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
        .setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

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

client.once('clientReady', () => {
  console.log(`Online as ${client.user.tag}`);
});

client.on('guildMemberAdd', member => {
  balances.set(member.id, 300);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'balance') {
    const credits = getBalance(interaction.user.id);
    await interaction.reply(`Balance: ${credits} credits`);
  }

  if (interaction.commandName === 'give') {
    // Admin permission check
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    const newBalance = getBalance(user.id) + amount;
    balances.set(user.id, newBalance);

    await interaction.reply(`Gave ${amount} credits to ${user.tag}. New balance: ${newBalance}`);
  }
});

client.login(TOKEN);
