import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  type ColorResolvable,
} from 'discord.js';

export async function sendEmbed(
  interaction: ChatInputCommandInteraction,
  message: string,
  color: ColorResolvable = 'Blurple',
  ephemeral: boolean = true
): Promise<void> {
  const embed = new EmbedBuilder().setColor(color).setDescription(message);
  const flags = ephemeral ? MessageFlags.Ephemeral : undefined;

  if (interaction.replied) {
    await interaction.followUp({ embeds: [embed], flags });
    return;
  }
  if (interaction.deferred) {
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  await interaction.reply({ embeds: [embed], flags });
}
