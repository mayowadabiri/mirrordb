import { Command } from "commander";
import { authGuard } from "../../hooks/authGuard.js";
import { mfaGuard } from "../../hooks/mfaGuard.js";
import { connectDatabase, getDatabase } from "../../api/db.js";
import { getErrorData } from "../../utils/errors.js";
import { readConfig, writeConfig } from "../../utils/config.js";
import chalk from "chalk";
import Table from "cli-table3";
import { DatabaseEngine, DatabaseStatus, DbCredentialsMethod, HostDbCredentials, UriDbCredentials } from "@mirrordb/types";
import prompts from "prompts";
import { format } from "date-fns";
import { getDbEngineDefaultPort, getDbEngineName, getDbEngineUriPrefix, getDbEngineValidUriPrefixes } from "../../utils/helpers.js";


const runReconfirmConnect = async () => {
    const reconfirm = await prompts({
        type: "confirm",
        name: "value",
        message: "Are you sure you want to connect to this database? (y/n)",
    })
    if (!reconfirm.value) {
        console.log(chalk.red("Operation cancelled"))
        process.exit(0)
    }
    return true
}


export async function promptAuthMethod(engine: DatabaseEngine) {
    const name = getDbEngineName(engine)
    const { method } = await prompts({
        type: "select",
        name: "method",
        message: `How do you want to connect to ${name}?`,
        choices: [
            { title: "Connection URI (recommended)", value: DbCredentialsMethod.URI },
            { title: "Host / Port / Username / Password", value: DbCredentialsMethod.HOST },
        ],
    });

    if (!method) {
        throw new Error("DB_CONNECT_CANCELLED");
    }

    return method;
}


export async function promptForDbCredentials(engine: DatabaseEngine): Promise<HostDbCredentials> {
    const defaultPort = getDbEngineDefaultPort(engine)
    const responses = await prompts(
        [
            {
                type: "text",
                name: "host",
                message: "Database host",
                validate: value => value ? true : "Host is required",
            },
            {
                type: "number",
                name: "port",
                message: "Database port",
                initial: defaultPort,
                validate: value =>
                    !value || (value > 0 && value < 65536) ? true : "Enter a valid port",
            },
            {
                type: "invisible",
                name: "username",
                message: "Database username",
                validate: value => value ? true : "Username is required",
            },
            {
                type: "invisible",
                name: "password",
                message: "Database password",
                validate: value => value ? true : "Password is required",
            },
            {
                type: "text",
                name: "database",
                message: "Database name",
                validate: value => value ? true : "Database name is required",
            },
        ],
        {
            onCancel: () => {
                throw new Error("DB_CONNECT_CANCELLED");
            },
        }
    );

    return {
        method: DbCredentialsMethod.HOST,
        ...responses
    };
}


export async function promptForUri(engine: DatabaseEngine): Promise<UriDbCredentials> {
    const name = getDbEngineName(engine)
    const prefix = getDbEngineUriPrefix(engine)
    const validPrefixes = getDbEngineValidUriPrefixes(engine)

    const responses = await prompts(
        [
            {
                type: "password",
                name: "uri",
                message: `${name} connection URI (e.g. ${prefix}user:pass@localhost:27017/mydb)`,
                validate: value =>
                    validPrefixes.some(p => value.startsWith(p))
                        ? true
                        : `Enter a valid ${name} URI`,
            },
        ],
        {
            onCancel: () => {
                throw new Error("DB_CONNECT_CANCELLED");
            },
        }
    );

    return {
        method: DbCredentialsMethod.URI,
        uri: responses.uri,
    };
}

export function connectDatabaseCommand(): Command {
    const command = new Command("connect");

    command
        .description("Connect to a database")
        .usage("mirrordb db connect")
        .argument("<database>", "Database name or ID")
        .hook("preAction", authGuard)
        .hook("preAction", mfaGuard)
        .action(async (database) => {
            try {
                console.log(chalk.blue("Fetching database information..."))
                const db = await getDatabase(database)

                console.log(chalk.blue("\n📊 Database Information:\n"))

                const table = new Table({
                    colWidths: [20, 50]
                });

                table.push(
                    [chalk.gray("Name"), chalk.white(db.name)],
                    [chalk.gray("ID"), chalk.white(db.id)],
                    [chalk.gray("Engine"), chalk.white(db.engine)],
                    [chalk.gray("Environment"), chalk.white(db.environment)],
                    [chalk.gray("Status"), chalk.green(db.status)],
                    [chalk.gray("Description"), chalk.white(db.description || "N/A")],
                    [chalk.gray("Created"), chalk.white(format(new Date(db.createdAt), "PPpp"))]
                );

                console.log(table.toString())


                if (db.status === DatabaseStatus.CONNECTED) {
                    console.log(chalk.red("Database is already connected"))
                    const reconfirm = await runReconfirmConnect()
                    if (!reconfirm) return
                }

                const method = await promptAuthMethod(db.engine)

                let credentials: HostDbCredentials | UriDbCredentials

                if (method === DbCredentialsMethod.URI) {
                    credentials = await promptForUri(db.engine)
                } else {
                    credentials = await promptForDbCredentials(db.engine)
                }

                console.log(chalk.green("Connecting to database..."))
                const result = await connectDatabase(db.id, credentials!)
                console.log(chalk.green("Database connected successfully"))
                console.log(chalk.green(`Active database set to "${result.name}".`))
                // Save database ID to config
                const config = readConfig();
                if (config) {
                    config.database = {
                        id: result.databaseId
                    };
                    writeConfig(config);
                }

            } catch (error) {
                const data = getErrorData(error)
                const code = (data?.details as { code?: string })?.code;
                if (code === "DATABASE_NOT_FOUND") {
                    console.log(chalk.red("No database found with that name or ID"))
                    console.log(chalk.red("Please check your database name or ID. Run `mirrordb db list` to list all databases"))
                    process.exit(0)
                }
                console.log(chalk.red("Database connection failed"))
                console.log(chalk.red("Please check your database credentials."))
                process.exit(0)
            }
        });

    return command;
}