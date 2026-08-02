import { Router } from "express";
import * as controller from "../controllers/musicInterpretation.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const musicRouter = Router();
musicRouter.use(requireAuth);
musicRouter.post("/interpret", controller.interpret);
musicRouter.get("/interpret/:id", controller.read);
musicRouter.delete("/interpret/:id", controller.remove);