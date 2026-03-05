/**
 * Common interface for all fork drivers (MongoDB, Postgres, etc.).
 * Each driver must implement fork() to perform the data copy
 * and cancel() for best-effort cleanup on cancellation.
 */
export interface IForkDriver {
    fork(): Promise<void>;
    cancel(): Promise<void>;
}
