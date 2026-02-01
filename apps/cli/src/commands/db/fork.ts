import { Command } from "commander";
import { authGuard } from "../../hooks/authGuard.js";
import { mfaGuard } from "../../hooks/mfaGuard.js";
import { readConfig } from "../../utils/config.js";
import { getDatabase } from "../../api/db.js";
import chalk from "chalk";
import { Database, DatabaseStatus } from "@mirrordb/types";
import prompts from "prompts";
import Table from "cli-table3";
import { format } from "date-fns";

async function showForkIntent(db: Database): Promise<boolean> {
    console.log(chalk.yellow("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    console.log(chalk.yellow.bold("  You are about to FORK a database."));
    console.log(chalk.yellow("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

    console.log(chalk.white("Source database:\n"));

    const table = new Table({
        colWidths: [20, 50]
    });

    table.push(
        [chalk.gray("Name"), chalk.white(db.name)],
        [chalk.gray("ID"), chalk.white(db.id)],
        [chalk.gray("Engine"), chalk.white(db.engine)],
        [chalk.gray("Environment"), chalk.white(db.environment)],
        [chalk.gray("Status"), chalk.green(db.status)],
        [chalk.gray("Description"), chalk.white(db.description || "N/A")],
        [chalk.gray("Created"), chalk.white(format(new Date(db.createdAt), "PPpp"))]
    );

    console.log(table.toString());

    console.log(chalk.white("\nWhat this means:"));
    console.log(chalk.gray("  • A private copy of the database will be created"));
    console.log(chalk.gray("  • Data will be READ from the source database"));
    console.log(chalk.gray("  • The source database will NOT be modified"));
    console.log(chalk.gray("  • The forked database will be isolated and temporary"));

    console.log(chalk.yellow("\nThis action is audited.\n"));

    const response = await prompts({
        type: "confirm",
        name: "confirmed",
        message: "Do you want to continue?",
        initial: false,
    });

    return response.confirmed;
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
                let databaseId = database;

                if (!database) {
                    const config = readConfig();
                    if (!config?.database?.id) {
                        console.log(chalk.red("No active database found."));
                        console.log(chalk.gray("Either provide a database name/ID or connect to a database first."));
                        console.log(chalk.gray("Run: mirror db connect <database>"));
                        process.exit(0);
                    }
                    databaseId = config.database.id;
                }

                console.log(chalk.blue("Fetching database information..."));
                const db = await getDatabase(databaseId);


                if (db.status !== DatabaseStatus.CONNECTED) {
                    console.log(chalk.red("Database is not connected"))
                    console.log(chalk.gray("Run: mirror db connect <database> or add --auto-connect flag to this command"))
                    process.exit(0)
                }

                // Show fork intent and get confirmation
                const confirmed = await showForkIntent(db);

                if (!confirmed) {
                    console.log(chalk.yellow("\nFork cancelled."));
                    process.exit(0);
                }

                console.log(chalk.green(`\nForking database: ${db.name}...`));
                // TODO: Implement fork logic

            } catch (error) {
                console.log(chalk.red("Failed to fork database"));
                console.log(error);
                process.exit(1);
            }
        })

    return command;
}