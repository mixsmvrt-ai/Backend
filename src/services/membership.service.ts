import { requireSupabase } from "../config/supabase.js";
import { env } from "../config/env.js";
import { isConfiguredAdminUser } from "./admin-access.service.js";

type AppRole = "user" | "support" | "admin" | "super_admin";
type MembershipType = "trial" | "pro" | "expired" | "admin";
type MembershipStatus = "trial_active" | "pro_active" | "expired" | "admin";
export type MembershipPlan = "go" | "plus";

type ProfileRow = {
	id: string;
	created_at: string | null;
	membership_type: MembershipType | "free" | null;
	plan: MembershipPlan | null;
	membership_status: MembershipStatus | null;
	trial_started_at: string | null;
	trial_expires_at: string | null;
	pro_started_at: string | null;
	access_expires_at: string | null;
	last_payment_at: string | null;
	last_payment_date?: string | null;
	total_payments: number | null;
};

export interface MembershipSnapshot {
	type: MembershipType;
	status: MembershipStatus;
	active: boolean;
	readOnly: boolean;
	isAdmin: boolean;
	canGenerate: boolean;
	canCreateProjects: boolean;
	trialStartedAt: string | null;
	trialExpiresAt: string | null;
	proStartedAt: string | null;
	accessExpiresAt: string | null;
	lastPaymentAt: string | null;
	totalPayments: number;
	daysRemaining: number;
	trialDaysRemaining: number;
	plan: MembershipPlan;
}

const DAY_MS = 86_400_000;
const TRIAL_DAYS = 7;
const PRO_PASS_DAYS = 30;

function currentTime() {
	return new Date();
}

function toDate(value: string | null | undefined) {
	return value ? new Date(value) : null;
}

function toIso(value: Date | null) {
	return value ? value.toISOString() : null;
}

function addDays(value: Date, days: number) {
	return new Date(value.getTime() + (days * DAY_MS));
}

function remainingDays(value: Date | null) {
	return value && value.getTime() > Date.now()
		? Math.max(0, Math.ceil((value.getTime() - Date.now()) / DAY_MS))
		: 0;
}

async function userRoleFor(userId: string): Promise<AppRole> {
	if (await isConfiguredAdminUser(userId)) return "admin";
	const { data, error } = await requireSupabase().from("user_roles").select("role").eq("user_id", userId).maybeSingle();
	if (error) throw error;
	return (data?.role ?? "user") as AppRole;
}

async function logActivity(userId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>) {
	try {
		const { error } = await requireSupabase().from("activity_log").insert({ user_id: userId, action, entity_type: entityType, entity_id: entityId, metadata });
		if (error) throw error;
	} catch {
		return;
	}
}

async function notify(userId: string, type: string, title: string, body: string) {
	try {
		const { error } = await requireSupabase().from("notifications").insert({ user_id: userId, type, title, body });
		if (error) throw error;
	} catch {
		return;
	}
}

async function recordTrialEvent(userId: string, eventType: "started" | "remaining_3_days" | "remaining_1_day" | "expires_today" | "expired" | "extended" | "ended" | "converted_to_pro", details: Record<string, unknown>) {
	const db = requireSupabase();
	const { data: existing, error: existingError } = await db.from("trial_events").select("id").eq("user_id", userId).eq("event_type", eventType).limit(1).maybeSingle();
	if (existingError) throw existingError;
	if (existing) return;
	const { error } = await db.from("trial_events").insert({ user_id: userId, event_type: eventType, details });
	if (error) throw error;
}

async function recordMembershipHistory(userId: string, input: { type: MembershipType; status: MembershipStatus; startsAt: Date; expiresAt: Date; reason: string; paymentId?: string | null }) {
	const { error } = await requireSupabase().from("membership_history").insert({
		user_id: userId,
		payment_id: input.paymentId ?? null,
		membership_type: input.type,
		membership_status: input.status,
		starts_at: input.startsAt.toISOString(),
		expires_at: input.expiresAt.toISOString(),
		reason: input.reason,
	});
	if (error) throw error;
}

async function ensureProfile(userId: string): Promise<ProfileRow> {
	const db = requireSupabase();
	const { data, error } = await db.from("profiles").select("id, created_at, membership_type, plan, membership_status, trial_started_at, trial_expires_at, pro_started_at, access_expires_at, last_payment_at, last_payment_date, total_payments").eq("id", userId).maybeSingle();
	if (error) throw error;

	if (!data) {
		const createdAt = currentTime();
		const trialExpiresAt = addDays(createdAt, TRIAL_DAYS);
		const { data: inserted, error: insertError } = await db.from("profiles").upsert({
			id: userId,
			created_at: createdAt.toISOString(),
			updated_at: createdAt.toISOString(),
			membership_type: "trial",
			plan: "plus",
			membership_status: "trial_active",
			trial_started_at: createdAt.toISOString(),
			trial_expires_at: trialExpiresAt.toISOString(),
			total_payments: 0,
		}).select("id, created_at, membership_type, plan, membership_status, trial_started_at, trial_expires_at, pro_started_at, access_expires_at, last_payment_at, total_payments").single();
		if (insertError || !inserted) throw insertError ?? new Error("Unable to initialize membership profile.");
		await recordMembershipHistory(userId, { type: "trial", status: "trial_active", startsAt: createdAt, expiresAt: trialExpiresAt, reason: "bootstrap_trial" });
		await recordTrialEvent(userId, "started", { trialStartedAt: createdAt.toISOString(), trialExpiresAt: trialExpiresAt.toISOString() });
		await notify(userId, "trial_started", "Your 7-day Pro trial is active", "Welcome to MidiFlow. Your full Pro trial has started and will remain active for 7 days.");
		await logActivity(userId, "trial_started", "membership", userId, { trial_expires_at: trialExpiresAt.toISOString() });
		return inserted as ProfileRow;
	}

	const createdAt = toDate(data.created_at) ?? currentTime();
	const trialStartedAt = toDate(data.trial_started_at) ?? createdAt;
	const trialExpiresAt = toDate(data.trial_expires_at) ?? addDays(trialStartedAt, TRIAL_DAYS);
	const accessExpiresAt = toDate(data.access_expires_at);
	const updates: Record<string, unknown> = {};

	if (!data.trial_started_at) updates.trial_started_at = trialStartedAt.toISOString();
	if (!data.trial_expires_at) updates.trial_expires_at = trialExpiresAt.toISOString();
	if (!data.last_payment_at && data.last_payment_date) updates.last_payment_at = data.last_payment_date;

	if (data.membership_type === "free" || !data.membership_type || !data.membership_status) {
		if (data.membership_type === "pro" && accessExpiresAt && accessExpiresAt > currentTime()) {
			updates.membership_type = "pro";
			updates.membership_status = "pro_active";
		} else if (trialExpiresAt > currentTime()) {
			updates.membership_type = "trial";
			updates.membership_status = "trial_active";
		} else {
			updates.membership_type = "expired";
			updates.membership_status = "expired";
		}
	}

	if (Object.keys(updates).length > 0) {
		updates.updated_at = currentTime().toISOString();
		const { data: updated, error: updateError } = await db.from("profiles").update(updates).eq("id", userId).select("id, created_at, membership_type, plan, membership_status, trial_started_at, trial_expires_at, pro_started_at, access_expires_at, last_payment_at, total_payments").single();
		if (updateError || !updated) throw updateError ?? new Error("Unable to update membership profile.");
		return updated as ProfileRow;
	}

	return {
		...(data as ProfileRow),
		total_payments: Number(data.total_payments ?? 0),
		trial_started_at: trialStartedAt.toISOString(),
		trial_expires_at: trialExpiresAt.toISOString(),
	};
}

function summarize(profile: ProfileRow, role: AppRole): MembershipSnapshot {
	const plan = profile.plan ?? "plus";
	if (role === "admin" || role === "super_admin" || profile.membership_type === "admin") {
		return {
			type: "admin",
			status: "admin",
			active: true,
			readOnly: false,
			isAdmin: true,
			canGenerate: true,
			canCreateProjects: true,
			trialStartedAt: profile.trial_started_at,
			trialExpiresAt: profile.trial_expires_at,
			proStartedAt: profile.pro_started_at,
			accessExpiresAt: profile.access_expires_at,
			lastPaymentAt: profile.last_payment_at ?? profile.last_payment_date ?? null,
			totalPayments: Number(profile.total_payments ?? 0),
			daysRemaining: 0,
			trialDaysRemaining: 0,
			plan: "plus",
		};
	}

	const accessExpiresAt = toDate(profile.access_expires_at);
	const trialExpiresAt = toDate(profile.trial_expires_at);
	const proActive = profile.membership_type === "pro" && !!accessExpiresAt && accessExpiresAt > currentTime();
	const trialActive = !proActive && profile.membership_type === "trial" && !!trialExpiresAt && trialExpiresAt > currentTime();

	if (proActive) {
		return {
			type: "pro",
			status: "pro_active",
			active: true,
			readOnly: false,
			isAdmin: false,
			canGenerate: true,
			canCreateProjects: true,
			trialStartedAt: profile.trial_started_at,
			trialExpiresAt: profile.trial_expires_at,
			proStartedAt: profile.pro_started_at,
			accessExpiresAt: toIso(accessExpiresAt),
			lastPaymentAt: profile.last_payment_at ?? profile.last_payment_date ?? null,
			totalPayments: Number(profile.total_payments ?? 0),
			daysRemaining: remainingDays(accessExpiresAt),
			trialDaysRemaining: remainingDays(trialExpiresAt),
			plan,
		};
	}

	if (trialActive) {
		return {
			type: "trial",
			status: "trial_active",
			active: true,
			readOnly: false,
			isAdmin: false,
			canGenerate: true,
			canCreateProjects: true,
			trialStartedAt: profile.trial_started_at,
			trialExpiresAt: toIso(trialExpiresAt),
			proStartedAt: profile.pro_started_at,
			accessExpiresAt: profile.access_expires_at,
			lastPaymentAt: profile.last_payment_at ?? profile.last_payment_date ?? null,
			totalPayments: Number(profile.total_payments ?? 0),
			daysRemaining: remainingDays(trialExpiresAt),
			trialDaysRemaining: remainingDays(trialExpiresAt),
			plan: "plus",
		};
	}

	return {
		type: "expired",
		status: "expired",
		active: false,
		readOnly: true,
		isAdmin: false,
		canGenerate: false,
		canCreateProjects: false,
		trialStartedAt: profile.trial_started_at,
		trialExpiresAt: profile.trial_expires_at,
		proStartedAt: profile.pro_started_at,
		accessExpiresAt: profile.access_expires_at,
		lastPaymentAt: profile.last_payment_at ?? profile.last_payment_date ?? null,
		totalPayments: Number(profile.total_payments ?? 0),
		daysRemaining: 0,
		trialDaysRemaining: 0,
		plan,
	};
}

async function maybeEmitTrialNotifications(userId: string, snapshot: MembershipSnapshot) {
	if (snapshot.type !== "trial" || !snapshot.trialExpiresAt) return;
	const expiry = new Date(snapshot.trialExpiresAt);
	if (snapshot.daysRemaining <= 3 && snapshot.daysRemaining > 1) {
		await recordTrialEvent(userId, "remaining_3_days", { trialExpiresAt: expiry.toISOString() });
		await notify(userId, "trial_remaining_3_days", "3 days left in your Pro trial", `Your full-featured trial expires on ${expiry.toLocaleDateString()}. Upgrade any time to keep creating.`);
	}
	if (snapshot.daysRemaining <= 1 && snapshot.daysRemaining > 0) {
		await recordTrialEvent(userId, "remaining_1_day", { trialExpiresAt: expiry.toISOString() });
		await notify(userId, "trial_remaining_1_day", "1 day left in your Pro trial", `Your trial ends on ${expiry.toLocaleDateString()}. Renew access with a 30-day Pro Pass.`);
	}
	if (snapshot.daysRemaining === 0 && expiry.toDateString() === currentTime().toDateString()) {
		await recordTrialEvent(userId, "expires_today", { trialExpiresAt: expiry.toISOString() });
		await notify(userId, "trial_expires_today", "Your Pro trial expires today", "Today is the last day to generate new content before your account becomes read-only.");
	}
}

async function maybeExpireMembership(userId: string, profile: ProfileRow, snapshot: MembershipSnapshot) {
	if (snapshot.active || snapshot.isAdmin) return snapshot;
	if (profile.membership_type !== "expired" || profile.membership_status !== "expired") {
		const { error } = await requireSupabase().from("profiles").update({ membership_type: "expired", membership_status: "expired", updated_at: currentTime().toISOString() }).eq("id", userId);
		if (error) throw error;
	}
	if (profile.membership_type === "trial") {
		const expiry = toDate(profile.trial_expires_at) ?? currentTime();
		await recordTrialEvent(userId, "expired", { trialExpiresAt: expiry.toISOString() });
		await recordMembershipHistory(userId, { type: "expired", status: "expired", startsAt: expiry, expiresAt: expiry, reason: "trial_expired" });
		await notify(userId, "trial_expired", "Your trial has ended", "Your account is now read-only. Upgrade with a 30-day Pro Pass to continue generating new content.");
		await logActivity(userId, "trial_expired", "membership", userId, { trial_expires_at: expiry.toISOString() });
	}
	return {
		...snapshot,
		type: "expired",
		status: "expired",
		active: false,
		readOnly: true,
		canGenerate: false,
		canCreateProjects: false,
		daysRemaining: 0,
		trialDaysRemaining: 0,
	} satisfies MembershipSnapshot;
}

export async function membershipFor(userId: string): Promise<MembershipSnapshot> {
	const [profile, role] = await Promise.all([ensureProfile(userId), userRoleFor(userId)]);
	const snapshot = summarize(profile, role);
	if (snapshot.type === "trial") await maybeEmitTrialNotifications(userId, snapshot);
	return maybeExpireMembership(userId, profile, snapshot);
}

export async function startTrialMembership(userId: string) {
	const db = requireSupabase();
	const profile = await ensureProfile(userId);
	if (profile.trial_started_at || Number(profile.total_payments ?? 0) > 0 || profile.membership_type === "pro") {
		const error = new Error("A trial has already been used for this account.");
		Object.assign(error, { statusCode: 409, code: "TRIAL_ALREADY_USED" });
		throw error;
	}
	const trialStartedAt = currentTime();
	const trialExpiresAt = addDays(trialStartedAt, TRIAL_DAYS);
	const { error } = await db.from("profiles").update({
		membership_type: "trial",
		membership_status: "trial_active",
		trial_started_at: trialStartedAt.toISOString(),
		trial_expires_at: trialExpiresAt.toISOString(),
		updated_at: trialStartedAt.toISOString(),
	}).eq("id", userId);
	if (error) throw error;
	await recordTrialEvent(userId, "started", { trialStartedAt: trialStartedAt.toISOString(), trialExpiresAt: trialExpiresAt.toISOString() });
	await recordMembershipHistory(userId, { type: "trial", status: "trial_active", startsAt: trialStartedAt, expiresAt: trialExpiresAt, reason: "manual_trial_start" });
	await notify(userId, "trial_started", "Your 7-day Pro trial is active", "Your full-featured trial has started and will remain active for 7 days.");
	await logActivity(userId, "trial_started", "membership", userId, { trial_expires_at: trialExpiresAt.toISOString() });
	return membershipFor(userId);
}

export async function grantProAccess(userId: string, paymentId: string | null, reason = "purchase", plan: MembershipPlan = "plus") {
	const db = requireSupabase();
	const profile = await ensureProfile(userId);
	if (paymentId) {
		const { data: payment } = await db.from("payments").select("plan").eq("id", paymentId).eq("user_id", userId).maybeSingle();
		if (payment?.plan === "go" || payment?.plan === "plus") plan = payment.plan;
	}
	const current = await membershipFor(userId);
	const anchors = [currentTime()];
	if (current.type === "trial" && current.trialExpiresAt) anchors.push(new Date(current.trialExpiresAt));
	if (current.type === "pro" && current.accessExpiresAt) anchors.push(new Date(current.accessExpiresAt));
	const startsAt = anchors.reduce((latest, value) => value > latest ? value : latest);
	const expiresAt = addDays(startsAt, PRO_PASS_DAYS);
	const { error } = await db.from("profiles").update({
		membership_type: "pro",
		plan,
		membership_status: "pro_active",
		pro_started_at: startsAt.toISOString(),
		access_expires_at: expiresAt.toISOString(),
		last_payment_at: currentTime().toISOString(),
		total_payments: Number(profile.total_payments ?? 0) + 1,
		updated_at: currentTime().toISOString(),
	}).eq("id", userId);
	if (error) throw error;
	await recordMembershipHistory(userId, { type: "pro", status: "pro_active", startsAt, expiresAt, reason, paymentId });
	if (paymentId) {
		const { handleSuccessfulReferralPayment } = await import("./referral.service.js");
		await handleSuccessfulReferralPayment(paymentId, { orderId: paymentId, paymentSource: "paypal_capture" });
	}
	if (current.type === "trial") {
		await recordTrialEvent(userId, "converted_to_pro", { startsAt: startsAt.toISOString(), expiresAt: expiresAt.toISOString() });
	}
	await notify(userId, reason === "renewal_extension" ? "membership_renewed" : "membership_activated", reason === "renewal_extension" ? `${plan === "go" ? "Go" : "Plus"} plan renewed` : `${plan === "go" ? "Go" : "Plus"} plan active`, `Your access is now active until ${expiresAt.toLocaleDateString()}.`);
	await logActivity(userId, reason === "renewal_extension" ? "membership_renewed" : "membership_activated", "membership", userId, { access_expires_at: expiresAt.toISOString(), payment_id: paymentId });
	return { startsAt: startsAt.toISOString(), expiresAt: expiresAt.toISOString() };
}

export async function assertActiveMembership(userId: string) {
	const membership = await membershipFor(userId);
	if (!membership.active) {
		const error = new Error("Membership Expired");
		Object.assign(error, { statusCode: 403, code: "MEMBERSHIP_EXPIRED", redirectTo: "/upgrade", membership });
		throw error;
	}
	return membership;
}

export async function assertPlusMembership(userId: string) {
	const membership = await assertActiveMembership(userId);
	if (!membership.isAdmin && membership.plan !== "plus") {
		const error = new Error("The Plus plan is required for this feature.");
		Object.assign(error, { statusCode: 403, code: "PLUS_PLAN_REQUIRED", membership });
		throw error;
	}
	return membership;
}

export async function membershipHistoryFor(userId: string) {
	const { data, error } = await requireSupabase().from("membership_history").select("*").eq("user_id", userId).order("created_at", { ascending: false });
	if (error) throw error;
	return data ?? [];
}

export async function trialStatusFor(userId: string) {
	return membershipFor(userId);
}

export async function paymentsFor(userId: string) {
	const { data, error } = await requireSupabase().from("payments").select("*, billing_history(*), payment_logs(*)").eq("user_id", userId).order("created_at", { ascending: false });
	if (error) throw error;
	return data ?? [];
}

export async function extendTrial(userId: string, days: number, actorId: string) {
	const profile = await ensureProfile(userId);
	const currentExpiry = toDate(profile.trial_expires_at);
	const baseline = currentExpiry && currentExpiry > currentTime() ? currentExpiry : currentTime();
	const nextExpiry = addDays(baseline, days);
	const { error } = await requireSupabase().from("profiles").update({
		membership_type: "trial",
		membership_status: "trial_active",
		trial_started_at: profile.trial_started_at ?? currentTime().toISOString(),
		trial_expires_at: nextExpiry.toISOString(),
		updated_at: currentTime().toISOString(),
	}).eq("id", userId);
	if (error) throw error;
	await recordTrialEvent(userId, "extended", { days, trialExpiresAt: nextExpiry.toISOString(), actorId });
	await notify(userId, "trial_extended", "Your trial has been extended", `Your MidiFlow Pro trial now ends on ${nextExpiry.toLocaleDateString()}.`);
	await logActivity(actorId, "trial_extended", "membership", userId, { days, trial_expires_at: nextExpiry.toISOString() });
	return membershipFor(userId);
}

export async function endTrial(userId: string, actorId: string) {
	const endedAt = currentTime();
	const { error } = await requireSupabase().from("profiles").update({
		membership_type: "expired",
		membership_status: "expired",
		trial_expires_at: endedAt.toISOString(),
		updated_at: endedAt.toISOString(),
	}).eq("id", userId);
	if (error) throw error;
	await recordTrialEvent(userId, "ended", { endedAt: endedAt.toISOString(), actorId });
	await recordMembershipHistory(userId, { type: "expired", status: "expired", startsAt: endedAt, expiresAt: endedAt, reason: "admin_trial_end" });
	await notify(userId, "trial_expired", "Your trial has ended", "Your account is now read-only until you purchase a 30-day Pro Pass.");
	await logActivity(actorId, "trial_ended", "membership", userId, { ended_at: endedAt.toISOString() });
	return membershipFor(userId);
}

export async function convertUserToPro(userId: string, actorId: string, days = PRO_PASS_DAYS) {
	const startsAt = currentTime();
	const expiresAt = addDays(startsAt, days);
	const { error } = await requireSupabase().from("profiles").update({
		membership_type: "pro",
		membership_status: "pro_active",
		pro_started_at: startsAt.toISOString(),
		access_expires_at: expiresAt.toISOString(),
		updated_at: startsAt.toISOString(),
	}).eq("id", userId);
	if (error) throw error;
	await recordMembershipHistory(userId, { type: "pro", status: "pro_active", startsAt, expiresAt, reason: "admin_convert" });
	await recordTrialEvent(userId, "converted_to_pro", { startsAt: startsAt.toISOString(), expiresAt: expiresAt.toISOString(), actorId });
	await notify(userId, "membership_activated", "Your Pro access is active", `Your access is now active until ${expiresAt.toLocaleDateString()}.`);
	await logActivity(actorId, "membership_converted", "membership", userId, { access_expires_at: expiresAt.toISOString() });
	return membershipFor(userId);
}

export async function trialAnalytics() {
	const db = requireSupabase();
	const current = currentTime();
	const monthStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1)).toISOString();
	const [trials, expired, pro, payments, renewals, signups] = await Promise.all([
		db.from("profiles").select("id", { count: "exact", head: true }).eq("membership_status", "trial_active"),
		db.from("profiles").select("id", { count: "exact", head: true }).eq("membership_status", "expired"),
		db.from("profiles").select("id", { count: "exact", head: true }).eq("membership_status", "pro_active"),
		db.from("payments").select("amount_cents").eq("status", "completed"),
		db.from("membership_history").select("id", { count: "exact", head: true }).eq("reason", "renewal_extension").gte("created_at", monthStart),
		db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
	]);
	[trials, expired, pro, payments, renewals, signups].forEach(({ error }) => { if (error) throw error; });
	const activeTrials = trials.count ?? 0;
	const expiredTrials = expired.count ?? 0;
	const activePro = pro.count ?? 0;
	const revenueCents = (payments.data ?? []).reduce((sum, payment) => sum + Number(payment.amount_cents), 0);
	const denominator = activeTrials + expiredTrials + activePro;
	return { activeTrials, expiredTrials, activePro, conversionRate: denominator === 0 ? 0 : Number((activePro / denominator).toFixed(3)), revenueCents, monthlyRenewals: renewals.count ?? 0, newSignups: signups.count ?? 0 };
}

export async function membershipUsers(filter: MembershipType | MembershipStatus | "all", query = "") {
	let builder = requireSupabase().from("profiles").select("id, display_name, created_at, membership_type, membership_status, trial_started_at, trial_expires_at, pro_started_at, access_expires_at, total_payments").order("created_at", { ascending: false }).limit(100);
	if (filter !== "all") {
		if (["trial", "pro", "expired", "admin"].includes(filter)) builder = builder.eq("membership_type", filter);
		else builder = builder.eq("membership_status", filter);
	}
	if (query.trim()) builder = builder.ilike("display_name", `%${query.trim()}%`);
	const { data, error } = await builder;
	if (error) throw error;
	return data ?? [];
}

export const planPrices = () => ({
	go: { amountCents: env.GO_PLAN_PRICE_CENTS, currency: env.PRO_CURRENCY, days: PRO_PASS_DAYS },
	plus: { amountCents: env.PLUS_PLAN_PRICE_CENTS, currency: env.PRO_CURRENCY, days: PRO_PASS_DAYS },
});
export const planPrice = () => planPrices().plus;
