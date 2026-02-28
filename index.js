const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const balances = new Map();

function getBalance(userId) {
  if (!balances.has(userId)) balances.set(userId, 300);
  return balances.get(userId);
}

client.once('clientReady', () => {
  console.log(`Online as ${client.user.tag}`);
});

client.on('guildMemberAdd', member => {
  balances.set(member.id, 300);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // BALANCE
  if (interaction.commandName === 'balance') {
    return interaction.reply(`Balance: ${getBalance(interaction.user.id)} credits`);
  }

  // GIVE (ADMIN)
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

client.login(TOKEN);
