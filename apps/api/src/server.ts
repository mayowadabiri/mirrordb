import app from "./app";

const PORT = process.env.PORT

const startServer = async () => {
  try {
    await app.listen({
      port: Number(PORT),
      host: "0.0.0.0",
    });

    app.log.info(`Server listening on port ${PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

startServer();
