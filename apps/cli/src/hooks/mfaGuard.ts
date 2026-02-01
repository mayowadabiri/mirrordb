import chalk from "chalk";
import { getMfaSession } from "../api/mfa.js";
import { challengeMfaAction } from "../commands/mfa/challenge.js";
import { getErrorStatus } from "../utils/errors.js";

export const mfaGuard = async () => {
    try {
        await getMfaSession();
        return
    } catch (error) {
        const code = getErrorStatus(error)
        console.log(code)
        if (code && code <= 500) {
            await challengeMfaAction({ browser: true, shouldExit: false });
        } else {
            console.log(chalk.red("MFA not enabled"))
            process.exit(0)
        }
    }
}


