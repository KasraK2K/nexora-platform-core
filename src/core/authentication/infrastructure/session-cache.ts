import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import type { SessionCachePort } from '../application/session-cache.port';

/** Non-authoritative session lookup value stored in Redis. */
export type CachedSession = {
  userId: string;
  workspaceId: string;
};

/** Redis adapter for disposable hashed-token session lookups. */
@Injectable()
export class SessionCache implements SessionCachePort {
  constructor(private readonly redis: RedisService) {}

  /** Stores the lookup only for the durable session's remaining lifetime. */
  async store(
    tokenHash: string,
    session: CachedSession,
    expiresAt: Date,
  ): Promise<void> {
    const ttlMilliseconds = expiresAt.getTime() - Date.now();
    if (ttlMilliseconds <= 0) {
      return;
    }

    await this.redis.client.set(this.key(tokenHash), JSON.stringify(session), {
      expiration: { type: 'PX', value: ttlMilliseconds },
    });
  }

  /** Reports whether a hashed-token cache entry currently exists. */
  async exists(tokenHash: string): Promise<boolean> {
    return (await this.redis.client.exists(this.key(tokenHash))) === 1;
  }

  /** Removes one hashed-token cache entry. */
  async remove(tokenHash: string): Promise<void> {
    await this.redis.client.del(this.key(tokenHash));
  }

  /** Namespaces cache keys and never embeds the raw opaque token. */
  private key(tokenHash: string): string {
    return `auth:session:${tokenHash}`;
  }
}
