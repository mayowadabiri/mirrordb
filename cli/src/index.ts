import { createProgram } from "./program.js";

try {
  const program = createProgram();
  program.parse(process.argv);
} catch (error) {
  console.error("Unexpected error:", error);
  process.exit(1);
}
