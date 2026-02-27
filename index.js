const { Client, GatewayIntentBits, SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let accounts = {};

const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Check your credits'),
  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Disburse credits')
    .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(option => option.setName('amount').setDescription('Amount').setRequired(true)),
];

const rest = new REST({ version: '10' }).setToken(token);
rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  if (!accounts[userId]) accounts[userId] = 0;

  if (interaction.commandName === 'balance') {
    await interaction.reply(`Central Banking confirms a balance of **${accounts[userId]} credits**.`);
  }

  if (interaction.commandName === 'give') {
    const member = interaction.member;
    const hasRole = member.roles.cache.some(role => role.name === "Port Authority");

    if (!hasRole) {
      return interaction.reply("Access denied. Central Banking recognizes no authority.");
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (!accounts[target.id]) accounts[target.id] = 0;
    accounts[target.id] += amount;

    await interaction.reply(`Port Authority authorized a disbursement of **${amount} credits** to ${target.username}.`);
  }
});

client.login(token);
