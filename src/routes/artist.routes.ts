import { Router } from "express";
import { z } from "zod";
import { artistInspirationService, ArtistOriginalityViolationError, publicArtistInspiredContext } from "../services/artistInspiration/index.js";
import { musicBrainArtistCatalog } from "../services/musicBrain/artists.js";

export const artistRouter = Router();

artistRouter.post("/analyze", async (request, response, next) => {
  try {
    const { prompt } = z.object({ prompt: z.string().trim().min(3).max(1000) }).parse(request.body);
    const analysis = await artistInspirationService.analyze({ prompt });
    response.json({ data: publicArtistInspiredContext(analysis) });
  } catch (error) {
    if (error instanceof ArtistOriginalityViolationError) {
      response.status(422).json({ error: error.message });
      return;
    }
    next(error);
  }
});

artistRouter.get("/profiles", async (_request, response, next) => {
  try {
    response.json({ data: await musicBrainArtistCatalog.profiles() });
  } catch (error) {
    next(error);
  }
});

artistRouter.get("/profile/:name", async (request, response, next) => {
  try {
    const profile = await musicBrainArtistCatalog.findByName(request.params.name);
    if (!profile) {
      response.status(404).json({ error: "Artist profile not found" });
      return;
    }
    response.json({ data: profile });
  } catch (error) {
    next(error);
  }
});

artistRouter.get("/search", async (request, response, next) => {
  try {
    const { query } = z.object({ query: z.string().trim().min(1).max(120) }).parse(request.query);
    response.json({ data: await musicBrainArtistCatalog.search(query) });
  } catch (error) {
    next(error);
  }
});