import colors from 'colors';
import { type Client, EmbedBuilder } from 'discord.js';
import { config } from '@/shared/Config.js';

export class Logger {
  private readonly isDebug = config.discord.debug ?? false;
  private readonly devId = config.discord.devId ?? null;

  info(module: string, msg: unknown): void {
    console.log(colors.green(`[INFO/${module}]`), msg);
  }

  startup(msg: unknown): void {
    console.log(colors.cyan('[STARTUP]'), msg);
  }

  error(module: string, msg: unknown): void {
    console.error(colors.red(`[ERROR/${module}]`), msg);
  }

  warn(module: string, msg: unknown): void {
    console.warn(colors.yellow(`[WARN/${module}]`), msg);
  }

  debug(module: string, msg: unknown): void {
    if (this.isDebug) {
      console.log(colors.blue(`[DEBUG/${module}]`), msg);
    }
  }

  async debugToDev(client: Client, module: string, msg: string): Promise<void> {
    if (!this.isDebug || !this.devId) return;

    try {
      const dev = await client.users.fetch(this.devId);
      if (!dev) return;

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`Debug System - ${module}`)
        .setDescription(`\`\`\`ts\n${msg}\n\`\`\``)
        .setTimestamp()
        .setFooter({ text: 'DARE-BOT Debugger' });

      await dev.send({ embeds: [embed] });
    } catch (err) {
      this.error('Logger', `Failed to send debug DM: ${err}`);
    }
  }
}

export const logger = new Logger();
