const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionsBitField } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

///////////////////////
// DATA STORAGE
///////////////////////

const balances = new Map();
const inventories = new Map();
const statuses = new Map();
const razeTimers = new Map();

function getBalance(id) {
  if (!balances.has(id)) balances.set(id, 300);
  return balances.get(id);
}

function getInventory(id) {
  if (!inventories.has(id)) inventories.set(id, {});
  return inventories.get(id);
}

function getStatus(id) {
  if (!statuses.has(id)) statuses.set(id, []);
  return statuses.get(id);
}

///////////////////////
// SHOPS
///////////////////////

const shops = {
  medshop: {
    "nanobot healing vials": 75,
    "portable blood toxin filters": 120,
    "oxygen rebreather masks": 90,
    "detox injectors": 110,
    "neural stabilizer shots": 150
  },
  chopshop: {
    "raze": 200
  }
};

///////////////////////
// COMMANDS
///////////////////////

const commands = [

  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your credits'),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Admin: give credits')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('giveitem')
    .setDescription('Admin: give item')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View a shop')
    .addStringOption(o =>
      o.setName('name')
        .setDescription('medshop or chopshop')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item')
    .addStringOption(o => o.setName('shop').setDescription('Shop name').setRequired(true))
    .addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Check your inventory'),

  new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an item')
    .addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check status effects')

].map(c => c.toJSON());

///////////////////////
// REGISTER COMMANDS
///////////////////////

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Commands registered.');
  } catch (err) {
    console.error(err);
  }
})();

///////////////////////
// EVENTS
///////////////////////

client.once('clientReady', () => {
  console.log(`Online as ${client.user.tag}`);
});

client.on('guildMemberAdd', member => {
  balances.set(member.id, 300);
});

///////////////////////
// RAZE SYSTEM
///////////////////////

function startrazewithdrawl(userID) {
  const status = getStatus(userId);
  if (!staus.includes('addicted")) return;

if (razeTimers.has(userID)) clearInterval(razeTimers.get(userId));

let remaining = 15 * 60; // 15 minutes total
  statuses.get(userId).withdrawlTime = remaining;

  const timer =setInterval(async () => {
    remaining -= 300; // 5 minutes

    statuses.get(userId).withdrawlTime = remaining;

    if (remaining <= 0) {
      clearInterval(timer);
      razeTimers.delete(userId);
      return;
    }
  }, 5 * 60 * 1000);

  razeTimers.set(userId, timer);
}
///////////////////////
// INTERACTIONS
///////////////////////

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const id = interaction.user.id;

  // BALANCE
  if (interaction.commandName === 'balance') {
    return interaction.reply(`Balance: ${getBalance(id)} credits`);
  }

  // GIVE CREDITS
  if (interaction.commandName === 'give') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: 'No permission.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    balances.set(user.id, getBalance(user.id) + amount);
    return interaction.reply(`Gave ${amount} credits to ${user.tag}`);
  }

  // GIVE ITEM
  if (interaction.commandName === 'giveitem') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: 'No permission.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    const inv = getInventory(user.id);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply(`Gave ${amount} ${item} to ${user.tag}`);
  }

  // SHOP VIEW
  if (interaction.commandName === 'shop') {
    const name = interaction.options.getString('name').toLowerCase();
    const shop = shops[name];
    if (!shop) return interaction.reply('Shop not found.');

    let msg = `**${name.toUpperCase()}**\n`;
    for (const item in shop) msg += `${item} — ${shop[item]} credits\n`;

    return interaction.reply(msg);
  }

  // BUY
  if (interaction.commandName === 'buy') {
    const shopName = interaction.options.getString('shop').toLowerCase();
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    const shop = shops[shopName];
    if (!shop || !shop[item]) return interaction.reply('Item not found.');

    const cost = shop[item] * amount;
    if (getBalance(id) < cost) return interaction.reply('Not enough credits.');

    balances.set(id, getBalance(id) - cost);
    const inv = getInventory(id);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply(`Purchased ${amount} ${item}`);
  }

  // INVENTORY
  if (interaction.commandName === 'inventory') {
    const inv = getInventory(id);
    if (!Object.keys(inv).length) return interaction.reply('Inventory empty.');

    let msg = '**Inventory**\n';
    for (const item in inv) msg += `${item}: ${inv[item]}\n`;

    return interaction.reply(msg);
  }

  // USE ITEM
  if (interaction.commandName === 'use') {
    const item = interaction.options.getString('item').toLowerCase();
    const inv = getInventory(id);

    if (!inv[item]) return interaction.reply('You do not have that item.');

    inv[item]--;

    // Raze logic
   if (item === 'raze') {
     const addicted = Math.random() < 0.4;
     const status = getStatus(id);

     if (addicted && !status.includes('addicted')) {
       status.push('addicted');
       startRazeWithdrawl(id);

       return interaction.reply({
         content: 'Your heartbeat drifts out of step, suspended in the space where the relief should be.',
         ephemeral: true
       });
     }
     return interaction.reply({
       content: 'By the time it fully hits your system, your hands have already stopped shaking and the world is returning to its hightened clarity.',
         ephemeral: true
     });
   }
    
  // STATUS
if (interaction.commandName === 'status') {
  const status = getStatus(id);

  if (!status.length)
    return interaction.reply({ content: 'No active effects.', ephemeral: true });

  let msg = 'Status: ${status.join(', ')}`;

  const data = statuses.get(id);
  if (data.withdrawlTime) {
    const mins = Math.floor(data.withdrawlTime / 60);
    const secs = data.withdrawlTime % 60;
    msg += `\nNext withdrawl warning in: ${mins}m ${secs}s`;
  }
  

client.login(TOKEN);
