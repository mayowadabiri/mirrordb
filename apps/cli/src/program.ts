import { Command } from "commander";
import { createAuthCommand } from "./commands/auth/index.js";
import { createVersionCommand } from "./commands/version.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createMfaCommand } from "./commands/mfa/index.js";
import { createDbCommand } from "./commands/db/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PackageJson {
  version: string;
  name?: string;
  description?: string;
}

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "../package.json"), "utf-8")
) as PackageJson;



export function createProgram() {
  const program = new Command();

  program
    .name("mirror")
    .version(pkg.version, "-v, --version", "Output the version number")
    .helpOption("-h, --help", "Display help")
    .description(
      "Safely create temporary, isolated mirrors of production databases for debugging."
    );

  program.addCommand(createAuthCommand());
  program.addCommand(createVersionCommand());
  program.addCommand(createMfaCommand());
  program.addCommand(createDbCommand());

  return program;
}
