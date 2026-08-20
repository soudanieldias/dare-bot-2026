import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  GuildMember,
  type Interaction,
} from 'discord.js';
import type { ICommand, IDareClient } from '@/interfaces/index.js';

export const audioCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('audio')
    .setDescription('Utilitários de áudio / gravação de call')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sc) =>
      sc
        .setName('recordcall')
        .setDescription('Inicia gravação contínua da call (um PCM por usuário, alinhados no tempo)')
    )
    .addSubcommand((sc) =>
      sc.setName('stoprecord').setDescription('Para a gravação da call')
    ) as ICommand['data'],

  category: 'features',

  async execute(client: IDareClient, interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    let voiceChannelId: string | null = null;
    const guild = interaction.guild;

    if (!guild?.voiceAdapterCreator) {
      await interaction.reply({
        content: 'Este comando só pode ser usado em um servidor com voz.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    try {
      if (sub === 'stoprecord') {
        const result = client.audioManager.stopCallRecording(guild.id);
        await interaction.reply({
          content: result.message,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (sub === 'recordcall') {
        const member = interaction.member;

        if (member instanceof GuildMember) {
          voiceChannelId = member.voice.channelId;
        } else if (member && typeof member === 'object' && 'voice' in member) {
          const voice = (member as { voice?: { channelId?: string | null } }).voice;
          voiceChannelId = voice?.channelId ?? null;
        }

        if (!voiceChannelId) {
          await interaction.reply({
            content: 'Você precisa estar em um canal de voz.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const alreadyConnected = client.audioManager.isConnected(guild.id);
        const connectedChannelId = client.audioManager.getConnectionChannelId(guild.id);

        if (alreadyConnected && connectedChannelId && connectedChannelId !== voiceChannelId) {
          await interaction.reply({
            content: 'O bot já está em outro canal de voz. Entre no mesmo canal ou pare o áudio.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const result = await client.audioManager.startCallRecording(
          guild.id,
          voiceChannelId,
          guild.voiceAdapterCreator
        );

        await interaction.editReply({ content: result.message });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `❌ ${msg}` }).catch(() => null);
      } else {
        await interaction
          .reply({ content: `❌ ${msg}`, flags: MessageFlags.Ephemeral })
          .catch(() => null);
      }
    }
  },
};
