import { Router } from "express";
import { z } from "zod";
import {
  chordsKnowledgeService,
  instrumentsKnowledgeService,
  knowledgeService,
  pluginsKnowledgeService,
  recommendationKnowledgeService,
  searchKnowledgeService,
} from "../services/musicKnowledge/index.js";

export const knowledgeRouter = Router();

const recommendationQuery = z.object({
  genre: z.string().trim().min(1).optional(),
  mood: z.string().trim().min(1).optional(),
  energy: z.string().trim().min(1).optional(),
  instrument: z.string().trim().min(1).optional(),
  tonality: z.string().trim().min(1).optional(),
});

knowledgeRouter.get("/genres", async (_request, response, next) => {
  try {
    response.json({ data: await knowledgeService.genres() });
  } catch (error) {
    next(error);
  }
});

knowledgeRouter.get("/moods", async (_request, response, next) => {
  try {
    response.json({ data: await knowledgeService.moods() });
  } catch (error) {
    next(error);
  }
});

knowledgeRouter.get("/scales", async (_request, response, next) => {
  try {
    response.json({ data: await knowledgeService.scales() });
  } catch (error) {
    next(error);
  }
});

knowledgeRouter.get("/chords", async (request, response, next) => {
  try {
    response.json({ data: await chordsKnowledgeService.recommend(recommendationQuery.partial().parse(request.query)) });
  } catch (error) {
    next(error);
  }
});

knowledgeRouter.get("/plugins", async (request, response, next) => {
  try {
    response.json({ data: await pluginsKnowledgeService.recommend(recommendationQuery.partial().parse(request.query)) });
  } catch (error) {
    next(error);
  }
});

knowledgeRouter.get("/instruments", async (request, response, next) => {
  try {
    response.json({ data: await instrumentsKnowledgeService.recommend(recommendationQuery.partial().parse(request.query)) });
  } catch (error) {
    next(error);
  }
});

knowledgeRouter.get("/recommendations", async (request, response, next) => {
  try {
    response.json({ data: await recommendationKnowledgeService.recommend(recommendationQuery.parse(request.query)) });
  } catch (error) {
    next(error);
  }
});

knowledgeRouter.get("/search", async (request, response, next) => {
  try {
    const { query } = z.object({ query: z.string().trim().min(1).max(200) }).parse(request.query);
    response.json({ data: await searchKnowledgeService.search(query) });
  } catch (error) {
    next(error);
  }
});
