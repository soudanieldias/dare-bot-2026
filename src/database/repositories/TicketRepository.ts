import { Repository } from 'typeorm';
import { AppDataSource } from '@/database/DatabaseSource.js';
import { Ticket } from '@/database/entities/index.js';

export class TicketRepository {
  private repo: Repository<Ticket>;

  constructor() {
    this.repo = AppDataSource.getRepository(Ticket);
  }

  async findOpenByUser(guildId: string, userId: string): Promise<Ticket | null> {
    return this.repo.findOne({
      where: { guildId, userId, status: 'open' },
      order: { createdAt: 'DESC' },
    });
  }

  async findByChannel(channelId: string): Promise<Ticket | null> {
    return this.repo.findOne({ where: { channelId } });
  }

  async getNextNumber(guildId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('t')
      .select('MAX(t.ticketNumber)', 'max')
      .where('t.guildId = :guildId', { guildId })
      .getRawOne<{ max: number | null }>();
    return (result?.max ?? 0) + 1;
  }

  async create(
    guildId: string,
    data: { userId: string; channelId: string; categoryId: string; ticketNumber: number }
  ): Promise<Ticket> {
    const ticket = this.repo.create({
      guildId,
      ...data,
      status: 'open',
    });
    return this.repo.save(ticket);
  }

  async updateChannel(id: string, channelId: string): Promise<void> {
    await this.repo.update(id, { channelId });
  }

  async claim(id: string, userId: string): Promise<void> {
    await this.repo.update(id, { claimedBy: userId });
  }

  async close(id: string): Promise<void> {
    await this.repo.update(id, { status: 'closed' });
  }

  async reopen(id: string): Promise<void> {
    await this.repo.update(id, { status: 'open', claimedBy: null });
  }
}
