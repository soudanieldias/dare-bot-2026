import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  GuildMember,
  type Interaction,
} from 'discord.js';
import type { IDareClient } from '@/interfaces/IDareClient.js';
import type { ICommand } from '@/interfaces/ICommand.js';

export const musicCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Sistema de Música DARE-Music (YouTube)')
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .addSubcommand((sc) =>
      sc
        .setName('play')
        .setDescription('Toca uma música ou playlist do YouTube')
        .addStringOption((opt) =>
          opt
            .setName('query')
            .setDescription('Nome, link do vídeo ou playlist do YouTube')
            .setRequired(true)
        )
    )
    .addSubcommand((sc) => sc.setName('stop').setDescription('Para a música e limpa a fila'))
    .addSubcommand((sc) => sc.setName('next').setDescription('Pula para a próxima música'))
    .addSubcommand((sc) =>
      sc.setName('queue').setDescription('Mostra a fila atual de músicas')
    )
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
          opt
            .setName('source')
            .setDescription('Link do arquivo de áudio')
            .setRequired(true)
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
      if (subCommand === 'play') {
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

      if (subCommand === 'stop') {
        client.musicModule.stop(guild.id);
        await interaction.reply({
          content: 'Parando música e limpando a fila...',
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      if (subCommand === 'next') {
        client.musicModule.skip(guild.id);
        await interaction.reply({
          content: 'Pulando para a próxima música...',
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      if (subCommand === 'queue') {
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
        }
        if (queue.length > 0) {
          lines.push(`\n**Fila (${queue.length}):**`);
          queue.slice(0, 10).forEach((item, i) => {
            lines.push(`${i + 1}. ${item.name}`);
          });
          if (queue.length > 10) {
            lines.push(`... e mais ${queue.length - 10}`);
          }
        }
        await interaction.reply({
          content: lines.join('\n') || 'Fila vazia.',
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      if (subCommand === 'volume') {
        const volume = interaction.options.getInteger('volume', true);
        client.musicModule.setVolume(guild.id, volume);
        await interaction.reply({
          content: `Volume alterado para ${volume}%`,
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      if (subCommand === 'playfile') {
        const source = interaction.options.getString('source', true);
        const mem = await resolveMember(member, guild, interaction.user.id);
        if (!mem) throw new Error('Membro não encontrado');

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const { message } = await client.musicModule.play(
          connectionParams,
          mem,
          source,
          true
        );
        await interaction.editReply({ content: `▶️ ${message}` });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Ocorreu um erro.';
      if (interaction.deferred) {
        await interaction.editReply({ content: `❌ ${msg}` }).catch(() => {});
      } else {
        await interaction.reply({ content: `❌ ${msg}`, flags: [MessageFlags.Ephemeral] }).catch(() => {});
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
