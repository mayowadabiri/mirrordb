import { createProgram } from "./program.js";

try {
  const program = createProgram();
  program.parse(process.argv);
} catch (error) {
  process.exit(1);
}
