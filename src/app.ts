import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { adminRouter } from "./routes/admin.routes.js";
import { generationRouter } from "./routes/generation.routes.js";
import { projectRouter } from "./routes/project.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { accountRouter } from "./routes/account.routes.js";
import { workspaceRouter } from "./routes/workspace.routes.js";
import { billingRouter } from "./routes/billing.routes.js";
import { knowledgeRouter } from "./routes/knowledge.routes.js";
import { artistRouter } from "./routes/artist.routes.js";
import { audioRouter } from "./routes/audio.routes.js";
import { pitchRouter } from "./routes/pitch.routes.js";
import { musicRouter } from "./routes/music.routes.js";
import { aiRouter } from "./routes/ai.routes.js";
import { songPackRouter } from "./routes/songPack.routes.js";
import { midiRouter } from "./routes/midi.routes.js";
import { referralRouter } from "./routes/referral.routes.js";
import { musicBrainService } from "./services/musicBrainService.js";
import { referenceLibraryService } from "./services/referenceLibrary/service.js";

export const app = express();
void musicBrainService.preload();
void referenceLibraryService.preload();
app.use(helmet());
const allowedCorsOrigins = new Set([
	...env.CORS_ALLOWED_ORIGINS.split(","),
	env.FRONTEND_URL,
	"https://www.getmidiflow.com",
	"https://getmidiflow.com",
].map((origin) => origin.trim().replace(/\/$/, "").toLowerCase()).filter(Boolean));
app.use(cors({
	origin: (requestOrigin, callback) => {
		if (!requestOrigin || allowedCorsOrigins.has(requestOrigin.trim().replace(/\/$/, "").toLowerCase())) {
			callback(null, true);
			return;
		}
		callback(new Error("Origin is not allowed by CORS"));
	},
	credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ redact: ["req.headers.authorization", "req.headers.cookie"] }));
app.get("/", (_request, response) => response.json({ service: "midiflow-backend", status: "ok" }));
app.get("/health", (_request, response) => response.json({ status: "ok" }));
app.get("/ready", (_request, response) => response.json({ status: "ready" }));
app.use("/api/v1/generations", generationRouter);
app.use("/api/v1/generate", generationRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/account", accountRouter);
app.use("/api/v1/workspace", workspaceRouter);
app.use("/api/v1/knowledge", knowledgeRouter);
app.use("/api/v1/artist", artistRouter);
app.use("/api/v1/audio", audioRouter);
app.use("/api/v1/pitch", pitchRouter);
app.use("/api/v1/music", musicRouter);
app.use("/api/v1/ai", aiRouter);
app.use("/api/v1/song-packs", songPackRouter);
app.use("/api/midi", midiRouter);
app.use("/api/v1", referralRouter);
app.use("/api/v1", billingRouter);
app.use("/api/v1/admin", adminRouter);
app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => { console.error(error); response.status(500).json({ error: "Unexpected server error" }); });
