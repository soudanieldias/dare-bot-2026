import { commandMap } from '@/commands/index.js';
import { getI18n } from '@/i18n/index.js';
import type { IDareClient } from '@/interfaces/IDareClient.js';
import { Events, MessageFlags, type Interaction } from 'discord.js';

export class OnInteractionModule {
  private client: IDareClient;

  constructor(client: IDareClient) {
    this.client = client;
  }

  public bootstrap(): void {
    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      try {
        // ChatInputCommand Handler
        if (interaction.isChatInputCommand()) {
          console.log(`Received command: ${interaction.commandName} from ${interaction.user.tag}`);
          const command = commandMap.get(interaction.commandName);

          if (command) {
            return command.execute(this.client, interaction);
          }
          return;
        }

        // Autocomplete Handler
        if (interaction.isAutocomplete()) {
          // TODO: Implement autocomplete logic here
          return;
        }

        // UserContextMenuCommand Handler
        if (interaction.isUserContextMenuCommand()) {
          // TODO: Implement user context menu logic here
          return;
        }

        // MessageContextMenuCommand Handler
        if (interaction.isMessageContextMenuCommand()) {
          // TODO: Implement message context menu logic here
          return;
        }

        if (interaction.isContextMenuCommand()) {
          // TODO: Implement generic context menu logic here
          return;
        }

        // Component Handlers: Buttons
        if (interaction.isButton()) {
          // TODO: Implement button logic here
          return;
        }

        // Component Handlers: Select Menus
        if (interaction.isStringSelectMenu()) {
          // TODO: Implement string select menu logic here
          return;
        }

        // UserSelectMenu Handler
        if (interaction.isUserSelectMenu()) {
          // TODO: Implement user select menu logic here
          return;
        }

        // RoleSelectMenu Handler
        if (interaction.isRoleSelectMenu()) {
          // TODO: Implement role select menu logic here
          return;
        }

        // ChannelSelectMenu Handler
        if (interaction.isChannelSelectMenu()) {
          // TODO: Implement channel select menu logic here
          return;
        }

        // MentionableSelectMenu Handler
        if (interaction.isMentionableSelectMenu()) {
          // TODO: Implement mentionable select menu logic here
          return;
        }

        // AnySelectMenu Handler
        if (interaction.isAnySelectMenu()) {
          // TODO: Implement generic select menu logic here
          return;
        }

        // ModalSubmit Handler
        if (interaction.isModalSubmit()) {
          // TODO: Implement modal submit logic here
          return;
        }

        // Final Fallback for repliable interactions
        if (interaction.isRepliable()) {
          const locale = 'locale' in interaction ? interaction.locale : 'pt-BR';
          await interaction.reply({
            content: getI18n(locale).common.underConstruction,
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (error) {
        console.error('Interaction error:', error);
      }
    });
  }
}
