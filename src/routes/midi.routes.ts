import { Router } from "express";
import * as controller from "../controllers/midi.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const midiRouter = Router();
midiRouter.use(requireAuth);
midiRouter.post("/enhance", controller.enhance);
