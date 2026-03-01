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

/* ------------------ DATA ------------------ */

const balances = new Map();
const inventories = new Map();
const statusEffects = new Map();
const razeAddiction = new Map();

/* ------------------ HELPERS ------------------ */

function getBalance(id) {
  if (!balances.has(id)) balances.set(id, 300);
  return balances.get(id);
}

function getInventory(id) {
  if (!inventories.has(id)) inventories.set(id, {});
  return inventories.get(id);
}

function getStatus(id) {
  if (!statusEffects.has(id)) statusEffects.set(id, []);
  return statusEffects.get(id);
}

/* ------------------ SHOPS ------------------ */

const shops = {
  medshop: {
    "nanobot healing vials": 50,
    "portable blood toxin filters": 75,
    "oxygen rebreather masks": 40,
    "detox injectors": 60,
    "neural stabilizer shots": 90
  },
  chopshop: {
    "raze": 120
  }
};

/* ------------------ COMMANDS ------------------ */

const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check credits'),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item')
    .addStringOption(o =>
      o.setName('shop').setDescription('Shop name').setRequired(true))
    .addStringOption(o =>
      o.setName('item').setDescription('Item name').setRequired(true))
    .addIntegerOption(o =>
      o.setName('amount').setDescription('Amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View inventory'),

  new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an item')
    .addStringOption(o =>
      o.setName('item').setDescription('Item').setRequired(true)),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check active effects'),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Admin: give credits')
    .addUserOption(o =>
      o.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(o =>
      o.setName('amount').setDescription('Amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('giveitem')
    .setDescription('Admin: give item')
    .addUserOption(o =>
      o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o =>
      o.setName('item').setDescription('Item').setRequired(true))
    .addIntegerOption(o =>
      o.setName('amount').setDescription('Amount').setRequired(true))
].map(c => c.toJSON());

/* ------------------ REGISTER COMMANDS ------------------ */

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

/* ------------------ READY ------------------ */

client.once('clientReady', () => {
  console.log(`Online as ${client.user.tag}`);
});

/* ------------------ RAZE SYSTEM ------------------ */

function startRazeCycle(userId, interaction) {
  razeAddiction.set(userId, {
    hooked: true,
    warnings: 0
  });

  const messages = [
    "Your body aches for another dose of Raze. The edge is fading.",
    "The clarity dulls. Your muscles tremble with need.",
    "Your nerves scream for relief only Raze can bring."
  ];

  const interval = setInterval(() => {
    const data = razeAddiction.get(userId);
    if (!data || data.warnings >= 3) {
      clearInterval(interval);
      return;
    }

    interaction.followUp({
      content: messages[data.warnings],
      ephemeral: true
    });

    data.warnings++;

    if (data.warnings >= 3) {
      getStatus(userId).push("Withdrawal");
      interaction.followUp({
        content: "Withdrawal sets in. Your body feels like it's collapsing inward.",
        ephemeral: true
      });
    }

  }, 2 * 60 * 1000); // 2 minutes
}

/* ------------------ INTERACTIONS ------------------ */

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  /* BALANCE */

  if (interaction.commandName === 'balance') {
    return interaction.reply(`Balance: ${getBalance(userId)} credits`);
  }

  /* BUY */

  if (interaction.commandName === 'buy') {
    const shop = interaction.options.getString('shop').toLowerCase();
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    if (!shops[shop] || !shops[shop][item]) {
      return interaction.reply({ content: 'Item not found.', ephemeral: true });
    }

    const cost = shops[shop][item] * amount;
    if (getBalance(userId) < cost) {
      return interaction.reply({ content: 'Not enough credits.', ephemeral: true });
    }

    balances.set(userId, getBalance(userId) - cost);

    const inv = getInventory(userId);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply(`Purchased ${amount} ${item}(s).`);
  }

  /* INVENTORY */

  if (interaction.commandName === 'inventory') {
    const inv = getInventory(userId);
    if (Object.keys(inv).length === 0) {
      return interaction.reply('Inventory empty.');
    }
    const list = Object.entries(inv).map(([i, a]) => `${i}: ${a}`).join('\n');
    return interaction.reply(`Inventory:\n${list}`);
  }

  /* USE */

  if (interaction.commandName === 'use') {
    const item = interaction.options.getString('item').toLowerCase();
    const inv = getInventory(userId);

    if (!inv[item]) {
      return interaction.reply({ content: 'You do not have that item.', ephemeral: true });
    }

    inv[item]--;

    if (item === "raze") {
      const hooked = Math.random() < 0.5;

      const normalMsgs = [
        "The Raze hits your system and your senses sharpen.",
        "As the Raze surges through you, you bounce in place to burn off the excess energy.",
        "The Raze floods your system and a warm, electric tingle spreads through your limbs.",
        "Your pulse quickens as the Raze takes hold, every movement feeling lighter and faster."
      ];

      const addictedMsgs = [
        "As you use Raze, you feel unstoppable.",
        "The surge hits harder this time — you crave more already.",
        "Your body remembers the rush and demands it again.",
        "The relief is immediate… and so is the hunger for another dose."
      ];

      if (hooked) {
        startRazeCycle(userId, interaction);
        return interaction.reply({
          content: addictedMsgs[Math.floor(Math.random() * addictedMsgs.length)],
          ephemeral: true
        });
      } else {
        return interaction.reply({
          content: normalMsgs[Math.floor(Math.random() * normalMsgs.length)],
          ephemeral: true
        });
      }
    }

    getStatus(userId).push(item);
    return interaction.reply({ content: `${item} used.`, ephemeral: true });
  }

  /* STATUS */

  if (interaction.commandName === 'status') {
    const status = getStatus(userId);
    if (!status.length) return interaction.reply('No active effects.');
    return interaction.reply(`Status: ${status.join(', ')}`);
  }

  /* ADMIN GIVE CREDITS */

  if (interaction.commandName === 'give') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    balances.set(user.id, getBalance(user.id) + amount);

    return interaction.reply(`Gave ${amount} credits to ${user.tag}`);
  }

  /* ADMIN GIVE ITEM */

  if (interaction.commandName === 'giveitem') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    const inv = getInventory(user.id);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply(`Gave ${amount} ${item}(s) to ${user.tag}`);
  }
});

/* ------------------ LOGIN ------------------ */

client.login(TOKEN);
