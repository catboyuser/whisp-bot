require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  SlashCommandBuilder,
  REST,
  Routes,
  OverwriteType
} = require("discord.js");

const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message]
});

const CONFIG_FILE = "./whisp-config.json";

const roles = {
  owner: "୨୧・OWNER",
  coOwner: "✧・CO OWNER",
  admin: "₊・ADMIN",
  staff: "♡・STAFF",
  moderator: "— ̳͟͞͞♡・MODERATOR",
  helper: "⋆⭒˚｡⋆・HELPER",
  media: "✧・PICTURES/GIFS"
};

const categories = [
  {
    name: "•̩̩͙⁺ 001",
    channels: [
      { name: "mail", locked: true },
      { name: "access", locked: true }
    ]
  },
  {
    name: "₊ 002",
    channels: [
      { name: "notices", locked: true },
      { name: "self-roles", locked: true }
    ]
  },
  {
    name: "⋆⭒˚｡⋆ 003",
    channels: [
      { name: "chat" },
      { name: "media" },
      { name: "friends" },
      { name: "confessions" },
      { name: "confession-appy", staffOnly: true }
    ]
  },
  {
    name: "•̩̩͙⁺ 004",
    channels: [
      { name: "giveaways", locked: true },
      { name: "movie-night", locked: true },
      { name: "promo", locked: true },
      { name: "polls", locked: true },
      { name: "count" },
      { name: "questions" }
    ]
  },
  {
    name: "— ̳͟͞͞♡ 005",
    channels: [
      { name: "support" },
      { name: "reports" },
      { name: "suggestions" }
    ]
  },
  {
    name: "⋆⭒˚｡⋆ 006",
    channels: [
      { name: "tickets", locked: true },
      { name: "applications", locked: true }
    ]
  },
  {
    name: "•̩̩͙⁺ 007",
    channels: [
      {
        name: "lounge",
        type: ChannelType.GuildVoice
      },
      {
        name: "staff-vc",
        type: ChannelType.GuildVoice,
        higherStaffOnly: true
      }
    ]
  }
];

const staffCategory = {
  name: "008 STAFF",
  channels: [
    "staff-chat",
    "staff-logs",
    "mod-logs",
    "reports",
    "applications",
    "tickets"
  ]
};

function saveConfig(guildId, data) {
  let config = {};

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = JSON.parse(
        fs.readFileSync(CONFIG_FILE, "utf8")
      );
    } catch {}
  }

  config[guildId] = data;

  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(config, null, 2)
  );
}

function loadConfig(guildId) {
  if (!fs.existsSync(CONFIG_FILE)) return null;

  try {
    const config = JSON.parse(
      fs.readFileSync(CONFIG_FILE, "utf8")
    );

    return config[guildId] || null;
  } catch {
    return null;
  }
}

async function createRole(guild, name) {
  return (
    guild.roles.cache.find(role => role.name === name) ||
    guild.roles.create({
      name,
      mentionable: false,
      reason: "Whisp setup"
    })
  );
}

async function setupGuild(guild) {
  const botMember = guild.members.me;

  if (
    !botMember.permissions.has(
      PermissionsBitField.Flags.ManageGuild
    ) ||
    !botMember.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    ) ||
    !botMember.permissions.has(
      PermissionsBitField.Flags.ManageRoles
    )
  ) {
    throw new Error(
      "Whisp needs Manage Server, Manage Channels, and Manage Roles."
    );
  }

  const createdRoles = {};

  for (const [key, name] of Object.entries(roles)) {
    createdRoles[key] = await createRole(guild, name);
  }

  const everyone = guild.roles.everyone;

  const staffRoles = [
    createdRoles.owner,
    createdRoles.coOwner,
    createdRoles.admin,
    createdRoles.staff,
    createdRoles.moderator,
    createdRoles.helper
  ];

  const higherStaff = [
    createdRoles.owner,
    createdRoles.coOwner,
    createdRoles.admin,
    createdRoles.staff
  ];

  function getPermissions(spec) {
    const overwrites = [];

    if (spec.staffOnly) {
      overwrites.push({
        id: everyone.id,
        type: OverwriteType.Role,
        deny: [
          PermissionsBitField.Flags.ViewChannel
        ]
      });

      for (const role of staffRoles) {
        overwrites.push({
          id: role.id,
          type: OverwriteType.Role,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages
          ]
        });
      }
    }

    if (spec.higherStaffOnly) {
      overwrites.push({
        id: everyone.id,
        type: OverwriteType.Role,
        deny: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect
        ]
      });

      for (const role of higherStaff) {
        overwrites.push({
          id: role.id,
          type: OverwriteType.Role,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect
          ]
        });
      }
    }

    if (spec.locked) {
      overwrites.push({
        id: everyone.id,
        type: OverwriteType.Role,
        allow: [
          PermissionsBitField.Flags.ViewChannel
        ],
        deny: [
          PermissionsBitField.Flags.SendMessages
        ]
      });
    }

    return overwrites;
  }

  for (const categoryData of categories) {
    let category = guild.channels.cache.find(
      channel =>
        channel.type === ChannelType.GuildCategory &&
        channel.name === categoryData.name
    );

    if (!category) {
      category = await guild.channels.create({
        name: categoryData.name,
        type: ChannelType.GuildCategory,
        reason: "Whisp setup"
      });
    }

    for (const channelData of categoryData.channels) {
      let channel = guild.channels.cache.find(
        c =>
          c.parentId === category.id &&
          c.name === channelData.name
      );

      if (!channel) {
        channel = await guild.channels.create({
          name: channelData.name,
          type:
            channelData.type ||
            ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites:
            getPermissions(channelData),
          reason: "Whisp setup"
        });
      }
    }
  }

  let staffCategoryChannel =
    guild.channels.cache.find(
      channel =>
        channel.type === ChannelType.GuildCategory &&
        channel.name === staffCategory.name
    );

  if (!staffCategoryChannel) {
    staffCategoryChannel =
      await guild.channels.create({
        name: staffCategory.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: everyone.id,
            type: OverwriteType.Role,
            deny: [
              PermissionsBitField.Flags.ViewChannel
            ]
          }
        ],
        reason: "Whisp setup"
      });
  }

  for (const channelName of staffCategory.channels) {
    const exists = guild.channels.cache.find(
      channel =>
        channel.parentId === staffCategoryChannel.id &&
        channel.name === channelName
    );

    if (!exists) {
      await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: staffCategoryChannel.id,
        permissionOverwrites: staffRoles.map(role => ({
          id: role.id,
          type: OverwriteType.Role,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages
          ]
        })),
        reason: "Whisp setup"
      });
    }
  }

  /*
   * PICTURES/GIFS SYSTEM
   *
   * Everyone:
   * - cannot send attachments
   * - cannot embed links
   *
   * PICTURES/GIFS role:
   * - can send attachments
   * - can embed links
   */

  for (const channel of guild.channels.cache.filter(
    channel => channel.isTextBased()
  ).values()) {
    await channel.permissionOverwrites.edit(
      everyone,
      {
        AttachFiles: false,
        EmbedLinks: false
      }
    ).catch(() => {});

    await channel.permissionOverwrites.edit(
      createdRoles.media,
      {
        AttachFiles: true,
        EmbedLinks: true
      }
    ).catch(() => {});

    for (const role of staffRoles) {
      await channel.permissionOverwrites.edit(
        role,
        {
          AttachFiles: true,
          EmbedLinks: true
        }
      ).catch(() => {});
    }
  }

  saveConfig(guild.id, {
    setupComplete: true,
    mediaRoleId: createdRoles.media.id,
    setupAt: new Date().toISOString()
  });

  return createdRoles.media;
}

const setupCommand =
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Set up Whisp once.");

async function registerSetupCommand() {
  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    {
      body: [setupCommand.toJSON()]
    }
  );
}

client.once("ready", async () => {
  console.log(
    `Logged in as ${client.user.tag}`
  );

  if (!process.env.GUILD_ID) return;

  const guild =
    await client.guilds.fetch(
      process.env.GUILD_ID
    ).catch(() => null);

  if (!guild) return;

  const config = loadConfig(guild.id);

  if (!config?.setupComplete) {
    await registerSetupCommand()
      .catch(console.error);
  }
});

client.on(
  "interactionCreate",
  async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName !== "setup")
      return;

    if (!interaction.guild) {
      return interaction.reply({
        content:
          "Use this command inside the server.",
        ephemeral: true
      });
    }

    if (
      !interaction.memberPermissions.has(
        PermissionsBitField.Flags.Administrator
      )
    ) {
      return interaction.reply({
        content:
          "You need Administrator to use /setup.",
        ephemeral: true
      });
    }

    if (
      loadConfig(interaction.guild.id)
        ?.setupComplete
    ) {
      return interaction.reply({
        content:
          "Whisp is already set up.",
        ephemeral: true
      });
    }

    await interaction.deferReply({
      ephemeral: true
    });

    try {
      const mediaRole =
        await setupGuild(
          interaction.guild
        );

      await interaction.editReply(
        `Setup complete. **${mediaRole.name}** controls who can send pictures/GIFs.`
      );

      const rest =
        new REST({ version: "10" })
          .setToken(
            process.env.DISCORD_TOKEN
          );

      await rest.delete(
        Routes.applicationGuildCommand(
          process.env.CLIENT_ID,
          interaction.guild.id,
          interaction.commandId
        )
      ).catch(() => {});

    } catch (error) {
      console.error(error);

      await interaction.editReply(
        `Setup failed: ${error.message}`
      );
    }
  }
);

client.login(
  process.env.DISCORD_TOKEN
);