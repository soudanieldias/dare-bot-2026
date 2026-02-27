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

  async critical(module: string, msg: unknown, error?: Error): Promise<void> {
    const text = typeof msg === 'string' ? msg : String(msg);
    console.error(colors.red(`[CRITICAL/${module}]`), text);
    if (error?.stack) console.error(error.stack);

    const webhookUrl = config.logging.webhookUrl;
    if (!webhookUrl) return;

    try {
      const fields: { name: string; value: string }[] = [];
      if (error?.stack) {
        fields.push({
          name: 'Stack',
          value: `\`\`\`${error.stack.slice(0, 1000)}\`\`\``,
        });
      }

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: `Critical: ${module}`,
              description: text.slice(0, 4000),
              color: 0xff0000,
              timestamp: new Date().toISOString(),
              footer: { text: 'DARE-BOT Logs' },
              fields: fields.length > 0 ? fields : undefined,
            },
          ],
        }),
      });
    } catch (err) {
      console.error('[Logger] Failed to send critical to Discord:', err);
    }
  }
}

export const logger = new Logger();
