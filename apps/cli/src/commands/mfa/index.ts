import { Command } from "commander";
import { startMfaCommand } from "./start.js";

export function createMfaCommand(): Command {
    const command = new Command("mfa");

    command.description("Manage your Multi Factor Authentication");
    command.addCommand(startMfaCommand());

    return command;
}
