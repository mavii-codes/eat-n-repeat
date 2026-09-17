import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { initializeDatabase } from "./database.js";
import authRouter from "./routes/auth.js";
import stockRouter from "./routes/stock.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/stock", stockRouter);

app.use((_req, res) => res.status(404).json({ message: "Route not found." }));

async function start() {
  await initializeDatabase();
  app.listen(config.port, () => {
    console.log(`Eat n' Repeat API listening on http://localhost:${config.port}`);
  });
}

start().catch((error: unknown) => {
  console.error("Unable to start API:", error);
  process.exit(1);
});
