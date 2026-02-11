import logUpdate from "log-update";
import chalk from "chalk";
import {
    ForkEventType,
    getSortedForkEvents,
    isForkEvent,
} from "./forkEvents.js";

interface TaskStatus {
    key: ForkEventType;
    title: string;
    completed: boolean;
}

/**
 * Fork progress manager that handles event-to-task mapping
 * Displays all tasks upfront and updates them as events arrive
 */
export class ForkProgressManager {
    private tasks: TaskStatus[] = [];
    private completedEvents = new Set<string>();

    constructor() {
        // Initialize all tasks from events configuration
        const sortedEvents = getSortedForkEvents();
        this.tasks = sortedEvents.map(({ key, config }) => ({
            key,
            title: config.title,
            completed: false,
        }));
    }

    /**
     * Start displaying the progress tasks
     */
    start(): void {
        this.render();
    }

    /**
     * Update task status based on incoming event
     */
    handleEvent(event: string, payload: unknown): void {
        // Skip if already completed
        if (this.completedEvents.has(event)) {
            return;
        }

        // Handle known fork events
        if (isForkEvent(event)) {
            this.completeTask(event);
            this.completedEvents.add(event);
            this.render();
        }
        // Handle progress events (dynamic messages)
        else if (event === "progress") {
            if (payload && typeof payload === "object" && "message" in payload) {
                // Temporarily show progress message
                const message = (payload as { message: string }).message;
                this.renderWithMessage(message);
            }
        }
        // Handle completion event
        else if (event === "__END__") {
            this.complete();
        }
        // Unknown events - log them separately after clearing the task list
        else if (event !== "__END__") {
            logUpdate.clear();
            console.log(chalk.dim(`[${event}]:`, payload));
            this.render();
        }
    }

    /**
     * Mark a specific task as complete
     */
    private completeTask(eventKey: ForkEventType): void {
        const task = this.tasks.find((t) => t.key === eventKey);
        if (task) {
            task.completed = true;
        }
    }

    /**
     * Complete all remaining tasks and finalize
     */
    complete(): void {
        // Complete any remaining tasks
        this.tasks.forEach((task) => {
            task.completed = true;
        });
        this.render();
        logUpdate.done();
    }

    /**
     * Render the task list
     */
    private render(): void {
        const output = this.tasks.map((task) => {
            if (task.completed) {
                return chalk.green(`✓ ${task.title}`);
            } else {
                return chalk.gray(`○ ${task.title}`);
            }
        }).join("\n");

        logUpdate(output);
    }

    /**
     * Render with an additional progress message
     */
    private renderWithMessage(message: string): void {
        const output = this.tasks.map((task) => {
            if (task.completed) {
                return chalk.green(`✓ ${task.title}`);
            } else {
                return chalk.gray(`○ ${task.title}`);
            }
        }).join("\n");

        logUpdate(output + "\n" + chalk.dim(`  ${message}`));
    }

    /**
     * Handle errors during fork process
     */
    handleError(error: unknown): void {
        logUpdate.clear();
        console.error(chalk.red("\nFork failed:"), error);
    }
}
