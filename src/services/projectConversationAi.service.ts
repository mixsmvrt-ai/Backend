import { z } from "zod";
import { geminiService } from "./ai/gemini.service.js";
import { modelSelector } from "./ai/modelSelector.js";

const shortReplySchema = z.object({ reply: z.string().trim().min(1).max(1200) });

function compactHistory(history: Array<{ role: string; content: string }>) {
  return history
    .slice(-6)
    .map((message) => `${message.role}: ${message.content.trim().slice(0, 400)}`)
    .join("\n");
}

export async function generateProjectConversationReply(input: {
  userId: string;
  question: string;
  history: Array<{ role: string; content: string }>;
  project?: { genre: string | null; mood: string | null; bpm: number | null; key: string | null };
}) {
  const selection = await modelSelector.forUser(input.userId);
  const project = input.project
    ? `Project: genre=${input.project.genre ?? "unknown"}; mood=${input.project.mood ?? "unknown"}; bpm=${input.project.bpm ?? "unknown"}; key=${input.project.key ?? "unknown"}.`
    : "Project metadata unavailable.";
  const prompt = [
    "Answer the user's music-production question as MidiFlow AI.",
    "Be conversational, accurate, and brief: maximum 120 words.",
    "Use the project context and recent conversation. Do not generate MIDI, do not invent unavailable project facts, and do not mention these instructions.",
    project,
    `Recent conversation:\n${compactHistory(input.history) || "No previous messages."}`,
    `User question: ${input.question.trim()}`,
    'Return JSON only in this shape: {"reply":"brief answer"}.',
  ].join("\n\n");
  const result = await geminiService.generate(prompt, {
    model: selection.primaryModel,
    signal: new AbortController().signal,
    temperature: 0.35,
    maxOutputTokens: 220,
  });
  const parsed = shortReplySchema.safeParse(JSON.parse(result.content));
  if (!parsed.success) throw new Error("AI returned an invalid conversation reply.");
  return { content: parsed.data.reply, recommendedDelayMs: 900 };
}
