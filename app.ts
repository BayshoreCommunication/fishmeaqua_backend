import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import routes from "./routes/index";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// Keep the root and common docs aliases friendly on local Node and Vercel.
app.get("/", (_req, res) => res.redirect(302, "/api-docs"));
app.get(["/api/docs", "/docs"], (_req, res) =>
  res.redirect(302, "/api-docs")
);

// Mounted before helmet so its default CSP doesn't block Swagger UI's inline assets.
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));

app.use(helmet());
app.use(
  cors({
    origin: env.isProduction ? env.clientUrls : true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!env.isProduction) {
  app.use(morgan("dev"));
}

app.use("/api/v1", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
