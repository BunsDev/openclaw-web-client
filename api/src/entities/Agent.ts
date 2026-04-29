import { Entity, PrimaryGeneratedColumn, Column, DeleteDateColumn } from 'typeorm';

@Entity('agents')
export default class Agent {
  @PrimaryGeneratedColumn()
  _id: number;

  @Column()
  name: string;

  @Column({ default: 'main' })
  openclawAgentId: string;

  @Column()
  createdBy: number;

  @Column({ type: 'datetime', default: () => "datetime('now')" })
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true, default: null })
  updatedAt: Date | null;

  @DeleteDateColumn({ type: 'datetime', nullable: true, default: null })
  deletedAt: Date | null;

  @Column({ type: 'real', nullable: true, default: null })
  costLimitDaily: number | null;

  @Column({ type: 'real', nullable: true, default: null })
  costLimitMonthly: number | null;

  @Column({ type: 'real', nullable: true, default: null })
  costLimitTotal: number | null;
}
