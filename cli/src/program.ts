import { Command } from "commander";

export function createProgram() {
  const program = new Command();

  program
    .name("mirrordb")
    .description(
      "Safely create temporary, isolated mirrors of production databases for debugging."
    )
    .version("0.1.0");

  return program;
}
