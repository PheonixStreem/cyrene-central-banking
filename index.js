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

//////////////////////////////
// MEMORY STORAGE
//////////////////////////////

const balances = new Map();
const inventories = new Map();
const addictions = new Map(); // userId -> { drug, endTime, warningsSent }

//////////////////////////////
// HELPERS
//////////////////////////////

function getBalance(userId) {
  if (!balances.has(userId)) balances.set(userId, 300);
  return balances.get(userId);
}

function getInventory(userId) {
  if (!inventories.has(userId)) inventories.set(userId, {});
  return inventories.get(userId);
}

function getAddiction(userId) {
  return addictions.get(userId);
}

//////////////////////////////
// SHOPS
//////////////////////////////

const shops = {
  medshop: {
    'nanobot healing vials': 50,
    'portable blood toxin filters': 75,
    'oxygen rebreather masks': 100,
    'detox injectors': 120,
    'neural stabilizer shots': 150
  },
  chopshop: {
    raze: 200
  }
};

//////////////////////////////
// COMMANDS
//////////////////////////////

const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your credits'),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Check your inventory'),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item from a shop')
    .addStringOption(o =>
      o.setName('shop')
        .setDescription('Shop name')
        .setRequired(true)
        .addChoices(
          { name: 'Medshop', value: 'medshop' },
          { name: 'Fahren’s Chop Shop', value: 'chopshop' }
        ))
    .addStringOption(o =>
      o.setName('item')
        .setDescription('Item name')
        .setRequired(true))
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('Amount to buy')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an item')
    .addStringOption(o =>
      o.setName('item')
        .setDescription('Item to use')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check your condition'),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Admin: give credits')
    .addUserOption(o =>
      o.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(o =>
      o.setName('amount').setDescription('Amount').setRequired(true))
].map(c => c.toJSON());

//////////////////////////////
// REGISTER COMMANDS
//////////////////////////////

const rest = new REST({ version: '10' }).setToken(TOKEN);

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

//////////////////////////////
// READY
//////////////////////////////

client.once('clientReady', () => {
  console.log(`Online as ${client.user.tag}`);
});

client.on('guildMemberAdd', member => {
  balances.set(member.id, 300);
});

//////////////////////////////
// ADDICTION TIMER LOOP
//////////////////////////////

setInterval(async () => {
  const now = Date.now();

  for (const [userId, data] of addictions.entries()) {
    const remaining = data.endTime - now;

    if (remaining <= 0) {
      addictions.delete(userId);
      continue;
    }

    const minutesLeft = Math.ceil(remaining / 60000);

    if ([20, 10, 5].includes(minutesLeft) && !data.warningsSent?.includes(minutesLeft)) {
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        user.send(
          `Your body aches for another dose of ${data.drug}. ${minutesLeft} minutes until withdrawal.`
        ).catch(() => {});
      }

      if (!data.warningsSent) data.warningsSent = [];
      data.warningsSent.push(minutesLeft);
    }
  }
}, 60000);

//////////////////////////////
// INTERACTIONS
//////////////////////////////

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  ////////////////// BALANCE
  if (interaction.commandName === 'balance') {
    return interaction.reply(`Balance: ${getBalance(userId)} credits`);
  }

  ////////////////// INVENTORY
  if (interaction.commandName === 'inventory') {
    const inv = getInventory(userId);
    const items = Object.entries(inv)
      .map(([k, v]) => `${k} x${v}`)
      .join('\n') || 'Empty';

    return interaction.reply({ content: items, ephemeral: true });
  }

  ////////////////// BUY
  if (interaction.commandName === 'buy') {
    const shopName = interaction.options.getString('shop');
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    const shop = shops[shopName];
    if (!shop || !shop[item]) {
      return interaction.reply({ content: 'Item not found.', ephemeral: true });
    }

    const cost = shop[item] * amount;
    const balance = getBalance(userId);

    if (balance < cost) {
      return interaction.reply({ content: 'Not enough credits.', ephemeral: true });
    }

    balances.set(userId, balance - cost);

    const inv = getInventory(userId);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply(`Purchased ${amount} ${item}(s) for ${cost} credits.`);
  }

  ////////////////// USE
  if (interaction.commandName === 'use') {
    const item = interaction.options.getString('item').toLowerCase();
    const inv = getInventory(userId);

    if (!inv[item]) {
      return interaction.reply({ content: 'You do not have that item.', ephemeral: true });
    }

    inv[item]--;

    // RAZE EFFECT
    if (item === 'raze') {
      const hooked = Math.random() < 0.4;

      if (hooked) {
        addictions.set(userId, {
          drug: 'Raze',
          endTime: Date.now() + 30 * 60 * 1000,
          warningsSent: []
        });

        return interaction.reply({
          content: 'The rush hits deep. You feel like you may need this again...',
          ephemeral: true
        });
      }

      return interaction.reply({
        content: 'A sharp clarity floods your senses. No dependency formed.',
        ephemeral: true
      });
    }

    return interaction.reply({ content: `Used ${item}.`, ephemeral: true });
  }

  ////////////////// STATUS
  if (interaction.commandName === 'status') {
    const addiction = getAddiction(userId);

    if (!addiction) {
      return interaction.reply({
        content: 'You feel stable. No active dependencies.',
        ephemeral: true
      });
    }

    const remainingMin = Math.ceil((addiction.endTime - Date.now()) / 60000);

    return interaction.reply({
      content:
        `Condition Report:\n` +
        `Addicted to: ${addiction.drug}\n` +
        `Time until withdrawal: ${remainingMin} minute(s)`,
      ephemeral: true
    });
  }

  ////////////////// GIVE (ADMIN)
  if (interaction.commandName === 'give') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    const newBal = getBalance(target.id) + amount;
    balances.set(target.id, newBal);

    return interaction.reply(`Gave ${amount} credits to ${target.tag}.`);
  }
});

client.login(TOKEN);
