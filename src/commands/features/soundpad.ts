import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  MessageFlags,
  GuildMember,
  type Interaction,
  type TextChannel,
} from 'discord.js';
import type { IDareClient } from '@/interfaces/IDareClient.js';
import type { ICommand } from '@/interfaces/ICommand.js';
import { SOUNDPAD_CATEGORIES, generateSoundpadButtons } from '@/modules/SoundpadModule.js';

function findPad(client: IDareClient, input: string): { name: string; path: string } | undefined {
  const pad = client.pads?.get(input);
  if (pad) return pad;
  for (const [, p] of client.pads ?? []) {
    if (p.name === input || p.path.replace(/\\/g, '/').endsWith(`/${input}`)) return p;
  }
  return undefined;
}

export const soundpadCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('soundpad')
    .setDescription('Comandos de SoundPad')
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .addSubcommand((sc) =>
      sc.setName('list').setDescription('Lista áudios por categoria (menu)')
    )
    .addSubcommand((sc) =>
      sc.setName('list-all').setDescription('Lista todos os áudios de uma vez')
    )
    .addSubcommand((sc) =>
      sc
        .setName('play')
        .setDescription('Toca o áudio selecionado')
        .addStringOption((opt) =>
          opt.setName('filepath').setDescription('Nome ou caminho do arquivo de áudio').setRequired(true)
        )
    ) as ICommand['data'],

  async execute(client: IDareClient, interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const member = interaction.member;
    const voiceChannelId =
      member && 'voice' in member && member.voice?.channel?.id ? member.voice.channel.id : null;

    if (!voiceChannelId) {
      await interaction.reply({
        content: `Erro: <@!${interaction.user.id}> Entre em um canal de voz.`,
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const guild = interaction.guild;
    if (!guild?.voiceAdapterCreator) {
      await interaction.reply({
        content: 'Este servidor não suporta canais de voz.',
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const connectionParams = {
      channelId: voiceChannelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    };

    const subCommand = interaction.options.getSubcommand();

    if (subCommand === 'play') {
      const filepath = interaction.options.getString('filepath', true);
      const pad = findPad(client, filepath);

      if (!pad) {
        await interaction.reply({
          content: 'Pad não encontrado!',
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      await interaction.reply({
        content: `Tocando som ${pad.name}`,
        flags: [MessageFlags.Ephemeral],
      });

      try {
        let mem: GuildMember | null = member instanceof GuildMember ? member : null;
        if (!mem && member && guild) {
          mem = await guild.members.fetch(interaction.user.id).catch(() => null);
        }
        if (!mem) throw new Error('Member not found');
        await client.soundModule.playSound({ guildId: guild.id, member: mem }, pad, connectionParams);
      } catch (error) {
        await interaction.followUp({
          content: error instanceof Error ? error.message : 'Erro ao tocar o áudio.',
          flags: [MessageFlags.Ephemeral],
        });
      }
      return;
    }

    if (subCommand === 'list') {
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_category')
          .setPlaceholder('Escolha uma categoria...')
          .addOptions(SOUNDPAD_CATEGORIES)
      );

      await interaction.reply({
        content: 'Selecione uma categoria:',
        components: [row],
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    if (subCommand === 'list-all') {
      const rows = generateSoundpadButtons('src/audios');
      if (rows.length === 0) {
        await interaction.reply({
          content: 'Nenhum áudio encontrado.',
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      await interaction.reply({
        content: 'Enviando lista de todos os áudios.',
        flags: [MessageFlags.Ephemeral],
      });

      const channel = interaction.channel;
      if (channel && 'send' in channel) {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          await (channel as TextChannel).send({
            content: `Lista de áudios (todos): ${i + 1}`,
            components: [row],
          });
        }
      }
    }
  },
};
