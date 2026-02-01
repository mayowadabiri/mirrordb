import { readConfig } from "../utils/config.js";
import chalk from "chalk";
import { verifySession } from "../api/auth.js";

export const authGuard = async () => {
    try {
        const config = readConfig();
        if (!config?.session) {
            console.log(chalk.yellow("You are not logged in."));
            console.log(chalk.gray("Run: mirror auth login"));
            process.exit(0);
        }

        await verifySession();
    } catch {
        console.log(chalk.yellow("You are not logged in."));
        console.log(chalk.gray("Run: mirror auth login"));
        process.exit(0);
    }
}


