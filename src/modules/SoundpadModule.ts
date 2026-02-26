import { readdirSync } from 'fs';
import { join, extname, relative } from 'path';
import { Events, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { IDareClient } from '@/interfaces/IDareClient.js';
import { GuildMember } from 'discord.js';
import type {
  StringSelectMenuInteraction,
  ButtonInteraction,
  TextChannel,
  VoiceChannel,
} from 'discord.js';
import { logger } from '@/shared/index.js';

export const SOUNDPAD_CATEGORIES: Array<{ label: string; value: string }> = [
  { label: 'audios', value: 'spad_audios' },
  { label: 'frases', value: 'spad_frases' },
  { label: 'memes', value: 'spad_memes' },
  { label: 'musicas', value: 'spad_musicas' },
  { label: 'times', value: 'spad_times' },
];

const SOUNDPAD_PATHS: Record<string, { path: string; category: string }> = {
  spad_audios: { path: 'src/audios/audios', category: 'audios' },
  spad_frases: { path: 'src/audios/frases', category: 'frases' },
  spad_memes: { path: 'src/audios/memes', category: 'memes' },
  spad_musicas: { path: 'src/audios/musicas', category: 'musicas' },
  spad_times: { path: 'src/audios/times', category: 'times' },
};

const BUTTONS_PER_ROW = 5;

const AUDIOS_BASE = join(process.cwd(), 'src/audios');

function getPadKey(absPath: string): string {
  return relative(AUDIOS_BASE, absPath)
    .replace(/\\/g, '/')
    .replace(/\.mp3$/i, '');
}

function findMp3InDir(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findMp3InDir(full));
      } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.mp3') {
        files.push(full);
      }
    }
  } catch {
    return files;
  }
  return files;
}

function generateButtons(basePath: string): ActionRowBuilder<ButtonBuilder>[] {
  const fullPath = join(process.cwd(), basePath);
  const files = findMp3InDir(fullPath);
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  for (let i = 0; i < files.length; i += BUTTONS_PER_ROW) {
    const chunk = files.slice(i, i + BUTTONS_PER_ROW);
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const file of chunk) {
      const key = getPadKey(file);
      const label = key.split('/').pop() ?? key;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(key)
          .setLabel(label.length > 80 ? label.slice(0, 77) + '...' : label)
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }
  return rows;
}

export class SoundpadModule {
  constructor(private readonly client: IDareClient) {}

  bootstrap(): void {
    this.client.soundpadModule = this;
    this.client.once(Events.ClientReady, () => {
      this.loadPads(this.client);
    });
  }

  private loadPads(client: IDareClient): void {
    logger.info('Soundpad', 'Loading soundpads...');
    try {
      const files = findMp3InDir(AUDIOS_BASE);

      for (const file of files) {
        const key = getPadKey(file);
        const name = key.split('/').pop() ?? key;
        if (!client.pads?.has(key)) {
          client.pads?.set(key, { name, path: file });
        } else {
          logger.warn('Soundpad', `Duplicate key ignored: "${key}" (${file})`);
        }
      }

      logger.info('Soundpad', `Soundpad loaded: ${client.pads?.size ?? 0} pads.`);
    } catch (error) {
      logger.error('Soundpad', `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<boolean> {
    const value = interaction.values[0];
    if (!value) return false;
    const config = SOUNDPAD_PATHS[value];
    if (!config) return false;

    const rows = generateButtons(config.path);
    if (rows.length === 0) {
      await interaction.reply({
        content: `No audio files in category "${config.category}".`,
        flags: [MessageFlags.Ephemeral],
      });
      return true;
    }

    await interaction.reply({
      content: `Sending audio list.\nCategory: ${config.category}`,
      flags: [MessageFlags.Ephemeral],
    });

    const channel = interaction.channel;
    if (channel && 'send' in channel) {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        await (channel as TextChannel).send({
          content: `Audio list (${config.category}): ${i + 1}`,
          components: [row],
        });
      }
    }
    return true;
  }

  async handleButton(interaction: ButtonInteraction): Promise<boolean> {
    const pad = this.client.pads?.get(interaction.customId ?? '');
    if (!pad) return false;

    const rawMember = interaction.member;
    let member: GuildMember | null = null;
    if (rawMember instanceof GuildMember) {
      member = rawMember;
    } else if (interaction.guild && rawMember) {
      member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    }
    if (!member || !member.voice.channel) {
      await interaction.reply({
        content: 'You must be in a voice channel to play sounds.',
        flags: [MessageFlags.Ephemeral],
      });
      return true;
    }

    const channel = member.voice.channel as VoiceChannel;

    try {
      const params = {
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
      };
      await this.client.soundModule.playSound(
        { guildId: interaction.guildId, member },
        pad,
        params
      );
      await interaction.reply({
        content: `Playing: ${pad.name}`,
        flags: [MessageFlags.Ephemeral],
      });
    } catch (error) {
      await interaction.reply({
        content: error instanceof Error ? error.message : 'Failed to play sound.',
        flags: [MessageFlags.Ephemeral],
      });
    }
    return true;
  }
}
