/**
 * Streaming timeout utility for auto-retry on stalled requests
 * 
 * Implements infinite retry when no streaming data is received within the timeout period.
 */

export interface StreamingTimeoutOptions {
  /** Timeout in milliseconds before retry (default: 10000) */
  timeoutMs: number;
  /** Abort signal to cancel the entire operation */
  signal?: AbortSignal;
  /** Callback when a retry occurs */
  onRetry?: (attempt: number) => void;
}

/**
 * Creates a timeout controller for streaming operations.
 * 
 * Usage:
 * 1. Call `controller.start()` before initiating the stream
 * 2. Call `controller.notifyChunk()` whenever a chunk is received
 * 3. Call `controller.stop()` when streaming completes
 * 
 * The controller will reject with a timeout error if no chunks are received
 * within the timeout period after start() is called.
 */
export function createStreamingTimeoutController(options: StreamingTimeoutOptions) {
  let timeoutId: NodeJS.Timeout | null = null;
  let hasReceivedFirstChunk = false;
  let timeoutReject: ((error: Error) => void) | null = null;
  let isActive = false;

  const start = (): Promise<void> => {
    return new Promise((_, reject) => {
      if (options.signal?.aborted) {
        reject(new Error('Aborted'));
        return;
      }

      isActive = true;
      hasReceivedFirstChunk = false;
      timeoutReject = reject;

      timeoutId = setTimeout(() => {
        if (!hasReceivedFirstChunk && isActive) {
          reject(new StreamingTimeoutError('No streaming data received within timeout'));
        }
      }, options.timeoutMs);
    });
  };

  const notifyChunk = () => {
    hasReceivedFirstChunk = true;
    // Clear timeout once first chunk is received
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const stop = () => {
    isActive = false;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    timeoutReject = null;
  };

  const hasReceivedChunk = () => hasReceivedFirstChunk;

  return {
    start,
    notifyChunk,
    stop,
    hasReceivedChunk,
  };
}

/**
 * Custom error class for streaming timeout
 */
export class StreamingTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreamingTimeoutError';
  }
}

/**
 * Wraps an async streaming operation with timeout and infinite retry logic.
 * 
 * @param operation - The async operation to execute (should call notifyChunk when data arrives)
 * @param options - Timeout options
 * @returns Promise that resolves when the operation completes successfully
 */
export async function withStreamingTimeout<T>(
  operation: (notifyChunk: () => void) => Promise<T>,
  options: StreamingTimeoutOptions
): Promise<T> {
  let attempt = 0;

  while (true) {
    if (options.signal?.aborted) {
      throw new Error('Aborted');
    }

    attempt++;
    const controller = createStreamingTimeoutController(options);
    
    try {
      // Race between the operation and the timeout
      const result = await Promise.race([
        operation(controller.notifyChunk),
        controller.start().then(() => {
          // This never resolves, only rejects on timeout
          throw new Error('Unreachable');
        }),
      ]);
      
      controller.stop();
      return result;
    } catch (error) {
      controller.stop();
      
      if (options.signal?.aborted) {
        throw error;
      }
      
      if (error instanceof StreamingTimeoutError) {
        // Timeout occurred, retry
        options.onRetry?.(attempt);
        continue;
      }
      
      // Other errors, propagate
      throw error;
    }
  }
}

/**
 * Helper to create a timeout promise that rejects after the specified time
 * if no first chunk is received.
 */
export function createFirstChunkTimeoutPromise(
  timeoutMs: number,
  signal?: AbortSignal
): {
  promise: Promise<never>;
  notifyChunk: () => void;
  cancel: () => void;
} {
  let timeoutId: NodeJS.Timeout | null = null;
  let hasReceivedChunk = false;
  let rejectFn: ((error: Error) => void) | null = null;

  const promise = new Promise<never>((_, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }

    rejectFn = reject;
    timeoutId = setTimeout(() => {
      if (!hasReceivedChunk) {
        reject(new StreamingTimeoutError('No streaming data received within timeout'));
      }
    }, timeoutMs);
  });

  const notifyChunk = () => {
    hasReceivedChunk = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    rejectFn = null;
  };

  return { promise, notifyChunk, cancel };
}
