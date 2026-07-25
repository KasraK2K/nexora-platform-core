import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import type { SessionCachePort } from '../application/session-cache.port';

export type CachedSession = {
  userId: string;
  workspaceId: string;
};

@Injectable()
export class SessionCache implements SessionCachePort {
  constructor(private readonly redis: RedisService) {}

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
      PX: ttlMilliseconds,
    });
  }

  async exists(tokenHash: string): Promise<boolean> {
    return (await this.redis.client.exists(this.key(tokenHash))) === 1;
  }

  async remove(tokenHash: string): Promise<void> {
    await this.redis.client.del(this.key(tokenHash));
  }

  private key(tokenHash: string): string {
    return `auth:session:${tokenHash}`;
  }
}
