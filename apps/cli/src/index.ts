import { createProgram } from "./program.js";

(async () => {
  try {
    const program = createProgram();
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})().catch(() => {
  process.exit(1);
});
