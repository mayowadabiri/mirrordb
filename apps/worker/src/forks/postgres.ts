import { prisma } from "@mirrordb/database";

export const postgresFork = async (cloneId: string) => {


    console.log(`Starting fork for cloneId: ${cloneId}`);

    const cloneDb = await prisma.databaseClone.findUnique({
        where: {
            id: cloneId
        },
        include: {
            sourceDatabase: true,
            forkedDatabase: true
        }
    });


    console.log(cloneDb)

}