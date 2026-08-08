import { requireSupabase } from "../config/supabase.js";

const GO_MONTHLY_CREDIT_ALLOCATION = 1500;
const PLUS_MONTHLY_CREDIT_ALLOCATION = 3000;
export const TEXT_TO_MIDI_CREDIT_COST = 10;
export const VOICE_TO_MIDI_CREDIT_COST = 50;
const MONTHLY_GRANT_REASON = "monthly_credit_allocation";

async function monthlyAllocationFor(userId: string) {
	const { data, error } = await requireSupabase().from("profiles").select("plan").eq("id", userId).single();
	if (error) throw error;
	return data?.plan === "plus" ? PLUS_MONTHLY_CREDIT_ALLOCATION : GO_MONTHLY_CREDIT_ALLOCATION;
}

type CreditTransactionRow = {
	amount: number | null;
	transaction_type: "grant" | "usage" | "refund" | "adjustment";
	reason: string | null;
	created_at: string;
};

export interface MonthlyCreditSummary {
	monthlyAllocation: number;
	balance: number;
	used: number;
	usagePercent: number;
	textBalance: number;
	textUsed: number;
	textUsagePercent: number;
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
	const monthlyAllocation = await monthlyAllocationFor(userId);
	const { data, error } = await db.from("credit_transactions").select("amount, transaction_type, reason").eq("user_id", userId).gte("created_at", window.startIso).lt("created_at", window.nextStartIso).in("reason", [MONTHLY_GRANT_REASON, "monthly_credit_plan_adjustment"]);
	if (error) throw error;
	const allocated = (data ?? []).reduce((sum, row) => sum + (row.transaction_type === "grant" || row.transaction_type === "adjustment" ? Math.max(0, Number(row.amount ?? 0)) : 0), 0);
	if (allocated === 0) {
		const { error: grantError } = await db.from("credit_transactions").insert({ user_id: userId, amount: monthlyAllocation, transaction_type: "grant", reason: MONTHLY_GRANT_REASON, metadata: { cycle: window.periodKey, resetsOn: window.resetsOnIso, plan: monthlyAllocation === PLUS_MONTHLY_CREDIT_ALLOCATION ? "plus" : "go" } });
		if (grantError) throw grantError;
		return window;
	}
	if (monthlyAllocation > allocated) {
		const { error: adjustmentError } = await db.from("credit_transactions").insert({ user_id: userId, amount: monthlyAllocation - allocated, transaction_type: "adjustment", reason: "monthly_credit_plan_adjustment", metadata: { cycle: window.periodKey, plan: monthlyAllocation === PLUS_MONTHLY_CREDIT_ALLOCATION ? "plus" : "go" } });
		if (adjustmentError) throw adjustmentError;
	}
	return window;
}

async function cycleTransactions(userId: string): Promise<{ window: ReturnType<typeof cycleWindow>; rows: CreditTransactionRow[] }> {
	const window = await ensureMonthlyAllocation(userId);
	const { data, error } = await requireSupabase().from("credit_transactions").select("amount, transaction_type, reason, created_at").eq("user_id", userId).gte("created_at", window.startIso).lt("created_at", window.nextStartIso);
	if (error) throw error;
	return { window, rows: (data ?? []) as CreditTransactionRow[] };
}

export async function monthlyCreditSummary(userId: string): Promise<MonthlyCreditSummary> {
	const { window, rows } = await cycleTransactions(userId);
	const monthlyAllocation = await monthlyAllocationFor(userId);
	const usageRows = rows.filter((row) => row.transaction_type === "usage");
	const used = usageRows.reduce((sum, row) => sum + Math.abs(Number(row.amount ?? 0)), 0);
	const balance = Math.max(0, monthlyAllocation - used);
	const textToMidiGenerationLimit = Math.floor(monthlyAllocation / TEXT_TO_MIDI_CREDIT_COST);
	return {
		monthlyAllocation,
		balance,
		used,
		usagePercent: monthlyAllocation ? Math.min(100, (used / monthlyAllocation) * 100) : 0,
		textBalance: balance,
		textUsed: used,
		textUsagePercent: monthlyAllocation ? Math.min(100, (used / monthlyAllocation) * 100) : 0,
		resetsOn: window.resetsOnIso,
		textToMidiCost: TEXT_TO_MIDI_CREDIT_COST,
		voiceToMidiCost: VOICE_TO_MIDI_CREDIT_COST,
		textToMidiGenerationLimit,
		textToMidiGenerationsRemaining: Math.max(0, Math.floor(balance / TEXT_TO_MIDI_CREDIT_COST)),
	};
}

export async function assertCreditsAvailable(userId: string, amount: number, bucket: "shared" | "text_to_midi" = "shared") {
	const summary = await monthlyCreditSummary(userId);
	const balance = summary.balance;
	if (balance < amount) {
		const error = new Error(`Not enough credits. ${amount} credits required, ${balance} remaining.`);
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