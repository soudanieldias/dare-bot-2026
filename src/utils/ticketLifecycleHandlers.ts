import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuInteraction,
} from 'discord.js';
import discordTranscripts from 'discord-html-transcripts';
import type { GuildSettingsRepository, TicketRepository } from '@/database/index.js';
import { logger } from '@/shared/index.js';
import { TICKET_CUSTOM_IDS, getTicketCategoriesForGuild } from './ticketHelpers.js';

export interface ITicketLifecycleDeps {
  settingsRepo: GuildSettingsRepository;
  ticketRepo: TicketRepository;
}

export async function processCategorySelect(
  deps: ITicketLifecycleDeps,
  interaction: StringSelectMenuInteraction
): Promise<boolean> {
  const categoryId = interaction.values[0];
  if (!categoryId || !interaction.guild) return true;

  const guildId = interaction.guildId!;
  const settings = await deps.settingsRepo.findByGuildId(guildId);
  if (!settings?.ticketChannelId || !settings.ticketCategoryId || !settings.ticketRoleId) {
    await interaction.reply({
      content: '❌ Sistema de tickets não configurado. Use /ticket config.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const existing = await deps.ticketRepo.findOpenByUser(guildId, interaction.user.id);
  if (existing) {
    await interaction.reply({
      content: `❌ Você já possui um ticket aberto: <#${existing.channelId}>`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const categories = getTicketCategoriesForGuild(settings.ticketCategoriesJson);
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return true;

  const ticketNumber = await deps.ticketRepo.getNextNumber(guildId);

  const ticketChannel = await interaction.guild.channels.create({
    name: `${category.emoji}・ticket-${ticketNumber.toString().padStart(4, '0')}`,
    type: ChannelType.GuildText,
    topic: interaction.user.id,
    parent: settings.ticketCategoryId,
    permissionOverwrites: [
      {
        id: settings.ticketRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
      {
        id: interaction.guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ],
  });

  await deps.ticketRepo.create(guildId, {
    userId: interaction.user.id,
    channelId: ticketChannel.id,
    categoryId,
    ticketNumber,
  });

  const gIcon = interaction.guild.iconURL();
  const embed = new EmbedBuilder()
    .setColor((category.color as `#${string}`) ?? 0x2f3136)
    .setAuthor({
      name: `${category.emoji} Ticket #${ticketNumber.toString().padStart(4, '0')}`,
      ...(gIcon ? { iconURL: gIcon } : {}),
    })
    .setDescription(category.description ?? `Bem-vindo ao seu ticket de ${category.name}!`)
    .addFields(
      { name: '👤 Usuário', value: `<@${interaction.user.id}>`, inline: true },
      { name: '🎫 Número', value: `#${ticketNumber}`, inline: true }
    )
    .setFooter({
      text: interaction.guild.name,
      ...(gIcon ? { iconURL: gIcon } : {}),
    });

  const claimBtn = new ButtonBuilder()
    .setCustomId(TICKET_CUSTOM_IDS.claim)
    .setStyle(ButtonStyle.Success)
    .setLabel('Claim')
    .setEmoji('🎯');
  const closeBtn = new ButtonBuilder()
    .setCustomId(TICKET_CUSTOM_IDS.close)
    .setStyle(ButtonStyle.Danger)
    .setLabel('Fechar')
    .setEmoji('🔒');
  const mentionBtn = new ButtonBuilder()
    .setCustomId(TICKET_CUSTOM_IDS.mention)
    .setStyle(ButtonStyle.Secondary)
    .setLabel('Mencionar')
    .setEmoji('👤');
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claimBtn, closeBtn, mentionBtn);

  let mentionContent = '';
  if (settings.mentionRoleId) {
    mentionContent = `<@&${settings.mentionRoleId}>`;
  }

  await ticketChannel.send({
    content: mentionContent,
    embeds: [embed],
    components: [row],
  });

  const linkEmbed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setDescription(
      `✅ Seu ticket ${category.emoji} #${ticketNumber.toString().padStart(4, '0')} foi criado em ${ticketChannel}`
    );
  const linkBtn = new ButtonBuilder()
    .setLabel('Ir para o ticket')
    .setURL(ticketChannel.url)
    .setStyle(ButtonStyle.Link);
  const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(linkBtn);

  await interaction.reply({
    embeds: [linkEmbed],
    components: [linkRow],
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

export async function processTicketClose(
  deps: ITicketLifecycleDeps,
  interaction: ButtonInteraction
): Promise<boolean> {
  const channel = interaction.channel;
  const guildId = interaction.guildId;
  if (!channel || !guildId || !('topic' in channel)) return true;

  const userId = channel.topic;
  const settings = await deps.settingsRepo.findByGuildId(guildId);
  if (!settings?.ticketRoleId) return true;

  const member = interaction.member;
  const roles =
    member && typeof member === 'object' && 'roles' in member
      ? (member as { roles: { cache?: { has: (id: string) => boolean } } }).roles?.cache
      : null;
  const perms =
    member && typeof member === 'object' && 'permissions' in member
      ? (member as { permissions: { has: (p: bigint) => boolean } }).permissions
      : null;
  const hasRole = roles?.has(settings.ticketRoleId) ?? false;
  const isAdmin = perms?.has(PermissionFlagsBits.Administrator) ?? false;
  if (!hasRole && !isAdmin) {
    await interaction.reply({
      content: `❌ Você precisa do cargo <@&${settings.ticketRoleId}> ou ser Admin.`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const ticket = await deps.ticketRepo.findByChannel(channel.id);
  if (!ticket?.claimedBy) {
    await interaction.reply({
      content: '❌ Use o botão "Claim" antes de fechar.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  await channel.permissionOverwrites.edit(userId!, { ViewChannel: false });
  await channel.permissionOverwrites.edit(settings.ticketRoleId, {
    ViewChannel: true,
    SendMessages: true,
  });
  await channel.permissionOverwrites.edit(interaction.guild!.id, { ViewChannel: false });

  const iconUrl = interaction.guild!.iconURL();
  const closedEmbed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setDescription('Ticket fechado. Escolha uma ação:')
    .setFooter({
      text: interaction.guild!.name,
      ...(iconUrl ? { iconURL: iconUrl } : {}),
    });
  const reopenBtn = new ButtonBuilder()
    .setCustomId(TICKET_CUSTOM_IDS.reopen)
    .setStyle(ButtonStyle.Primary)
    .setLabel('Reabrir');
  const transcriptBtn = new ButtonBuilder()
    .setCustomId(TICKET_CUSTOM_IDS.transcript)
    .setStyle(ButtonStyle.Danger)
    .setLabel('Transcrever e apagar');
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(reopenBtn, transcriptBtn);

  await interaction.reply({ embeds: [closedEmbed], components: [row] });
  return true;
}

export async function processTicketClaim(
  deps: ITicketLifecycleDeps,
  interaction: ButtonInteraction
): Promise<boolean> {
  const ticket = await deps.ticketRepo.findByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({
      content: '❌ Este comando só pode ser usado em canais de ticket.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (ticket.claimedBy) {
    await interaction.reply({
      content: '❌ Este ticket já foi reivindicado.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const settings = await deps.settingsRepo.findByGuildId(interaction.guildId!);
  if (!settings?.ticketRoleId) return true;

  const member = interaction.member;
  const roles =
    member && typeof member === 'object' && 'roles' in member
      ? (member as { roles: { cache?: { has: (id: string) => boolean } } }).roles?.cache
      : null;
  const hasRole = roles?.has(settings.ticketRoleId) ?? false;
  if (!hasRole) {
    await interaction.reply({
      content: `❌ Você precisa do cargo <@&${settings.ticketRoleId}>.`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  await deps.ticketRepo.claim(ticket.id, interaction.user.id);

  const claimEmbed = new EmbedBuilder()
    .setTitle('Atendimento iniciado')
    .setDescription(`**Atendente:** ${interaction.user}`)
    .setColor(0x2f3136)
    .setThumbnail(interaction.user.displayAvatarURL())
    .setTimestamp();

  const ch = interaction.channel;
  if (ch && 'send' in ch) {
    await (ch as { send: (opts: object) => Promise<unknown> }).send({ embeds: [claimEmbed] });
  }

  const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(TICKET_CUSTOM_IDS.claim)
      .setStyle(ButtonStyle.Success)
      .setLabel('Claim')
      .setEmoji('🎯')
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(TICKET_CUSTOM_IDS.close)
      .setStyle(ButtonStyle.Danger)
      .setLabel('Fechar')
      .setEmoji('🔒'),
    new ButtonBuilder()
      .setCustomId(TICKET_CUSTOM_IDS.mention)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Mencionar')
      .setEmoji('👤')
  );

  if (interaction.message && 'edit' in interaction.message) {
    await interaction.message.edit({ components: [updatedRow] });
  }

  await interaction.reply({
    content: '✅ Ticket reivindicado com sucesso!',
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

export async function processTicketReopen(
  deps: ITicketLifecycleDeps,
  interaction: ButtonInteraction
): Promise<boolean> {
  const channel = interaction.channel as {
    topic?: string | null;
    permissionOverwrites?: { edit: (id: string, perms: object) => Promise<unknown> };
  } | null;
  const topic = channel && 'topic' in channel ? channel.topic : null;
  const ticket = await deps.ticketRepo.findByChannel(interaction.channelId!);
  const settings = await deps.settingsRepo.findByGuildId(interaction.guildId!);

  if (!ticket || !settings?.ticketRoleId) return true;

  await deps.ticketRepo.reopen(ticket.id);

  if (topic && channel?.permissionOverwrites) {
    const member = await interaction.guild!.members.fetch(topic).catch(() => null);
    if (member) {
      await channel.permissionOverwrites.edit(topic, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true,
        EmbedLinks: true,
      });
    }
  }

  if (channel?.permissionOverwrites) {
    await channel.permissionOverwrites.edit(settings.ticketRoleId, {
      ViewChannel: true,
      SendMessages: true,
      AttachFiles: true,
      EmbedLinks: true,
    });
    await channel.permissionOverwrites.edit(interaction.guild!.id, { ViewChannel: false });
  }

  const guildIcon = interaction.guild!.iconURL();
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setDescription('Ticket reaberto!')
    .setFooter({
      text: interaction.guild!.name,
      ...(guildIcon ? { iconURL: guildIcon } : {}),
    });
  const closeMsgBtn = new ButtonBuilder()
    .setCustomId(TICKET_CUSTOM_IDS.closeMessage)
    .setStyle(ButtonStyle.Danger)
    .setLabel('Apagar mensagem')
    .setEmoji('🗑️');
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeMsgBtn);

  await interaction.message?.delete();
  await interaction.reply({
    ...(topic ? { content: `<@${topic}>` } : {}),
    embeds: [embed],
    components: [row],
  });
  return true;
}

export async function processTicketCloseMessage(
  _deps: ITicketLifecycleDeps,
  interaction: ButtonInteraction
): Promise<boolean> {
  try {
    await interaction.message.delete();
  } catch {
    // ignore
  }
  return true;
}

export async function processTicketTranscript(
  deps: ITicketLifecycleDeps,
  interaction: ButtonInteraction
): Promise<boolean> {
  const channel = interaction.channel;
  const ticket = await deps.ticketRepo.findByChannel(interaction.channelId!);
  const settings = await deps.settingsRepo.findByGuildId(interaction.guildId!);

  if (!ticket || !channel) return true;

  await interaction.reply({
    content: '🔄 Gerando transcript e fechando ticket em 3 segundos...',
    flags: MessageFlags.Ephemeral,
  });

  let transcriptAttachment: Awaited<ReturnType<typeof discordTranscripts.createTranscript>> | null =
    null;
  try {
    transcriptAttachment = await discordTranscripts.createTranscript(channel as never, {
      limit: -1,
      filename: `transcript-${channel.id}.html`,
      poweredBy: false,
    });
  } catch (err) {
    logger.error(
      'TicketModule',
      `Erro ao gerar transcript: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  await deps.ticketRepo.close(ticket.id);

  if (settings?.ticketLogsChannelId) {
    const logsChannel = await interaction.guild!.channels.fetch(settings.ticketLogsChannelId);
    if (logsChannel && 'send' in logsChannel) {
      const topic = 'topic' in channel ? channel.topic : null;
      const embed = new EmbedBuilder()
        .setColor(0x2f3136)
        .setTitle('Ticket Fechado')
        .setDescription(
          `Ticket #${ticket.ticketNumber} de <@${topic ?? ticket.userId}> fechado por ${interaction.user}.`
        )
        .setTimestamp();

      const files = transcriptAttachment ? [transcriptAttachment] : [];

      await (logsChannel as { send: (opts: object) => Promise<unknown> })
        .send({ embeds: [embed], files })
        .catch(() => null);
    }
  }

  await new Promise((r) => setTimeout(r, 3000));
  if (channel && 'delete' in channel) {
    await (channel as { delete: () => Promise<unknown> }).delete();
  }
  return true;
}

export async function processTicketMention(
  _deps: ITicketLifecycleDeps,
  interaction: ButtonInteraction
): Promise<boolean> {
  const channel = interaction.channel;
  const topic = channel && 'topic' in channel ? channel.topic : null;
  if (!topic) {
    await interaction.reply({
      content: '❌ Não foi possível identificar o usuário do ticket.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  try {
    const member = await interaction.guild!.members.fetch(topic);
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('Ticket Aberto')
      .setDescription(
        `Olá ${member.user.tag}, você foi mencionado no ticket em ${interaction.guild!.name}.`
      )
      .addFields([{ name: 'Canal', value: channel ? `<#${channel.id}>` : '' }])
      .setTimestamp();
    const btn = new ButtonBuilder()
      .setLabel('Ir para o ticket')
      .setURL(`https://discord.com/channels/${interaction.guildId}/${channel?.id ?? ''}`)
      .setStyle(ButtonStyle.Link);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn);

    await member.send({
      content: `Você foi mencionado no ticket:`,
      embeds: [embed],
      components: [row],
    });

    await interaction.reply({
      content: '✅ Usuário notificado.',
      flags: MessageFlags.Ephemeral,
    });
  } catch {
    await interaction.reply({
      content: '❌ Não foi possível enviar DM ao usuário.',
      flags: MessageFlags.Ephemeral,
    });
  }
  return true;
}
