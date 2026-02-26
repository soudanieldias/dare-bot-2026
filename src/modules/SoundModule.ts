import type { GuildMember, VoiceChannel } from 'discord.js';
import type { IDareClient } from '@/interfaces/IDareClient.js';

export interface ConnectionParams {
  channelId: string;
  guildId: string;
  adapterCreator: unknown;
}

export interface PadInfo {
  name: string;
  path: string;
}

export class SoundModule {
  constructor(private readonly client: IDareClient) {}

  bootstrap(): void {
    this.client.soundModule = this;
  }

  async playSound(
    interaction: { guildId?: string | null; member: GuildMember | null },
    pad: PadInfo,
    params: ConnectionParams
  ): Promise<void> {
    const { guildId, channelId, adapterCreator } = params;
    const member = interaction.member;
    if (!member) throw new Error('Member not found');

    const existingChannelId = this.client.audioManager.getConnectionChannelId(guildId);
    if (existingChannelId && existingChannelId !== member.voice.channel?.id) {
      const botChannel = member.guild.channels.cache.get(existingChannelId) as
        | VoiceChannel
        | undefined;
      if (botChannel && 'members' in botChannel && botChannel.members.size > 1) {
        throw new Error('Bot is already in another voice channel.');
      }
    }

    await this.client.audioManager.play(guildId, channelId, adapterCreator, {
      source: pad.path,
      name: pad.name,
      type: 'EFFECT',
    });
  }

  stopSound(guildId: string): void {
    this.client.audioManager.stop(guildId);
  }
}
