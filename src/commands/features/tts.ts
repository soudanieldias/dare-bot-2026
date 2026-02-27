import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type Interaction,
} from 'discord.js';
import type { IDareClient } from '@/interfaces/IDareClient.js';
import type { ICommand } from '@/interfaces/ICommand.js';
import { TtsModule } from '@/modules/TtsModule.js';

const TTS_LANGUAGES = 'pt-BR, pt-PT, en-US, es-ES, fr-FR, de-DE, it-IT, ja-JP';

export const ttsCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('tts')
    .setDescription('Envia uma mensagem de texto para voz com o DARE BOT')
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .addStringOption((opt) =>
      opt
        .setName('message')
        .setDescription('Mensagem que será falada no canal de voz')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('language')
        .setDescription(`Idioma/voz (padrão: pt-BR). Ex: ${TTS_LANGUAGES}`)
        .setRequired(false)
    ) as ICommand['data'],

  async execute(client: IDareClient, interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const language = interaction.options.getString('language') ?? 'pt-BR';
    const message = interaction.options.getString('message', true);

    const member = interaction.member;
    const voiceChannelId =
      member && 'voice' in member && member.voice?.channel?.id ? member.voice.channel.id : null;

    if (!voiceChannelId) {
      await interaction.reply({
        content: 'Você não está conectado a um canal de voz.',
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

    try {
      const params = {
        channelId: voiceChannelId,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
      };
      new TtsModule(client).playTts(params, message, language);

      await interaction.reply({
        content: 'Mensagem enviada para o canal de voz.',
        flags: [MessageFlags.Ephemeral],
      });
    } catch (error) {
      await interaction.reply({
        content: error instanceof Error ? error.message : 'Ocorreu um erro ao enviar a mensagem.',
        flags: [MessageFlags.Ephemeral],
      });
    }
  },
};
