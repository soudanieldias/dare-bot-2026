import { Repository } from 'typeorm';
import { AppDataSource } from '@/database/DatabaseSource.js';
import { GuildSettings } from '@/database/entities/index.js';

export class GuildSettingsRepository {
  private repo: Repository<GuildSettings>;

  constructor() {
    this.repo = AppDataSource.getRepository(GuildSettings);
  }

  async findByGuildId(guildId: string): Promise<GuildSettings | null> {
    return this.repo.findOne({ where: { guildId } });
  }

  async upsert(guildId: string, data: Partial<GuildSettings>): Promise<GuildSettings> {
    const existing = await this.repo.findOne({ where: { guildId } });
    const entity = existing ?? this.repo.create({ guildId });
    Object.assign(entity, data);
    return this.repo.save(entity);
  }
}
