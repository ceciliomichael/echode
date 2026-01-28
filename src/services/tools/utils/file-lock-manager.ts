import * as path from 'path';

/**
 * Manages file locks to coordinate access between tools potentially running in parallel.
 * This ensures that a tool reading a file (like get_diagnostics) waits if another tool
 * (like edit) is currently modifying it.
 */
export class FileLockManager {
    private static locks = new Set<string>();
    private static waiters = new Map<string, Array<(value: void | PromiseLike<void>) => void>>();

    /**
     * Normalizes file path to ensure consistent locking keys
     */
    private static normalizePath(filePath: string): string {
        return path.resolve(filePath).toLowerCase(); // Case-insensitive on Windows
    }

    /**
     * Acquire a lock for the given file path.
     * If the file is already locked, this returns false (caller should decide what to do, usually retry or error).
     * NOTE: For the current use case, we want blocking 'acquire' behavior implemented manually via waitForLock + acquire,
     * or simple synchronous acquire. Here we implement simple synchronous try-acquire.
     */
    static tryAcquire(filePath: string): boolean {
        const key = this.normalizePath(filePath);
        if (this.locks.has(key)) {
            return false;
        }
        this.locks.add(key);
        // console.log(`[FileLockManager] Acquired lock for ${key}`);
        return true;
    }

    /**
     * Release the lock for the given file path and notify waiters.
     */
    static release(filePath: string): void {
        const key = this.normalizePath(filePath);
        if (this.locks.delete(key)) {
            // console.log(`[FileLockManager] Released lock for ${key}`);
            const waitingResolvers = this.waiters.get(key);
            if (waitingResolvers) {
                this.waiters.delete(key);
                waitingResolvers.forEach(resolve => resolve());
            }
        }
    }

    /**
     * Check if a file is currently locked
     */
    static isLocked(filePath: string): boolean {
        return this.locks.has(this.normalizePath(filePath));
    }

    /**
     * Wait until the lock for the given file is released.
     * Returns immediately if not locked.
     */
    static async waitForLock(filePath: string, timeoutMs = 10000): Promise<void> {
        const key = this.normalizePath(filePath);
        if (!this.locks.has(key)) {
            return;
        }

        console.log(`[FileLockManager] Waiting for lock on ${key}`);

        return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                // Remove resolver from waiters list to avoid memory leaks
                const currentWaiters = this.waiters.get(key);
                if (currentWaiters) {
                    const idx = currentWaiters.indexOf(resolver);
                    if (idx !== -1) {
                        currentWaiters.splice(idx, 1);
                    }
                }
                console.warn(`[FileLockManager] Timeout waiting for lock on ${key}`);
                resolve(); // Fallback: resolve anyway to allow attempt
            }, timeoutMs);

            const resolver = () => {
                clearTimeout(timeout);
                resolve();
            };

            if (!this.waiters.has(key)) {
                this.waiters.set(key, []);
            }
            this.waiters.get(key)!.push(resolver);
        });
    }
}
