import { Command } from "commander";
import { authGuard } from "../../hooks/authGuard.js";
import { listDatabases } from "../../api/db.js";
import chalk from "chalk";
import Table from "cli-table3";

export function listDatabasesCommand(): Command {
    const command = new Command("list");

    command
        .description("List databases")
        .usage("mirrordb db list")
        .hook("preAction", authGuard)
        .action(async () => {
            console.log("Listing databases...")
            const db = await listDatabases();
            const table = new Table({
                head: [
                    chalk.gray("ID"),
                    chalk.gray("NAME"),
                    chalk.gray("ENGINE"),
                    chalk.gray("ENV"),
                    chalk.green("STATUS"),
                ],
            });

            db.forEach((db) => {
                table.push([
                    db.id,
                    db.name,
                    db.engine,
                    db.environment,
                    db.status,
                ]);
            });

            console.log(table.toString());
        });

    return command;
}