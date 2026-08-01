import type { IDareClient } from '@/interfaces/index.js';
import { EmbedBuilder } from 'discord.js';
import type { Interaction } from 'discord.js';

export class EmbedModule {
  constructor(private readonly client: IDareClient) {}
  public embedsList: EmbedBuilder[] = [
    new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('Some title')
      .setURL('https://discord.js.org/')
      .setAuthor({
        name: 'Some name',
        iconURL: 'https://i.imgur.com/AfFp7pu.png',
        url: 'https://discord.js.org',
      })
      .setDescription('Some description here')
      .setThumbnail('https://i.imgur.com/AfFp7pu.png')
      .addFields(
        { name: 'Regular field title', value: 'Some value here' },
        { name: '\u200B', value: '\u200B' },
        { name: 'Inline field title', value: 'Some value here', inline: true },
        { name: 'Inline field title', value: 'Some value here', inline: true }
      )
      .addFields({ name: 'Inline field title', value: 'Some value here', inline: true })
      .setImage('https://i.imgur.com/AfFp7pu.png')
      .setTimestamp()
      .setFooter({ text: 'Some footer text here', iconURL: 'https://i.imgur.com/AfFp7pu.png' }),
  ];

  get embeds() {
    return this.embedsList;
  }

  bootstrap(client: IDareClient, interaction: Interaction): void {
    if (interaction.isRepliable()) {
      interaction.reply({ embeds: this.embedsList });
    }
  }
}
