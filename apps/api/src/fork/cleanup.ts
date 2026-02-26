// import { prisma } from "../lib/prisma";
// import PostgresDriver from "./stream/postgres";

// export const cleanup = async (session: { cloneId: string; forkedDatabaseId: string }) => {

//     const clonedDb = await prisma.databaseClone.findUnique({
//         where: {
//             id: session.cloneId,
//         },
//     });

//     const forkedDb = await prisma.forkedDatabase.findUnique({
//         where: {
//             id: session.forkedDatabaseId,
//         },
//     });
//     const sourceDb = await prisma.database.findUnique({
//         where: {
//             id: clonedDb?.sourceDatabaseId
//         },
//     });
//     const postgresDrive = new PostgresDriver(sourceDb!, forkedDb!, session.cloneId)

//     await postgresDrive.deleteDatabase()
//     await postgresDrive.deleteRole()


// }