import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  guildId!: string;

  @Column({ type: 'varchar', length: 255 })
  userId!: string;

  @Column({ type: 'varchar', length: 255 })
  channelId!: string;

  @Column({ type: 'varchar', length: 128 })
  categoryId!: string;

  @Column({ type: 'integer', default: 0 })
  ticketNumber!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  claimedBy!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
