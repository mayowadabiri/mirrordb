import { Command } from "commander";
import { addDbCommand } from "./add.js";
import { listDatabasesCommand } from "./list.js";
import { connectDatabaseCommand } from "./connect.js";
import { forkDatabaseCommand } from "./fork.js";

export function createDbCommand(): Command {
    const command = new Command("db");

    command.description("Manage database with MirrorDB");

    command.addCommand(addDbCommand());
    command.addCommand(listDatabasesCommand());
    command.addCommand(connectDatabaseCommand());
    command.addCommand(forkDatabaseCommand());

    return command;
}
