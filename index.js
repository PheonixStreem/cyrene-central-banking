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

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Missing environment variables.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});


// ================= DATA =================

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


// ================= SHOPS =================

const shops = {
  medshop: {
    "nanobot healing vials": 50,
    "portable blood toxin filters": 75,
    "oxygen rebreather masks": 40,
    "detox injectors": 60,
    "neural stabilizer shots": 90
  },
  "fahrren chop shop": {
    raze: 120
  }
};


// ================= COMMANDS =================

const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Check credits'),
  new SlashCommandBuilder().setName('inventory').setDescription('View inventory'),
  new SlashCommandBuilder().setName('status').setDescription('View status'),
  new SlashCommandBuilder().setName('shops').setDescription('List shops'),

  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View shop items')
    .addStringOption(o => o.setName('name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy item')
    .addStringOption(o => o.setName('shop').setRequired(true))
    .addStringOption(o => o.setName('item').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use item')
    .addStringOption(o => o.setName('item').setRequired(true)),

  // Admin
  new SlashCommandBuilder()
    .setName('givecredits')
    .setDescription('Admin give credits')
    .addUserOption(o => o.setName('user').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('giveitem')
    .setDescription('Admin give item')
    .addUserOption(o => o.setName('user').setRequired(true))
    .addStringOption(o => o.setName('item').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('cure')
    .setDescription('Admin cure raze')
    .addUserOption(o => o.setName('user').setRequired(true))
].map(c => c.toJSON());


// ================= REGISTER =================

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("Commands registered");
  } catch (err) {
    console.error("Command registration failed:", err);
  }
})();


// ================= READY =================

client.once('clientReady', () => {
  console.log(`Online as ${client.user.tag}`);
});

client.on('guildMemberAdd', m => balances.set(m.id, 300));


// ================= INTERACTIONS =================

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const id = interaction.user.id;

  try {

    if (interaction.commandName === 'balance') {
      return interaction.reply(`Balance: ${getBalance(id)} credits`);
    }

    if (interaction.commandName === 'inventory') {
      const inv = getInventory(id);
      if (!Object.keys(inv).length) return interaction.reply('Inventory empty.');
      return interaction.reply(Object.entries(inv).map(([i,q]) => `${i} x${q}`).join('\n'));
    }

    if (interaction.commandName === 'status') {
      const s = getStatus(id);
      return interaction.reply({ content: s.length ? s.join('\n') : 'No effects.', ephemeral: true });
    }

    if (interaction.commandName === 'shops') {
      return interaction.reply(Object.keys(shops).join('\n'));
    }

    if (interaction.commandName === 'shop') {
      const name = interaction.options.getString('name').toLowerCase();
      const shop = shops[name];
      if (!shop) return interaction.reply('Shop not found.');
      return interaction.reply(Object.entries(shop).map(([i,p]) => `${i} — ${p}`).join('\n'));
    }

    if (interaction.commandName === 'buy') {
      const shopName = interaction.options.getString('shop').toLowerCase();
      const item = interaction.options.getString('item').toLowerCase();
      const amount = interaction.options.getInteger('amount');

      const shop = shops[shopName];
      if (!shop) return interaction.reply({ content: 'Shop not found.', ephemeral: true });

      const price = shop[item];
      if (!price) return interaction.reply({ content: 'Item not found.', ephemeral: true });

      const total = price * amount;
      if (getBalance(id) < total) return interaction.reply({ content: 'Not enough credits.', ephemeral: true });

      balances.set(id, getBalance(id) - total);
      const inv = getInventory(id);
      inv[item] = (inv[item] || 0) + amount;

      return interaction.reply(`Bought ${amount} ${item}.`);
    }

    if (interaction.commandName === 'use') {
      const item = interaction.options.getString('item').toLowerCase();
      const inv = getInventory(id);
      if (!inv[item]) return interaction.reply({ content: 'You do not have that item.', ephemeral: true });

      inv[item]--;

      if (item === 'raze') {
        const addicted = Math.random() < 0.4;

        const normal = [
          "The Raze hits your system and your senses sharpen.",
          "You bounce in place, burning off the excess energy.",
          "Warmth spreads through your body as the Raze takes hold.",
          "Your muscles coil with restless energy."
        ];

        const addictedMsgs = [
          "You feel unstoppable.",
          "Power surges through you — too good to let go.",
          "Your body demands more.",
          "The edge feels permanent… for now."
        ];

        await interaction.reply({
          content: addicted
            ? addictedMsgs[Math.floor(Math.random()*addictedMsgs.length)]
            : normal[Math.floor(Math.random()*normal.length)],
          ephemeral: true
        });

        if (addicted) {
          getStatus(id).push('Raze Dependency');

          if (razeTimers.has(id)) clearInterval(razeTimers.get(id));

          let warnings = 0;

          const timer = setInterval(() => {
            warnings++;
            if (warnings >= 3) {
              getStatus(id).push('Withdrawal');
              clearInterval(timer);
              razeTimers.delete(id);
            }
          }, 10 * 60 * 1000);

          razeTimers.set(id, timer);
        }

        return;
      }

      return interaction.reply({ content: 'Item used.', ephemeral: true });
    }

    // ===== ADMIN =====

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    if (interaction.commandName === 'givecredits') {
      const user = interaction.options.getUser('user');
      const amt = interaction.options.getInteger('amount');
      balances.set(user.id, getBalance(user.id) + amt);
      return interaction.reply('Credits granted.');
    }

    if (interaction.commandName === 'giveitem') {
      const user = interaction.options.getUser('user');
      const item = interaction.options.getString('item').toLowerCase();
      const amt = interaction.options.getInteger('amount');
      const inv = getInventory(user.id);
      inv[item] = (inv[item] || 0) + amt;
      return interaction.reply('Item granted.');
    }

    if (interaction.commandName === 'cure') {
      const user = interaction.options.getUser('user');
      statuses.set(user.id, []);
      if (razeTimers.has(user.id)) clearInterval(razeTimers.get(user.id));
      razeTimers.delete(user.id);
      return interaction.reply('User cured.');
    }

  } catch (err) {
    console.error("Interaction error:", err);
  }
});

client.login(TOKEN);
