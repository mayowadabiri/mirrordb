import { Command } from "commander";
import { authGuard } from "../../hooks/authGuard.js";
import { mfaGuard } from "../../hooks/mfaGuard.js";
import { readConfig } from "../../utils/config.js";
import { cancelFork, forkDatabase, getDatabase, streamFork, tunnelCloneDb } from "../../api/db.js";
import chalk from "chalk";
import { Database, DatabaseStatus } from "@mirrordb/types";
import prompts from "prompts";
import Table from "cli-table3";
import { format } from "date-fns";
import { getErrorData } from "../../utils/errors.js";

async function showForkIntent(db: Database): Promise<boolean> {
    console.log(chalk.yellow("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    console.log(chalk.yellow.bold("  You are about to FORK a database."));
    console.log(chalk.yellow("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

    console.log(chalk.white("Source database:\n"));

    const table = new Table({
        colWidths: [20, 50],
    });

    table.push(
        [chalk.gray("Name"), chalk.white(db.name)],
        [chalk.gray("ID"), chalk.white(db.id)],
        [chalk.gray("Engine"), chalk.white(db.engine)],
        [chalk.gray("Environment"), chalk.white(db.environment)],
        [chalk.gray("Status"), chalk.green(db.status)],
        [chalk.gray("Description"), chalk.white(db.description || "N/A")],
        [
            chalk.gray("Created"),
            chalk.white(format(new Date(db.createdAt), "PPpp")),
        ],
    );

    console.log(table.toString());

    console.log(chalk.white("\nWhat this means:"));
    console.log(chalk.gray("  • A private copy of the database will be created"));
    console.log(chalk.gray("  • Data will be READ from the source database"));
    console.log(chalk.gray("  • The source database will NOT be modified"));
    console.log(
        chalk.gray("  • The forked database will be isolated and temporary"),
    );

    console.log(chalk.yellow("\nThis action is audited.\n"));

    const response = await prompts({
        type: "confirm",
        name: "confirmed",
        message: "Do you want to continue?",
        initial: false,
    });

    return response.confirmed;
}

function resolveDatabaseId(database?: string): string {
    if (database) return database;

    const config = readConfig();
    if (!config?.database?.id) {
        console.log(chalk.red("No active database found."));
        console.log(
            chalk.red(
                "Either provide a database name/ID or connect to a database first.",
            ),
        );
        console.log(chalk.gray("Run: mirror db connect <database>"));
        process.exit(0);
    }

    return config.database.id;
}

async function fetchAndValidateDatabase(databaseId: string): Promise<Database> {
    console.log(chalk.blue("Fetching database information..."));
    const db = await getDatabase(databaseId);

    if (db.status !== DatabaseStatus.CONNECTED) {
        console.log(chalk.red("Database is not connected"));
        console.log(
            chalk.gray(
                "Run: mirror db connect <database> or add --auto-connect flag to this command",
            ),
        );
        process.exit(0);
    }

    return db;
}

async function confirmAndStartFork(db: Database): Promise<string> {
    const confirmed = await showForkIntent(db);

    if (!confirmed) {
        console.log(chalk.yellow("\nFork cancelled."));
        process.exit(0);
    }

    console.log(chalk.green(`\nForking database: ${db.name}...\n`));
    const result = await forkDatabase(db.id);

    console.log(chalk.gray("Waiting for fork process...\n"));
    return result.cloneId;
}

function createCancelHandler(cloneId: string) {
    const handler = async () => {
        console.log(chalk.yellow("\nCancellation requested..."));
        try {
            await cancelFork(cloneId);
        } catch {
            console.log(chalk.red("Failed to send cancellation request."));
        }
        process.exit(0);
    };

    process.on("SIGINT", handler);
    process.on("SIGTERM", handler);
    process.on("SIGHUP", handler);

    return handler;
}

function removeCancelHandler(handler: () => Promise<void>) {
    process.removeListener("SIGINT", handler);
    process.removeListener("SIGTERM", handler);
    process.removeListener("SIGHUP", handler);
}

async function waitForForkCompletion(cloneId: string): Promise<string | null> {
    let finalStatus: string | null = null;

    await streamFork(cloneId, (_event, payload) => {
        if (!payload?.status) return;

        finalStatus = payload.status;
        switch (payload.status) {
            case "PENDING":
                console.log(chalk.gray("Queued..."));
                break;
            case "RUNNING":
                console.log(chalk.blue("Fork running..."));
                break;
            case "COMPLETED":
                console.log(chalk.green("\nFork completed successfully."));
                break;
            case "FAILED":
                console.log(
                    chalk.red(
                        `\nFork failed: ${payload.errorMessage ?? "Unknown error"}`
                    )
                );
                break;
            case "CANCELLED":
                console.log(chalk.yellow("\nFork cancelled."));
                break;
        }
    });

    return finalStatus;
}

async function startTunnel(cloneId: string) {
    const abortController = new AbortController();

    await tunnelCloneDb(cloneId, abortController.signal, (event: string, payload: { url: string; message: string }) => {
        if (event === "tunnel:ready") {
            console.log(chalk.green("\n✓ Tunnel ready\n"));
            console.log(chalk.white("Connect using:"));
            console.log(chalk.cyan(payload.url));
            console.log(chalk.gray("\nPress Ctrl+C to stop the tunnel.\n"));
        } else if (event === "tunnel:log") {
            process.stdout.write(payload.message);
        } else if (event === "tunnel:error") {
            console.log(chalk.red(payload.message));
        } else if (event === "tunnel:closed") {
            console.log(chalk.yellow("\nTunnel closed."));
            process.exit(0);
        }
    });
}

function handleForkError(error: unknown) {
    const data = getErrorData(error);
    const code = data?.details?.code;
    if (code === "DATABASE_NOT_FOUND") {
        console.log(chalk.red("Database not found"));
    }
    console.log(chalk.red("Failed to fork database"));
    process.exit(0);
}

export function forkDatabaseCommand(): Command {
    const command = new Command("fork");

    command
        .description("Fork a database")
        .usage("mirrordb db fork")
        .argument("[database]", "Database name or ID")
        .hook("preAction", authGuard)
        .hook("preAction", mfaGuard)
        .action(async (database) => {
            try {
                const databaseId = resolveDatabaseId(database);
                const db = await fetchAndValidateDatabase(databaseId);
                const cloneId = await confirmAndStartFork(db);

                const cancelHandler = createCancelHandler(cloneId);

                const finalStatus = await waitForForkCompletion(cloneId);

                if (finalStatus !== "COMPLETED") {
                    process.exit(0);
                }

                try {
                    await startTunnel(cloneId);
                } finally {
                    removeCancelHandler(cancelHandler);
                }

                console.log(chalk.yellow("\nTunnel stopped."));
                process.exit(0);
            } catch (error) {
                handleForkError(error);
            }
        });

    return command;
}
