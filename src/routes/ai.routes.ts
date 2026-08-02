import { Router } from "express";
import * as controller from "../controllers/ai.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveMembership } from "../middleware/membership.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);
aiRouter.post("/generate", requireActiveMembership, controller.generate);
aiRouter.get("/history", controller.history);
aiRouter.get("/usage", controller.usage);
aiRouter.post("/retry", requireActiveMembership, controller.retry);
aiRouter.get("/admin/overview", controller.adminOverview);