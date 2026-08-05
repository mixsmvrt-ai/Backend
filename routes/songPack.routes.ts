import { Router } from "express";
import * as controller from "../controllers/songPack.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveMembership } from "../middleware/membership.js";

export const songPackRouter = Router();
songPackRouter.use(requireAuth);
songPackRouter.get("/credits", controller.credits);
songPackRouter.get("/", controller.list);
songPackRouter.get("/:songPackId", controller.read);
songPackRouter.post("/", requireActiveMembership, controller.create);
songPackRouter.post("/:songPackId/regenerate", requireActiveMembership, controller.regeneratePack);
songPackRouter.post("/:songPackId/parts/:partId/regenerate", requireActiveMembership, controller.regeneratePart);