import { Router } from "express";
import * as controller from "../controllers/audio.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const audioRouter = Router();
audioRouter.use(requireAuth);
audioRouter.post("/upload", controller.upload);
audioRouter.post("/process", controller.process);
audioRouter.get("/metadata/:audioId", controller.metadata);
audioRouter.get("/:audioId", controller.read);
audioRouter.delete("/:audioId", controller.remove);