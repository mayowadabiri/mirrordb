import { Command } from "commander";
import open from "open";
import chalk from "chalk";
import { isAfter } from "date-fns";
import { createDeviceCode, pollDeviceStatus } from "../../api/auth.js";
import { readConfig, writeConfig } from "../../utils/config.js";
import { startMfaAction } from "../mfa/start.js";
import { getErrorData } from "../../utils/errors.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


export const createLoginAction = async (options: { browser: boolean }) => {
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

      if (result.status === "PENDING") {
        continue;
      }

      if (result.status === "APPROVED") {
        const { session, user, device, schemaVersion } = result;

        const existingConfig = readConfig();

        writeConfig({
          ...existingConfig,
          session,
          user,
          device,
          schemaVersion,
        });

        console.log(chalk.green("\nLogin successful 🎉"));

        // Check if user has MFA enabled
        if (!user.mfaEnabled) {
          console.log(chalk.yellow("\n⚠️  MFA is not enabled on your account."));
          console.log(chalk.blue("Starting MFA setup..."));

          try {
            const mfaResult = await startMfaAction(options);
            if (!mfaResult.success) {
              console.log(chalk.yellow("\nYou can enable MFA later by running: mirrordb mfa start"));
            }
          } catch (error: any) {
            console.error(chalk.red("\nMFA setup encountered an error:"));
            console.error(error);

            const data = getErrorData(error);
            const code = (data?.details as { code?: string })?.code;
            if (code === "MFA_ALREADY_ENABLED") {
              // This shouldn't happen, but just in case
              console.log(chalk.green("MFA is already enabled."));
            } else {
              const errorMessage = data?.message || error?.message || "Unknown error";
              console.log(chalk.red(`MFA setup failed: ${errorMessage}`));
              console.log(chalk.yellow("You can enable MFA later by running: mirrordb mfa start"));
            }
          }
        }

        return;
      }

      if (result.status === "REJECTED") {
        console.log(chalk.red("\nLogin was rejected."));
        process.exit(0);
      }

      if (result.status === "EXPIRED") {
        console.log(chalk.red("\nLogin expired. Please try again."));
        process.exit(0);
      }
    }
  } catch (error: any) {
    console.error(chalk.red(error.message ?? "Login failed."));
    process.exit(0);
  }
}

export function createLoginCommand(): Command {
  const command = new Command("login");

  command
    .description("Log in to your Mirror account")
    .option("--no-browser", "Do not open the browser automatically")
    .action(async (options) => {
      await createLoginAction(options);
    });

  return command;
}
