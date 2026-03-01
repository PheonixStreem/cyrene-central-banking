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


// =============================
// DATA STORAGE
// =============================

const balances = new Map();
const inventories = new Map();
const razeState = new Map();

function getBalance(userId) {
  if (!balances.has(userId)) balances.set(userId, 300);
  return balances.get(userId);
}

function getInventory(userId) {
  if (!inventories.has(userId)) inventories.set(userId, {});
  return inventories.get(userId);
}

function getRaze(userId) {
  if (!razeState.has(userId)) {
    razeState.set(userId, {
      addicted: false,
      warnings: 0,
      nextTick: 0,
      interval: null
    });
  }
  return razeState.get(userId);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}


// =============================
// SHOP ITEMS
// =============================

const shop = {
  medshop: {
    "nanobot healing vials": 50,
    "portable blood toxin filters": 40,
    "oxygen rebreather masks": 60,
    "detox injectors": 45,
    "neural stabilizer shots": 55
  },
  fahrens: {
    "raze": 120
  }
};


// =============================
// RAZE CONFIG
// =============================

const RAZE_INTERVAL = 2 * 60 * 1000; // 2 minutes
const RAZE_WARNINGS = 3;

const razeNormal = [
  "The Raze hits your system and your senses sharpen.",
  "As the Raze kicks in, you bounce in place to burn off the excess energy.",
  "The Raze floods your system and you feel warm and charged.",
  "A surge of synthetic adrenaline courses through your veins."
];

const razeAddicted = [
  "As you use Raze, you feel unstoppable.",
  "The edge returns. Your body remembers this power.",
  "Your pulse steadies — the world slows to your pace.",
  "Relief washes over you as the craving quiets."
];

const razeCravings = [
  "Your body aches for another dose of Raze.",
  "The edge is fading. You need more Raze soon.",
  "Your muscles tremble as the crash creeps closer.",
  "You feel the power slipping away."
];


// =============================
// COMMANDS
// =============================

const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Check credits'),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item')
    .addStringOption(o => o.setName('shop').setDescription('Shop name').setRequired(true))
    .addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View inventory'),

  new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an item')
    .addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check active effects'),

  new SlashCommandBuilder()
    .setName('cure')
    .setDescription('Admin: cure addiction')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
].map(c => c.toJSON());


// =============================
// REGISTER COMMANDS
// =============================

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log("Commands registered");
})();


// =============================
// READY
// =============================

client.once('ready', () => {
  console.log(`Online as ${client.user.tag}`);
});

client.on('guildMemberAdd', m => {
  balances.set(m.id, 300);
});


// =============================
// INTERACTIONS
// =============================

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  // BALANCE
  if (interaction.commandName === 'balance') {
    return interaction.reply({ content: `Balance: ${getBalance(userId)} credits`, ephemeral: true });
  }

  // INVENTORY
  if (interaction.commandName === 'inventory') {
    const inv = getInventory(userId);
    if (!Object.keys(inv).length) {
      return interaction.reply({ content: "Inventory empty.", ephemeral: true });
    }
    const text = Object.entries(inv).map(([k,v]) => `${k}: ${v}`).join('\n');
    return interaction.reply({ content: text, ephemeral: true });
  }

  // BUY
  if (interaction.commandName === 'buy') {
    const shopName = interaction.options.getString('shop').toLowerCase();
    const item = interaction.options.getString('item').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    if (!shop[shopName] || !shop[shopName][item]) {
      return interaction.reply({ content: "Item not found.", ephemeral: true });
    }

    const cost = shop[shopName][item] * amount;
    const balance = getBalance(userId);

    if (balance < cost) {
      return interaction.reply({ content: "Not enough credits.", ephemeral: true });
    }

    balances.set(userId, balance - cost);
    const inv = getInventory(userId);
    inv[item] = (inv[item] || 0) + amount;

    return interaction.reply({ content: `Bought ${amount} ${item}.`, ephemeral: true });
  }

  // USE ITEM
  if (interaction.commandName === 'use') {
    const item = interaction.options.getString('item').toLowerCase();
    const inv = getInventory(userId);

    if (!inv[item]) {
      return interaction.reply({ content: "You don't have that.", ephemeral: true });
    }

    inv[item]--;

    // RAZE USE
    if (item === 'raze') {
      const state = getRaze(userId);
      const addictedBefore = state.addicted;

      if (!state.addicted && Math.random() < 0.35) {
        state.addicted = true;
      }

      const msg = state.addicted
        ? pick(razeAddicted)
        : pick(razeNormal);

      await interaction.reply({ content: msg, ephemeral: true });

      // Start warning cycle safely
      if (state.addicted && !state.interval) {
        state.nextTick = Date.now() + RAZE_INTERVAL;

        state.interval = setInterval(async () => {
          const s = getRaze(userId);
          s.warnings++;

          if (s.warnings >= RAZE_WARNINGS) {
            clearInterval(s.interval);
            s.addicted = false;
            s.warnings = 0;
            return;
          }

          s.nextTick = Date.now() + RAZE_INTERVAL;

          try {
            const user = await client.users.fetch(userId);
            await user.send(pick(razeCravings));
          } catch {
            console.log("Could not DM user.");
          }

        }, RAZE_INTERVAL);
      }

      return;
    }

    return interaction.reply({ content: `Used ${item}.`, ephemeral: true });
  }

  // STATUS
  if (interaction.commandName === 'status') {
    const state = getRaze(userId);

    if (!state.addicted) {
      return interaction.reply({ content: "No active effects.", ephemeral: true });
    }

    const remaining = Math.max(0, Math.floor((state.nextTick - Date.now()) / 1000));

    return interaction.reply({
      content: `Raze Dependency Active\nNext craving in ${remaining}s`,
      ephemeral: true
    });
  }

  // ADMIN CURE
  if (interaction.commandName === 'cure') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "No permission.", ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const state = getRaze(user.id);

    clearInterval(state.interval);
    state.addicted = false;
    state.warnings = 0;

    return interaction.reply({ content: `${user.tag} cured.`, ephemeral: true });
  }

});

client.login(TOKEN);
