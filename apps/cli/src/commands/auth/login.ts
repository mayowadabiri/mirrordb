import { Command } from "commander";
import open from "open";
import chalk from "chalk";
import { isAfter } from "date-fns";
import { createDeviceCode, pollDeviceStatus } from "../../api/auth.js";
import { readConfig, writeConfig } from "../../utils/config.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createLoginCommand(): Command {
  const command = new Command("login");

  command
    .description("Log in to your Mirror account")
    .option("--no-browser", "Do not open the browser automatically")
    .action(async (options) => {
      try {
        console.log(chalk.green("Starting login process..."));

        const config = readConfig();

        if (
          config &&
          isAfter(new Date(config?.session?.accessTokenExpiresAt), new Date())
        ) {
          console.log(chalk.yellow("You are already logged in."));
          return;
        }

        const device = await createDeviceCode();

        console.log(chalk.blue("\nAuthenticate in your browser:"));

        console.log(chalk.yellow("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(chalk.yellow.bold("  Your verification code:"));
        console.log(chalk.green.bold(`\n  ${device.userCode}\n`));
        console.log(chalk.yellow("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

        if (options.browser) {
          try {
            open(device.verificationUrl);
          } catch {
            console.log(
              chalk.red(
                `Failed to open browser automatically. Visit ${device.verificationUrl}`,
              ),
            );
          }
        }

        console.log(chalk.gray("\nWaiting for authentication..."));

        // 🔁 Polling loop
        while (true) {
          if (isAfter(new Date(), new Date(device?.expiresAt))) {
            console.log(chalk.red("\nLogin expired. Please try again."));
            process.exit(1);
          }

          await sleep(3000);

          const result = await pollDeviceStatus(device.deviceCode);
          console.log(result);

          if (result.status === "PENDING") {
            continue;
          }

          if (result.status === "APPROVED") {
            const { session, user, device, schemaVersion } = result;
            writeConfig({
              session,
              user,
              device,
              schemaVersion,
            });

            console.log(chalk.green("\nLogin successful 🎉"));
            return;
          }

          if (result.status === "REJECTED") {
            console.log(chalk.red("\nLogin was rejected."));
            process.exit(1);
          }

          if (result.status === "EXPIRED") {
            console.log(chalk.red("\nLogin expired. Please try again."));
            process.exit(1);
          }
        }
      } catch (error: any) {
        console.log(error);
        console.error(chalk.red(error.message ?? "Login failed."));
        process.exit(1);
      }
    });

  return command;
}
