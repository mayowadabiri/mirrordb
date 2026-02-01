import chalk from "chalk";
import { Command } from "commander";
import { getMfaSetupStatus, startMfaSetup } from "../../api/mfa.js";
import open from "open";
import { isAfter } from "date-fns";
import { getErrorData, } from "../../utils/errors.js";
import { authGuard } from "../../hooks/authGuard.js";

export const startMfaAction = async (options: { browser: boolean }): Promise<{ success: boolean; message: string }> => {
  const result = await startMfaSetup();

  if (!options.browser) {
    console.log(
      chalk.green("Please open the following URL in your browser: "),
    );
  }

  open(result.setupUrl);

  console.log(chalk.yellow("Waiting for MFA setup to complete..."));

  while (true) {
    await new Promise((r) => setTimeout(r, 5000));
    if (isAfter(new Date(), new Date(result.expiresIn))) {
      console.log(chalk.red("MFA setup session expired"));
      return { success: false, message: "MFA setup session expired" };
    }
    const status = await getMfaSetupStatus(result.setupId);
    if (status.used) {
      console.log(chalk.green("MFA setup completed successfully ✅"));
      return { success: true, message: "MFA setup completed successfully" };
    }
    if (status.expired) {
      console.log(chalk.red("MFA setup session expired"));
      return { success: false, message: "MFA setup session expired" };
    }
  }
}

export function startMfaCommand(): Command {
  const command = new Command("start");

  command
    .description("Start MFA setup")
    .option("--no-browser", "Do not open the browser automatically")
    .hook("preAction", authGuard)
    .action(async (options: { browser: boolean }) => {
      try {

        console.log(chalk.green("Starting MFA setup..."));
        const result = await startMfaAction(options);
        process.exit(result.success ? 0 : 1);
      } catch (error) {
        const data = getErrorData(error);
        const code = (data?.details as { code?: string })?.code;
        if (code === "MFA_ALREADY_ENABLED") {
          console.log(chalk.red("You have already enabled MFA"));
        } else {
          console.log(chalk.red(data?.message));
        }
        process.exit(0);
      }
    });

  return command;
}
