import { requireSupabase } from "../config/supabase.js";

const MONTHLY_CREDIT_ALLOCATION = 1500;
export const TEXT_TO_MIDI_CREDIT_COST = 10;
export const VOICE_TO_MIDI_CREDIT_COST = 50;
const MONTHLY_GRANT_REASON = "monthly_credit_allocation";

type CreditTransactionRow = {
	amount: number | null;
	transaction_type: "grant" | "usage" | "refund" | "adjustment";
	created_at: string;
};

export interface MonthlyCreditSummary {
	monthlyAllocation: number;
	balance: number;
	used: number;
	usagePercent: number;
	resetsOn: string;
	textToMidiCost: number;
	voiceToMidiCost: number;
	textToMidiGenerationLimit: number;
	textToMidiGenerationsRemaining: number;
}

function cycleWindow(now = new Date()) {
	const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
	const nextStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
	const resetDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 12, 0, 0));
	const periodKey = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
	return {
		periodKey,
		startIso: start.toISOString(),
		nextStartIso: nextStart.toISOString(),
		resetsOnIso: resetDay.toISOString(),
	};
}

async function ensureMonthlyAllocation(userId: string) {
	const db = requireSupabase();
	const window = cycleWindow();
	const { data, error } = await db.from("credit_transactions").select("id").eq("user_id", userId).eq("reason", MONTHLY_GRANT_REASON).gte("created_at", window.startIso).lt("created_at", window.nextStartIso).limit(1);
	if (error) throw error;
	if ((data ?? []).length > 0) return window;
	const { error: grantError } = await db.from("credit_transactions").insert({ user_id: userId, amount: MONTHLY_CREDIT_ALLOCATION, transaction_type: "grant", reason: MONTHLY_GRANT_REASON, metadata: { cycle: window.periodKey, resetsOn: window.resetsOnIso } });
	if (grantError) throw grantError;
	return window;
}

async function cycleTransactions(userId: string): Promise<{ window: ReturnType<typeof cycleWindow>; rows: CreditTransactionRow[] }> {
	const window = await ensureMonthlyAllocation(userId);
	const { data, error } = await requireSupabase().from("credit_transactions").select("amount, transaction_type, created_at").eq("user_id", userId).gte("created_at", window.startIso).lt("created_at", window.nextStartIso);
	if (error) throw error;
	return { window, rows: (data ?? []) as CreditTransactionRow[] };
}

export async function monthlyCreditSummary(userId: string): Promise<MonthlyCreditSummary> {
	const { window, rows } = await cycleTransactions(userId);
	const balance = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
	const used = rows
		.filter((row) => row.transaction_type === "usage")
		.reduce((sum, row) => sum + Math.abs(Number(row.amount ?? 0)), 0);
	const textToMidiGenerationLimit = Math.floor(MONTHLY_CREDIT_ALLOCATION / TEXT_TO_MIDI_CREDIT_COST);
	return {
		monthlyAllocation: MONTHLY_CREDIT_ALLOCATION,
		balance,
		used,
		usagePercent: Math.min(100, (used / MONTHLY_CREDIT_ALLOCATION) * 100),
		resetsOn: window.resetsOnIso,
		textToMidiCost: TEXT_TO_MIDI_CREDIT_COST,
		voiceToMidiCost: VOICE_TO_MIDI_CREDIT_COST,
		textToMidiGenerationLimit,
		textToMidiGenerationsRemaining: Math.max(0, Math.floor(balance / TEXT_TO_MIDI_CREDIT_COST)),
	};
}

export async function assertCreditsAvailable(userId: string, amount: number) {
	const summary = await monthlyCreditSummary(userId);
	if (summary.balance < amount) {
		const error = new Error(`Not enough credits. ${amount} credits required, ${summary.balance} remaining.`);
		Object.assign(error, { statusCode: 402, code: "INSUFFICIENT_CREDITS", credits: summary });
		throw error;
	}
	return summary;
}

export async function recordCreditUsage(userId: string, amount: number, reason: string, metadata: Record<string, unknown> = {}, refs: { songPackId?: string; songPackGenerationId?: string } = {}) {
	if (amount <= 0) throw new Error("Credit usage amount must be positive.");
	await ensureMonthlyAllocation(userId);
	const { error } = await requireSupabase().from("credit_transactions").insert({
		user_id: userId,
		song_pack_id: refs.songPackId ?? null,
		song_pack_generation_id: refs.songPackGenerationId ?? null,
		amount: -amount,
		transaction_type: "usage",
		reason,
		metadata,
	});
	if (error) throw error;
	return monthlyCreditSummary(userId);
}