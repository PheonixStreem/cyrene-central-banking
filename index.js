const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionsBitField
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

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

const shops = {
  medshop: {
    'nanobot healing vials': 50,
    'oxygen rebreather masks': 100
  }
};

const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Check credits'),
  new SlashCommandBuilder().setName('inventory').setDescription('Check inventory'),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item')
    .addStringOption(o =>
      o.setName('shop').setRequired(true)
        .addChoices({ name: 'Medshop', value: 'medshop' }))
    .addStringOption(o =>
      o.setName('item').setRequired(true))
    .addIntegerOption(o =>
      o.setName('amount').setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
})();

client.once('ready', () => {
  console.log(`Online as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const userId = interaction.user.id;

  if (interaction.commandName === 'balance')
    return interaction.reply(`Balance: ${getBalance(userId)} credits`);

  if (interaction.commandName === 'inventory') {
    const inv = getInventory(userId);
    const list = Object.entries(inv).map(([k,v]) => `${k} x${v}`).join('\n') || 'Empty';
    return interaction.reply(list);
  }

  if (interaction.commandName === 'buy') {
    const shop = interaction.options.getString('shop');
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    if (!shops[shop] || !shops[shop][item])
      return interaction.reply('Item not found.');

    const cost = shops[shop][item] * amount;
    if (getBalance(userId) < cost)
      return interaction.reply('Not enough credits.');

    balances.set(userId, getBalance(userId) - cost);
    const inv = getInventory(userId);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply(`Purchased ${amount} ${item}(s).`);
  }
});

client.login(TOKEN);
