
export interface ForkEventConfig {
    title: string;
    order: number;
}

export const FORK_EVENTS = {
    init: {
        title: "Initializing fork session",
        order: 1,
    },
    reading_source_info: {
        title: "Reading source database info",
        order: 2,
    },
    reading_target_info: {
        title: "Reading target database info",
        order: 3,
    },
    initializing_source_db: {
        title: "Initializing source database",
        order: 4,
    },
    initializing_target_db: {
        title: "Initializing target database",
        order: 5,
    },
    dumping_and_restoring: {
        title: "Dumping and restoring",
        order: 6,
    },
} as const satisfies Record<string, ForkEventConfig>;

export type ForkEventType = keyof typeof FORK_EVENTS;

/**
 * Get all fork events sorted by order
 */
export function getSortedForkEvents(): Array<{ key: ForkEventType; config: ForkEventConfig }> {
    return Object.entries(FORK_EVENTS)
        .map(([key, config]) => ({ key: key as ForkEventType, config }))
        .sort((a, b) => a.config.order - b.config.order);
}

/**
 * Check if an event is a known fork event
 */
export function isForkEvent(event: string): event is ForkEventType {
    return event in FORK_EVENTS;
}
