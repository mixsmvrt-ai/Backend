import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Midi } from "@tonejs/midi";

type DrumRole = "kick" | "snare" | "hat" | "rim" | "percussion";

type DrumReference = {
	fileName: string;
	setName: string;
	role: DrumRole;
	ppq: number;
	barCount: number;
	noteCount: number;
	uniquePitches: number[];
	onsets: number[];
};

let cachedReferences: DrumReference[] | null = null;

function referenceDirectory() {
	const currentFileDirectory = dirname(fileURLToPath(import.meta.url));
	return resolve(currentFileDirectory, "..", "..", "reference-midi", "trap-dancehall");
}

function roleFromFileName(fileName: string): DrumRole {
	const normalized = fileName.toLowerCase();
	if (normalized.includes("kick")) return "kick";
	if (normalized.includes("snare")) return "snare";
	if (normalized.includes("hat") || normalized.includes("hh")) return "hat";
	if (normalized.includes("rim")) return "rim";
	return "percussion";
}

function setNameFromFileName(fileName: string) {
	return fileName.split("__", 1)[0].replace(/-/g, " ");
}

function round(value: number, places = 3) {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}

async function loadReferences() {
	if (cachedReferences) return cachedReferences;
	const directory = referenceDirectory();
	const fileNames = (await readdir(directory)).filter((fileName) => fileName.toLowerCase().endsWith(".mid"));
	const references: DrumReference[] = [];

	for (const fileName of fileNames) {
		const midi = new Midi(await readFile(join(directory, fileName)));
		const ppq = midi.header.ppq || 480;
		const notes = midi.tracks.flatMap((track) => track.notes);
		const maxTick = notes.reduce((max, note) => Math.max(max, note.ticks + note.durationTicks), 0);
		const barCount = Math.max(1, Math.ceil(maxTick / (ppq * 4)));
		const uniquePitches = [...new Set(notes.map((note) => note.midi))].sort((left, right) => left - right);
		const onsets = [...new Set(notes.map((note) => round((note.ticks % (ppq * 4)) / ppq)))].sort((left, right) => left - right).slice(0, 32);
		references.push({ fileName, setName: setNameFromFileName(fileName), role: roleFromFileName(fileName), ppq, barCount, noteCount: notes.length, uniquePitches, onsets });
	}

	cachedReferences = references;
	return references;
}

export async function drumReferencePrompt(input: { prompt: string; genre?: string; kind: string }) {
	const text = `${input.prompt} ${input.genre ?? ""} ${input.kind}`.toLowerCase();
	if (!/(trap|dancehall|drum|riddim|jamaican|uk dancehall)/.test(text)) return "";

	const references = await loadReferences();
	const roleSummaries = ["kick", "snare", "hat", "rim", "percussion"].map((role) => {
		const items = references.filter((reference) => reference.role === role);
		if (!items.length) return null;
		const noteRange = [...new Set(items.flatMap((item) => item.uniquePitches))].join(", ");
		const onsetSets = items.slice(0, 4).map((item) => `${item.setName}/${item.fileName.split("__").at(-1)}: [${item.onsets.join(", ")}]`).join("; ");
		return `${role}: ${items.length} references, MIDI pitches [${noteRange}], onset positions in a 4/4 bar ${onsetSets}`;
	}).filter(Boolean);

	return [
		"Curated local MIDI references: supplied trap/dancehall drum stems are available as rhythmic references, not material to copy.",
		"Use their observed timing density, syncopation, kick placement, rim accents, hat subdivisions, and percussion gaps as a starting point; create an original pattern.",
		...roleSummaries,
	].join("\n");
}