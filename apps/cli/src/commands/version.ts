// src/commands/version.ts
import { readFileSync } from "fs";
import { resolve } from "path";
import { Command } from "commander";

import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function versionCommand() {
    try {
        const pkgPath = resolve(__dirname, "../../package.json");
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

        console.log(`mirrordb v${pkg.version}`);
        process.exit(0);
    } catch {
        console.error("mirrordb version unavailable");
        process.exit(1);
    }
}

// src/cli.ts

export const createVersionCommand = () => {
    const command = new Command("version");
    command.description("Show CLI version").action(versionCommand);
    return command;
}


