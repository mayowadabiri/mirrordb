import { readSourceDatabaseInfo, readTargetDatabaseInfo } from "./actions";
import PostgresDriver from "./postgres";

type OrchestratorCtx = {
    sessionData: {
        cloneId: string;
        forkedDatabaseId: string;
        sessionId: string;
    };
    emit: (event: string, payload: unknown) => void;
    isSessionAlive: () => boolean;
};



export const forkOrchestrator = async (ctx: OrchestratorCtx) => {
    const { sessionData, emit, isSessionAlive } = ctx;

    const guard = () => {
        if (!isSessionAlive()) {
            ctx.emit("cancelled", { reason: "session_lost" });
            throw new Error("SESSION_LOST");
        }
    };

    // Read the clone database info
    emit("progress", { message: "Reading source database info..." });
    const sourceDatabase = await readSourceDatabaseInfo(sessionData.cloneId);
    emit("reading_source_info", null);
    guard();

    // Read target database info
    emit("progress", { message: "Reading target database info..." });
    const targetDatabase = await readTargetDatabaseInfo(sessionData.forkedDatabaseId);
    emit("reading_target_info", null);
    guard();

    // Initialize source database
    emit("progress", { message: "Initializing source database..." });
    const driver = new PostgresDriver(sourceDatabase, targetDatabase, sessionData.cloneId);
    await driver.initializeSourceDb();
    emit("initializing_source_db", null);
    guard();

    // Initialize target database
    emit("progress", { message: "Initializing target database..." });
    await driver.initializeTargetDb();
    emit("initializing_target_db", null);
    guard();

    // Dump and restore
    emit("progress", { message: "Dumping and restoring database..." });
    await driver.dumpAndRestore();
    emit("dumping_and_restoring", null);
    guard();

    // Signal completion to close the SSE connection
    emit("__END__", { success: true });
}