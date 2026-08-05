import { Router } from "express";
import * as controller from "../controllers/pitch.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const pitchRouter = Router();
pitchRouter.use(requireAuth);
pitchRouter.post("/analyze", controller.analyze);
pitchRouter.get("/:id", controller.read);
pitchRouter.delete("/:id", controller.remove);