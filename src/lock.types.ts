import type { CacheModuleOptions } from '@turystack/nestjs-cache'

/** Options for {@link LockService.lock}. */
export type LockOptions = {
	/** Time-to-live for the lock key in milliseconds. Defaults to 10 000 (10 s). */
	ttl?: number
	/** Maximum time to wait for the lock in milliseconds. Defaults to 5 000 (5 s). */
	waitTimeout?: number
	/** Interval between retry attempts in milliseconds. Defaults to 100. */
	retryInterval?: number
}

/**
 * Options for {@link LockModule.register}. If omitted, reuses the existing
 * CacheModule from DI.
 *
 * Mirrors `CacheModuleOptions`: storage comes from a cache adapter, so any
 * adapter supported by `@turystack/nestjs-cache` works here (Redis is the
 * built-in option).
 */
export type LockModuleOptions = CacheModuleOptions
