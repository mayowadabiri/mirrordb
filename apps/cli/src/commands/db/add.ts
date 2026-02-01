import { Command } from "commander";
import { authGuard } from "../../hooks/authGuard.js";
import { mfaGuard } from "../../hooks/mfaGuard.js";
import prompts from "prompts";
import chalk from "chalk";
import { createDb } from "../../api/db.js";

import {
    uniqueNamesGenerator,
    adjectives,
    colors,
    animals,
} from "unique-names-generator";
import { normalizeEnum } from "../../utils/helpers.js";
import { AddDbPayload } from "@mirrordb/types";

function generateDbName() {
    const name = uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
        style: "capital",
        separator: "",
    });

    return name;
}


export async function runDbAddInteractive(options: {
    name?: string;
    engine?: string;
    environment?: string;
    description?: string;
}) {
    const questions = [
        !options.engine && {
            type: "select" as const,
            name: "engine",
            message: "Select database type",
            choices: [
                { title: "PostgreSQL", value: "POSTGRES" },
                { title: "MySQL", value: "MYSQL" },
                { title: "MongoDB", value: "MONGODB" },
            ],
        },
        !options.environment && {
            type: "select" as const,
            name: "environment",
            message: "Select environment",
            choices: [
                { title: "Production", value: "PRODUCTION" },
                { title: "Staging", value: "STAGING" },
                { title: "Development", value: "DEVELOPMENT" },
            ],
        },
        !options.name && {
            type: "text" as const,
            name: "name",
            message: "Database name (MirrorDB identifier)",
            initial: generateDbName(),
            validate: (value: string) =>
                value.length < 2 ? "Name must be at least 2 characters" : true,
        },
        !options.description && {
            type: "text" as const,
            name: "description",
            message: "Description (optional)",
            initial: "",
        },
        {
            type: "confirm" as const,
            name: "confirm",
            message: "Add this database?",
            initial: true,
        },
    ].filter(Boolean) as prompts.PromptObject<string>[];

    const answers = await prompts(questions, {
        onCancel() {
            console.log(chalk.yellow("Cancelled."));
            process.exit(0);
        },
    });

    if (!answers.confirm) {
        console.log(chalk.yellow("Cancelled."));
        process.exit(0);
    }

    return {
        engine: normalizeEnum(options.engine ?? (answers.engine as string)),
        environment: normalizeEnum(options.environment ?? (answers.environment as string)),
        name: options.name ?? (answers.name as string),
        description: options.description ?? (answers.description as string),
    };
}


export function addDbCommand(): Command {
    const command = new Command("add");

    command
        .description("Add a database")
        .usage("mirrordb db add")
        .option("-n --name <name>", "Database name")
        .option("-e --engine <engine>", "Database engine")
        .option("--environment <environment>", "Database environment")
        .option("-d --description <description>", "Database description")
        .hook("preAction", authGuard)
        .hook("preAction", mfaGuard)
        .action(async (options: { name?: string; engine?: string; environment?: string; description?: string }) => {
            const db = await runDbAddInteractive(options);
            console.log(db)
            console.log(chalk.blue("Creating database..."));
            const result = await createDb(db as AddDbPayload);
            console.log(chalk.green("Database created successfully"));
            console.log(chalk.green(`Run 'mirrordb connect ${result.name}' to connect to your database`))
        });

    return command;
}