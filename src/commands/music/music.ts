import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  GuildMember,
  AttachmentBuilder,
  type Interaction,
} from 'discord.js';
import type { ICommand, IDareClient } from '@/interfaces/index.js';

import path from 'node:path';

export const musicCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Sistema de Música DARE-Music (playfile disponível)')
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .addSubcommand((sc) =>
      sc
        .setName('play')
        .setDescription('Toca uma música do YouTube (em implementação)')
        .addStringOption((opt) =>
          opt.setName('query').setDescription('Link ou nome do vídeo do YouTube').setRequired(true)
        )
    )
    .addSubcommand((sc) => sc.setName('stop').setDescription('Para a música e limpa a fila'))
    .addSubcommand((sc) => sc.setName('pause').setDescription('Pausa a música'))
    .addSubcommand((sc) => sc.setName('resume').setDescription('Retoma a música'))
    .addSubcommand((sc) => sc.setName('next').setDescription('Pula para a próxima música'))
    .addSubcommand((sc) => sc.setName('queue').setDescription('Mostra a fila atual de músicas'))
    .addSubcommand((sc) =>
      sc
        .setName('volume')
        .setDescription('Altera o volume da música')
        .addIntegerOption((opt) =>
          opt
            .setName('volume')
            .setDescription('Volume entre 0 e 100')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100)
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName('playfile')
        .setDescription('Toca um áudio da internet (mp3, mp4, webm, ogg)')
        .addStringOption((opt) =>
          opt.setName('source').setDescription('Link do arquivo de áudio').setRequired(true)
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName('jukebox')
        .setDescription('Inicia uma playlist local 24/7 a partir de uma pasta')
        .addStringOption((opt) =>
          opt
            .setName('category')
            .setDescription('Categoria da jukebox')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('Ordem de reprodução das músicas')
            .setRequired(false)
            .addChoices(
              { name: 'Aleatório', value: 'random' },
              { name: 'Em ordem', value: 'ordered' }
            )
        )
    ) as ICommand['data'],

  category: 'music',

  async execute(client: IDareClient, interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const member = interaction.member;
    const voiceChannelId =
      member && 'voice' in member && member.voice?.channel?.id ? member.voice.channel.id : null;

    if (!voiceChannelId) {
      await interaction.reply({
        content: 'Você precisa estar em um canal de voz para usar este comando.',
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

    try {
      switch (subCommand) {
        case 'play': {
          const query = interaction.options.getString('query', true);
          const mem = await resolveMember(member, guild, interaction.user.id);
          if (!mem) throw new Error('Membro não encontrado');

          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

          const { added, message } = await client.musicModule.play(
            connectionParams,
            mem,
            query,
            false
          );
          await interaction.editReply({
            content: added > 0 ? `▶️ ${message}` : message,
          });
          return;
        }

        case 'stop': {
          client.musicModule.stop(guild.id);
          await interaction.reply({
            content: 'Parando música e limpando a fila...',
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }

        case 'next': {
          client.musicModule.skip(guild.id);
          const nextMusic = await client.musicModule.getNextMusicInQueue(guild.id);

          await interaction.reply({
            content: `Pulando para a próxima música. Irá tocar: ▶️ ${nextMusic?.name || 'Nenhuma'}`,
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }

        case 'queue': {
          const { current, queue } = client.musicModule.getQueue(guild.id);
          if (!current && queue.length === 0) {
            await interaction.reply({
              content: 'Nenhuma música na fila.',
              flags: [MessageFlags.Ephemeral],
            });
            return;
          }

          const lines: string[] = [];
          if (current) {
            lines.push(`**Tocando agora:** ${current.name}`);
            if (queue.length > 0) lines.push('');
          }

          if (queue.length > 0) {
            lines.push(`**Fila completa (${queue.length}):**`);
            queue.forEach((item, i) => {
              lines.push(`${i + 1}. ${item.name}`);
            });
          }

          const content = lines.join('\n');
          if (content.length <= 1900) {
            await interaction.reply({ content, flags: [MessageFlags.Ephemeral] });
            return;
          }

          const queueFile = new AttachmentBuilder(Buffer.from(content, 'utf-8'), {
            name: `queue-${guild.id}.txt`,
          });

          await interaction.reply({
            content: 'A fila está muito grande para exibir aqui. Veja o arquivo completo abaixo.',
            files: [queueFile],
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }

        case 'volume': {
          const volume = interaction.options.getInteger('volume', true);
          client.musicModule.setVolume(guild.id, volume);
          await interaction.reply({
            content: `Volume alterado para ${volume}%`,
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }
        case 'playfile': {
          const source = interaction.options.getString('source', true);
          const mem = await resolveMember(member, guild, interaction.user.id);
          if (!mem) throw new Error('Membro não encontrado');

          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

          const { message } = await client.musicModule.play(connectionParams, mem, source, true);
          await interaction.editReply({ content: `▶️ ${message}` });
          return;
        }
        case 'jukebox': {
          const category = interaction.options.getString('category', true);
          const modeOption = interaction.options.getString('mode');
          const mode = modeOption === 'ordered' ? 'ordered' : 'random';
          const folder = path.join(client.settings.jukeboxRoot, category);

          const mem = await resolveMember(member, guild, interaction.user.id);
          if (!mem) throw new Error('Membro não encontrado');

          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

          const { message } = await client.musicModule.playJukebox(
            connectionParams,
            mem,
            folder,
            mode
          );
          await interaction.editReply({ content: `▶️ ${message}` });
          return;
        }
        case 'pause': {
          const paused = client.musicModule.pause(guild.id);
          await interaction.reply({
            content: paused ? '⏸️ Música pausada.' : 'Não foi possível pausar a música no momento.',
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }
        case 'resume': {
          const resumed = client.musicModule.resume(guild.id);
          await interaction.reply({
            content: resumed
              ? '▶️ Música retomada.'
              : 'Não foi possível retomar a música no momento.',
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Ocorreu um erro.';
      if (interaction.deferred) {
        await interaction.editReply({ content: `❌ ${msg}` }).catch(() => {});
      } else {
        await interaction
          .reply({ content: `❌ ${msg}`, flags: [MessageFlags.Ephemeral] })
          .catch(() => {});
      }
    }
  },
};

async function resolveMember(
  member: unknown,
  guild: { members: { fetch: (id: string) => Promise<GuildMember | null> } },
  userId: string
): Promise<GuildMember | null> {
  if (member instanceof GuildMember) return member;
  return guild.members.fetch(userId).catch(() => null);
}
