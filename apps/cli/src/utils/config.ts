import path from "node:path";
import { MirrorConfig } from "@mirrordb/types";
import { CONFIG_FILE } from "./path.js";
import fs from "node:fs";


export const readConfig = (): MirrorConfig | null => {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
};

export const writeConfig = (config: MirrorConfig) => {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
};