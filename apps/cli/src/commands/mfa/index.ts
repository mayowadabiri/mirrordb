import { Command } from "commander";
import { startMfaCommand } from "./start.js";
import { challengeMfaCommand } from "./challenge.js";

export function createMfaCommand(): Command {
    const command = new Command("mfa");

    command.description("Manage your Multi Factor Authentication");
    command.addCommand(startMfaCommand());
    command.addCommand(challengeMfaCommand());

    return command;
}
