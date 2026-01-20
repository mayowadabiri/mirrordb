import chalk from "chalk";
import { Command } from "commander";
import { getMfaSetupStatus, startMfaSetup } from "../../api/mfa.js";
import open from "open";
import { isAfter } from "date-fns";

export function startMfaCommand(): Command {
  const command = new Command("start");

  command
    .description("Start MFA setup")
    .option("--no-browser", "Do not open the browser automatically")
    .action(async (options) => {
      console.log(chalk.green("Starting MFA setup..."));
      const result = await startMfaSetup();
      console.log(result);

      if (options.browser) {
        console.log(
          chalk.green("Please open the following URL in your browser: "),
        );
        try {
          console.log(chalk.blue(result.setupUrl));
          open(result.setupUrl);
        } catch (error) {
          console.log(chalk.red("Failed to open browser"));
        }
      }

      console.log(chalk.yellow("Waiting for MFA setup to complete..."));

      while (true) {
        await new Promise((r) => setTimeout(r, 5000));
        if (isAfter(new Date(), new Date(result.expiresIn))) {
          console.log(chalk.red("MFA setup session expired"));
          process.exit(1);
        }
        const status = await getMfaSetupStatus(result.setupId);
        if (status.used) {
          console.log(chalk.green("MFA setup completed successfully ✅"));
          process.exit(0);
        }
        if (status.expired) {
          console.log(chalk.red("MFA setup session expired"));
          process.exit(1);
        }
      }
    });

  return command;
}
