import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class DatabaseContext {
  private readonly storage = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(private readonly prisma: PrismaService) {}

  get client(): Prisma.TransactionClient {
    return this.storage.getStore() ?? this.prisma;
  }

  run<T>(
    client: Prisma.TransactionClient,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.storage.run(client, operation);
  }
}
