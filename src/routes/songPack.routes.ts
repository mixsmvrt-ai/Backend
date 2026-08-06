import { Router } from "express";
import * as controller from "../controllers/songPack.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePlusMembership } from "../middleware/membership.js";

export const songPackRouter = Router();
songPackRouter.use(requireAuth);
songPackRouter.get("/credits", controller.credits);
songPackRouter.get("/", controller.list);
songPackRouter.get("/:songPackId", controller.read);
songPackRouter.post("/", requirePlusMembership, controller.create);
songPackRouter.post("/:songPackId/regenerate", requirePlusMembership, controller.regeneratePack);
songPackRouter.post("/:songPackId/parts/:partId/regenerate", requirePlusMembership, controller.regeneratePart);