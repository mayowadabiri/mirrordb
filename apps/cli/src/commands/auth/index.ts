import { Command } from "commander";
import { createLoginCommand } from "./login.js";

export function createAuthCommand(): Command {
  const command = new Command("auth");

  command.description("Manage authentication with MirrorDB");

  command.addCommand(createLoginCommand());

  return command;
}
