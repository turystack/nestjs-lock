# Lock

Distributed lock module with decorator support. Storage comes from `@turystack/nestjs-cache`, which is adapter-based — any cache adapter works; Redis is the built-in adapter option.

## Setup

Preferred: register `CacheModule` **once** in the app root and call `LockModule.register()` with no options — the lock reuses the app-wide connection instead of opening its own. Both registrations are global, so domain services in monorepo libs just inject `LockService` without importing anything.

```ts
import { ConfigModule, defineConfigSchema } from '@turystack/nestjs-config'
import { LockModule } from '@turystack/nestjs-lock'
import { z } from 'zod'

export const configSchema = defineConfigSchema({
  REDIS_URL: z.string(),
})

declare module '@turystack/nestjs-config' {
  interface ConfigSchemaRegistry {
    schema: typeof configSchema
  }
}

// Preferred: one shared connection for cache, lock, and rate-limit
@Module({
  imports: [
    ConfigModule.register({ schema: configSchema }),
    CacheModule.register((config) => ({
      adapter: 'redis',
      redis: { url: config.get('REDIS_URL') },
    })),
    LockModule.register(),
  ],
})
class AppModule {}

// Standalone: own storage config (same options as CacheModule.register) —
// opens a dedicated connection; only use when isolation is intentional
@Module({
  imports: [
    ConfigModule.register({ schema: configSchema }),
    LockModule.register((config) => ({
      adapter: 'redis',
      redis: { url: config.get('REDIS_URL') },
    })),
  ],
})
class AppModule {}
```

`register` also accepts a plain options object; the `(config) => options` form injects the `ConfigService` from `@turystack/nestjs-config` at boot.

## LockService

Injectable service available after module registration.

```ts
import { LockService } from '@turystack/nestjs-lock'

class OrdersService {
  constructor(private readonly lockService: LockService) {}

  async processOrder(orderId: string) {
    const { unlock } = await this.lockService.lock(`order:${orderId}`, {
      ttl: 10_000,
      waitTimeout: 5_000,
    })

    try {
      // critical section
    } finally {
      await unlock()
    }
  }
}
```

### Methods

| Method | Signature | Description |
|---|---|---|
| `lock` | `lock(key: string, options?: LockOptions): Promise<{ unlock: () => Promise<void> }>` | Acquire a distributed lock with retry loop |

## Decorator

### `@Lock(key, options?)`

Acquires the lock before method execution and releases it after (even on error). Uses the same key-resolution engine as `@Cache.*`: a static string, or a resolver receiving the method arguments as a tuple. The tuple generic is optional — pass it when you want the arguments typed.

```ts
import { Lock } from '@turystack/nestjs-lock'

class OrdersService {
  @Lock(([orderId]) => `order:${orderId}`, { ttl: 10_000 })
  async processOrder(orderId: string) {
    // automatically locked/unlocked
  }

  // Optionally type the args tuple:
  @Lock<[string]>(([orderId]) => `order:${orderId}`)
  async cancelOrder(orderId: string) {}
}
```

## Types

```ts
type LockOptions = {
  ttl?: number          // Lock TTL in ms (default: 10000)
  waitTimeout?: number  // Max wait time in ms (default: 5000)
  retryInterval?: number // Retry interval in ms (default: 100)
}

// Same shape as CacheModuleOptions: pick a storage adapter and its config.
type LockModuleOptions = CacheModuleOptions
```

## Errors

| Error | Description |
|---|---|
| `LockError` | Thrown when lock acquisition times out |
