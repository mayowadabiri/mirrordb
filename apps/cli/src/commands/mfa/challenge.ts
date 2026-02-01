import { Command } from "commander";
import { authGuard } from "../../hooks/authGuard.js";
import chalk from "chalk";
import { challengeMfa, getMfaChallengeStatus } from "../../api/mfa.js";
import open from "open";
import { isAfter } from "date-fns";


export const challengeMfaAction = async (options: { browser: boolean; shouldExit?: boolean }) => {
    const shouldExit = options.shouldExit ?? true;

    const challenge = await challengeMfa();

    if (!options.browser) {
        console.log(chalk.yellow(`Please open the following URL in your browser: ${challenge.verification_url}`));
    }

    open(challenge.verification_url);
    while (true) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        if (isAfter(new Date(), new Date(challenge.expiresAt))) {
            console.log(chalk.red("Challenge expired"));
            if (shouldExit) {
                process.exit(0);
            } else {
                throw new Error("MFA_CHALLENGE_EXPIRED");
            }
        }
        const response = await getMfaChallengeStatus(challenge.challengeId);
        const status = response.status;

        if (status === "VERIFIED") {
            console.log(chalk.green("Challenge verified successfully ✅"));
            if (shouldExit) {
                process.exit(0);
            } else {
                return;
            }
        }
        if (status === "EXPIRED") {
            console.log(chalk.red("Challenge expired"));
            if (shouldExit) {
                process.exit(0);
            } else {
                throw new Error("MFA_CHALLENGE_EXPIRED");
            }
        }
    }
}

export function challengeMfaCommand(): Command {
    const command = new Command("challenge");

    command
        .description("Challenge MFA setup")
        .option("--no-browser", "Do not open the browser automatically")
        .hook("preAction", authGuard)
        .action(async (options: { browser: boolean; shouldExit?: boolean }) => {
            try {

                await challengeMfaAction(options)

            } catch {
                console.log(chalk.red("Failed to start MFA setup"));
                process.exit(0);
            }
        });

    return command;
}