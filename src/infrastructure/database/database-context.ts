import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * Gives repositories the active Prisma transaction client without passing ORM
 * clients through every application contract.
 *
 * Outside `run`, `client` is the normal Prisma service. Inside it, all awaited
 * repository calls in the same asynchronous chain share the supplied client.
 */
@Injectable()
export class DatabaseContext {
  private readonly storage = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(private readonly prisma: PrismaService) {}

  /** Returns the current transaction client, or the root client when not in one. */
  get client(): Prisma.TransactionClient {
    return this.storage.getStore() ?? this.prisma;
  }

  /** Runs an operation with the given transaction client as its ambient client. */
  run<T>(
    client: Prisma.TransactionClient,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.storage.run(client, operation);
  }
}
