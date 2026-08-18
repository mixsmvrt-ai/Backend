import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(process.cwd(), "..");
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const referenceBucket = process.env.REFERENCE_MIDI_BUCKET ?? "midi-references";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to upload assets.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

type Asset = { bucket: string; localPath: string; storagePath: string; contentType: string };

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const localPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(localPath) : [localPath];
  }));
  return nested.flat();
}

function contentType(filePath: string) {
  return path.extname(filePath).toLowerCase() === ".wav" ? "audio/wav" : "audio/midi";
}

async function upload(asset: Asset) {
  const buffer = await readFile(asset.localPath);
  const { error } = await supabase.storage.from(asset.bucket).upload(asset.storagePath, buffer, { contentType: asset.contentType, upsert: true });
  if (error) throw error;
  console.log(`Uploaded ${asset.bucket}/${asset.storagePath}`);
}

const soundDirectory = path.join(root, "frontend", "public", "sounds");
const referenceDirectory = path.join(root, "backend", "reference-midi");
const soundAssets = (await filesIn(soundDirectory)).map((localPath) => ({
  bucket: "preview-sounds",
  localPath,
  storagePath: path.basename(localPath),
  contentType: contentType(localPath),
}));
const referenceAssets = (await filesIn(referenceDirectory)).map((localPath) => ({
  bucket: referenceBucket,
  localPath,
  storagePath: path.relative(referenceDirectory, localPath).split(path.sep).join("/"),
  contentType: contentType(localPath),
}));

for (const asset of [...soundAssets, ...referenceAssets]) await upload(asset);
console.log(`Uploaded ${soundAssets.length} preview sounds and ${referenceAssets.length} MIDI references.`);
