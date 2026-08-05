import { randomUUID } from "node:crypto";
import { requireSupabase } from "../config/supabase.js";
import { membershipFor } from "./membership.service.js";

type CommissionStatus = "pending" | "eligible" | "paid" | "cancelled" | "refunded" | "flagged";
type ReferralSettings = {
  enabled: boolean;
  defaultCommissionType: "percentage" | "flat";
  defaultCommissionRate: number;
  flatCommissionCents: number;
  minimumPayoutCents: number;
  eligibilityDelayDays: number;
  cookieDurationDays: number;
  referralExpirationDays: number;
  allowSelfReferrals: boolean;
  allowMultipleReferrals: boolean;
  maximumCommissionPerUserCents: number;
  maximumPayoutPerMonthCents: number;
  automaticApproval: boolean;
  manualApproval: boolean;
};

type ReferralProfile = {
  id: string;
  display_name: string | null;
  referral_code: string | null;
  referral_status: "active" | "suspended" | null;
};

type ReferralWallet = {
  user_id: string;
  available_balance_cents: number;
  pending_balance_cents: number;
  lifetime_earnings_cents: number;
  minimum_payout_cents: number;
  paypal_email: string | null;
  last_payout_at: string | null;
  updated_at: string;
};

type ReferralRow = {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referral_code: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type CommissionRow = {
  id: string;
  referral_id: string;
  referrer_user_id: string;
  referred_user_id: string;
  payment_id: string;
  purchase_amount_cents: number;
  commission_amount_cents: number;
  commission_rate: number | null;
  commission_type: "percentage" | "flat";
  status: CommissionStatus;
  eligible_at: string;
  released_at: string | null;
  created_at: string;
  updated_at: string;
  payout_request_id?: string | null;
};

function defaults(): ReferralSettings {
  return {
    enabled: true,
    defaultCommissionType: "percentage",
    defaultCommissionRate: 20,
    flatCommissionCents: 0,
    minimumPayoutCents: 2000,
    eligibilityDelayDays: 14,
    cookieDurationDays: 45,
    referralExpirationDays: 90,
    allowSelfReferrals: false,
    allowMultipleReferrals: false,
    maximumCommissionPerUserCents: 500_000,
    maximumPayoutPerMonthCents: 100_000,
    automaticApproval: false,
    manualApproval: true,
  };
}

function money(cents: number) {
  return Number((Number(cents) / 100).toFixed(2));
}

function displayName(profile: { display_name?: string | null } | null | undefined, fallback: string) {
  return profile?.display_name?.trim() || fallback;
}

function referralCodeCandidate() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 7; index += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)] ?? "A";
  return code;
}

async function generateUniqueReferralCode() {
  const db = requireSupabase();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = referralCodeCandidate();
    const { data, error } = await db.from("profiles").select("id").eq("referral_code", candidate).maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  return randomUUID().replace(/-/g, "").slice(0, 7).toUpperCase();
}

export async function loadReferralSettings(): Promise<ReferralSettings> {
  const db = requireSupabase();
  const base = defaults();
  const { data, error } = await db.from("system_settings").select("value").eq("key", "referral_program_config").maybeSingle();
  if (error || !data?.value) return base;
  const value = data.value as Record<string, unknown>;
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : base.enabled,
    defaultCommissionType: value.defaultCommissionType === "flat" ? "flat" : "percentage",
    defaultCommissionRate: typeof value.defaultCommissionRate === "number" ? value.defaultCommissionRate : base.defaultCommissionRate,
    flatCommissionCents: typeof value.flatCommissionCents === "number" ? value.flatCommissionCents : base.flatCommissionCents,
    minimumPayoutCents: typeof value.minimumPayoutCents === "number" ? value.minimumPayoutCents : base.minimumPayoutCents,
    eligibilityDelayDays: typeof value.eligibilityDelayDays === "number" ? value.eligibilityDelayDays : base.eligibilityDelayDays,
    cookieDurationDays: typeof value.cookieDurationDays === "number" ? value.cookieDurationDays : base.cookieDurationDays,
    referralExpirationDays: typeof value.referralExpirationDays === "number" ? value.referralExpirationDays : base.referralExpirationDays,
    allowSelfReferrals: typeof value.allowSelfReferrals === "boolean" ? value.allowSelfReferrals : base.allowSelfReferrals,
    allowMultipleReferrals: typeof value.allowMultipleReferrals === "boolean" ? value.allowMultipleReferrals : base.allowMultipleReferrals,
    maximumCommissionPerUserCents: typeof value.maximumCommissionPerUserCents === "number" ? value.maximumCommissionPerUserCents : base.maximumCommissionPerUserCents,
    maximumPayoutPerMonthCents: typeof value.maximumPayoutPerMonthCents === "number" ? value.maximumPayoutPerMonthCents : base.maximumPayoutPerMonthCents,
    automaticApproval: typeof value.automaticApproval === "boolean" ? value.automaticApproval : base.automaticApproval,
    manualApproval: typeof value.manualApproval === "boolean" ? value.manualApproval : base.manualApproval,
  };
}

async function profileFor(userId: string): Promise<ReferralProfile> {
  await membershipFor(userId);
  const { data, error } = await requireSupabase().from("profiles").select("id, display_name, referral_code, referral_status").eq("id", userId).single();
  if (error || !data) throw error ?? new Error("Unable to load referral profile.");
  return data as ReferralProfile;
}

async function walletFor(userId: string, minimumPayoutCents?: number): Promise<ReferralWallet> {
  const { data, error } = await requireSupabase().from("referral_wallets").upsert({ user_id: userId, minimum_payout_cents: minimumPayoutCents ?? defaults().minimumPayoutCents, updated_at: new Date().toISOString() }).select("*").single();
  if (error || !data) throw error ?? new Error("Unable to load referral wallet.");
  return data as ReferralWallet;
}

async function profileMap(ids: string[]) {
  if (!ids.length) return new Map<string, ReferralProfile>();
  const { data, error } = await requireSupabase().from("profiles").select("id, display_name, referral_code, referral_status").in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [String(row.id), row as ReferralProfile]));
}

async function releaseEligibleCommissions(userId?: string) {
  const db = requireSupabase();
  let query = db.from("referral_commissions").select("*").eq("status", "pending").lte("eligible_at", new Date().toISOString()).limit(100);
  if (userId) query = query.eq("referrer_user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  for (const row of (data ?? []) as CommissionRow[]) {
    const [paymentResult, membership, wallet] = await Promise.all([
      db.from("payments").select("status").eq("id", row.payment_id).maybeSingle(),
      membershipFor(row.referred_user_id),
      walletFor(row.referrer_user_id),
    ]);
    if (paymentResult.error) throw paymentResult.error;
    if (paymentResult.data?.status !== "completed" || !membership.active) continue;
    const now = new Date().toISOString();
    const nextAvailable = Number(wallet.available_balance_cents ?? 0) + Number(row.commission_amount_cents ?? 0);
    const nextPending = Math.max(0, Number(wallet.pending_balance_cents ?? 0) - Number(row.commission_amount_cents ?? 0));
    const { error: commissionError } = await db.from("referral_commissions").update({ status: "eligible", released_at: now, updated_at: now }).eq("id", row.id).eq("status", "pending");
    if (commissionError) throw commissionError;
    const { error: walletError } = await db.from("referral_wallets").update({ available_balance_cents: nextAvailable, pending_balance_cents: nextPending, updated_at: now }).eq("user_id", row.referrer_user_id);
    if (walletError) throw walletError;
    await db.from("referrals").update({ status: "eligible", updated_at: now }).eq("id", row.referral_id);
    await db.from("notifications").insert({ user_id: row.referrer_user_id, type: "referral_commission_available", title: "Referral commission available", body: `A referral commission of $${money(row.commission_amount_cents).toFixed(2)} is now available in your wallet.` });
  }
}

export async function ensureReferralAccount(userId: string) {
  const [profile, settings] = await Promise.all([profileFor(userId), loadReferralSettings()]);
  if (!profile.referral_code) {
    const referralCode = await generateUniqueReferralCode();
    const { error } = await requireSupabase().from("profiles").update({ referral_code: referralCode, updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) throw error;
    profile.referral_code = referralCode;
  }
  const wallet = await walletFor(userId, settings.minimumPayoutCents);
  return { profile, wallet, settings };
}

export async function trackReferralClick(input: { referralCode: string; visitorSessionId?: string | null; landingPath?: string | null; deviceFingerprint?: string | null; signupSource?: string | null; sourceIp?: string | null; userAgent?: string | null; }) {
  const referralCode = input.referralCode.trim().toUpperCase();
  if (!referralCode) return { tracked: false };
  const db = requireSupabase();
  const { data: profile, error } = await db.from("profiles").select("id, referral_status").eq("referral_code", referralCode).maybeSingle();
  if (error) throw error;
  if (!profile || profile.referral_status === "suspended") return { tracked: false };
  const { error: insertError } = await db.from("referral_clicks").insert({ referral_code: referralCode, referrer_user_id: profile.id, visitor_session_id: input.visitorSessionId ?? null, landing_path: input.landingPath ?? null, source_ip: input.sourceIp ?? null, user_agent: input.userAgent ?? null, device_fingerprint: input.deviceFingerprint ?? null, signup_source: input.signupSource ?? null });
  if (insertError) throw insertError;
  return { tracked: true };
}

export async function referralDashboard(userId: string, origin: string) {
  await releaseEligibleCommissions(userId);
  const db = requireSupabase();
  const { profile, wallet, settings } = await ensureReferralAccount(userId);
  const [referralsResult, commissionsResult, requestsResult, payoutsResult, clicksResult] = await Promise.all([
    db.from("referrals").select("*").eq("referrer_user_id", userId).order("created_at", { ascending: false }),
    db.from("referral_commissions").select("*").eq("referrer_user_id", userId).order("created_at", { ascending: false }),
    db.from("payout_requests").select("*").eq("user_id", userId).order("requested_at", { ascending: false }),
    db.from("payout_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    db.from("referral_clicks").select("id").eq("referrer_user_id", userId),
  ]);
  [referralsResult, commissionsResult, requestsResult, payoutsResult, clicksResult].forEach((result) => { if (result.error) throw result.error; });
  const referrals = (referralsResult.data ?? []) as ReferralRow[];
  const commissions = (commissionsResult.data ?? []) as CommissionRow[];
  const payoutRequests = requestsResult.data ?? [];
  const payoutTransactions = payoutsResult.data ?? [];
  const profiles = await profileMap(referrals.map((row) => row.referred_user_id));
  const commissionByReferral = new Map<string, CommissionRow>();
  commissions.forEach((commission) => { if (!commissionByReferral.has(commission.referral_id)) commissionByReferral.set(commission.referral_id, commission); });
  const paidCount = commissions.filter((commission) => commission.status === "paid").length;
  const eligibleCount = commissions.filter((commission) => commission.status === "eligible").length;
  const pendingCount = commissions.filter((commission) => commission.status === "pending").length;
  const convertedCount = referrals.filter((referral) => ["converted", "pending", "eligible", "paid"].includes(referral.status)).length;
  const trialCount = referrals.filter((referral) => referral.status === "trial_active" || referral.status === "signed_up").length;
  const lifetimeCommissionCents = commissions.reduce((sum, commission) => sum + Number(commission.commission_amount_cents ?? 0), 0);
  const payoutsReceivedCents = (payoutTransactions as Array<{ amount_cents?: number; status?: string }>).filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.amount_cents ?? 0), 0);
  const outstandingRequestedCents = (payoutRequests as Array<{ amount_cents?: number; status?: string }>).filter((row) => row.status === "pending" || row.status === "approved").reduce((sum, row) => sum + Number(row.amount_cents ?? 0), 0);
  const requestableBalanceCents = Math.max(0, Number(wallet.available_balance_cents ?? 0) - outstandingRequestedCents);
  const latestPayout = (payoutTransactions as Array<{ processed_at?: string | null }>)[0];
  const nextEligibility = commissions.filter((commission) => commission.status === "pending").sort((left, right) => new Date(left.eligible_at).getTime() - new Date(right.eligible_at).getTime())[0]?.eligible_at ?? null;
  return {
    code: profile.referral_code,
    link: `${origin.replace(/\/$/, "")}/signup?ref=${encodeURIComponent(String(profile.referral_code ?? ""))}`,
    settings,
    wallet: { availableBalance: money(Number(wallet.available_balance_cents ?? 0)), pendingBalance: money(Number(wallet.pending_balance_cents ?? 0)), lifetimeEarnings: money(Number(wallet.lifetime_earnings_cents ?? 0)), minimumPayout: money(Number(wallet.minimum_payout_cents ?? settings.minimumPayoutCents)), payoutEmail: wallet.paypal_email, lastPayout: wallet.last_payout_at, requestableBalance: money(requestableBalanceCents) },
    stats: { totalReferrals: referrals.length, successfulReferrals: convertedCount, pendingReferrals: pendingCount, trialReferrals: trialCount, paidReferrals: paidCount, totalEarnings: money(lifetimeCommissionCents), availableBalance: money(Number(wallet.available_balance_cents ?? 0)), pendingBalance: money(Number(wallet.pending_balance_cents ?? 0)), lifetimeCommission: money(lifetimeCommissionCents), payoutsReceived: money(payoutsReceivedCents), nextPayoutEligibility: nextEligibility, totalClicks: (clicksResult.data ?? []).length, eligibleCommissions: eligibleCount },
    activity: referrals.map((referral) => { const commission = commissionByReferral.get(referral.id); const referred = profiles.get(referral.referred_user_id); return { id: referral.id, referralName: displayName(referred, "New producer"), signupDate: referral.created_at, planPurchased: commission ? "Pro Pass" : "Trial", purchaseAmount: commission ? money(commission.purchase_amount_cents) : 0, commissionEarned: commission ? money(commission.commission_amount_cents) : 0, status: commission?.status === "eligible" ? "Eligible" : commission?.status === "paid" ? "Paid" : commission?.status === "pending" ? "Pending" : referral.status === "trial_active" ? "Trial Active" : referral.status === "signed_up" ? "Signed Up" : referral.status === "converted" ? "Converted" : referral.status === "refunded" ? "Refunded" : referral.status === "cancelled" ? "Cancelled" : referral.status }; }),
    payouts: payoutRequests,
    payoutHistory: payoutTransactions,
    summary: { latestPayoutAt: latestPayout?.processed_at ?? null, outstandingRequested: money(outstandingRequestedCents) },
  };
}

export async function referralStats(userId: string, origin: string) { const dashboard = await referralDashboard(userId, origin); return { code: dashboard.code, link: dashboard.link, wallet: dashboard.wallet, stats: dashboard.stats, summary: dashboard.summary }; }
export async function referralActivity(userId: string, origin: string) { const dashboard = await referralDashboard(userId, origin); return { code: dashboard.code, link: dashboard.link, activity: dashboard.activity }; }

export async function recordReferralTouch(userId: string, type: "copy" | "share", metadata: Record<string, unknown>) {
  const { profile } = await ensureReferralAccount(userId);
  const { error } = await requireSupabase().from("activity_log").insert({ user_id: userId, action: type === "copy" ? "referral_link_copied" : "referral_link_shared", entity_type: "referral", entity_id: userId, metadata: { referralCode: profile.referral_code, ...metadata } });
  if (error) throw error;
  return { ok: true };
}

export async function createPayoutRequest(userId: string, input: { amountCents?: number; paypalEmail?: string | null }) {
  await releaseEligibleCommissions(userId);
  const db = requireSupabase();
  const { settings } = await ensureReferralAccount(userId);
  const wallet = await walletFor(userId, settings.minimumPayoutCents);
  const payoutEmail = input.paypalEmail?.trim() || wallet.paypal_email || "";
  if (!payoutEmail) throw new Error("Add a PayPal email before requesting a payout.");
  const { data: pendingRequests, error: pendingError } = await db.from("payout_requests").select("amount_cents").eq("user_id", userId).in("status", ["pending", "approved"]);
  if (pendingError) throw pendingError;
  const reservedCents = (pendingRequests ?? []).reduce((sum, row) => sum + Number(row.amount_cents ?? 0), 0);
  const availableCents = Math.max(0, Number(wallet.available_balance_cents ?? 0) - reservedCents);
  const amountCents = input.amountCents ?? availableCents;
  if (amountCents < Number(wallet.minimum_payout_cents ?? settings.minimumPayoutCents)) throw new Error(`Payout requests must be at least $${money(Number(wallet.minimum_payout_cents ?? settings.minimumPayoutCents)).toFixed(2)}.`);
  if (amountCents > availableCents) throw new Error("Requested payout exceeds your available referral balance.");
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data: monthPayouts, error: monthError } = await db.from("payout_transactions").select("amount_cents").eq("user_id", userId).eq("status", "paid").gte("created_at", monthStart.toISOString());
  if (monthError) throw monthError;
  const thisMonthTotal = (monthPayouts ?? []).reduce((sum, row) => sum + Number(row.amount_cents ?? 0), 0);
  if (thisMonthTotal + amountCents > settings.maximumPayoutPerMonthCents) throw new Error("This request exceeds the monthly payout limit configured for the referral program.");
  const now = new Date().toISOString();
  const { data, error } = await db.from("payout_requests").insert({ user_id: userId, amount_cents: amountCents, paypal_email: payoutEmail, status: "pending", requested_at: now, created_at: now, updated_at: now }).select().single();
  if (error || !data) throw error ?? new Error("Unable to create payout request.");
  const { error: walletError } = await db.from("referral_wallets").update({ paypal_email: payoutEmail, updated_at: now }).eq("user_id", userId);
  if (walletError) throw walletError;
  await db.from("notifications").insert({ user_id: userId, type: "referral_payout_requested", title: "Payout request submitted", body: `Your referral payout request for $${money(amountCents).toFixed(2)} has been submitted for review.` });
  return data;
}

export async function handleSuccessfulReferralPayment(paymentId: string, details: { orderId: string; paymentSource?: string | null }) {
  const db = requireSupabase();
  const settings = await loadReferralSettings();
  if (!settings.enabled) return null;
  const { data: existing, error: existingError } = await db.from("referral_commissions").select("id").eq("payment_id", paymentId).maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;
  const { data: payment, error: paymentError } = await db.from("payments").select("id, user_id, amount_cents, status").eq("id", paymentId).single();
  if (paymentError || !payment || payment.status !== "completed") return null;
  const { data: referral, error: referralError } = await db.from("referrals").select("*").eq("referred_user_id", payment.user_id).maybeSingle();
  if (referralError) throw referralError;
  if (!referral) return null;
  if (!settings.allowSelfReferrals && referral.referrer_user_id === payment.user_id) { await db.from("referrals").update({ status: "flagged", updated_at: new Date().toISOString(), suspicion_flags: ["self_referral"] }).eq("id", referral.id); return null; }
  const wallet = await walletFor(referral.referrer_user_id, settings.minimumPayoutCents);
  const lifetime = Number(wallet.lifetime_earnings_cents ?? 0);
  const rawAmount = settings.defaultCommissionType === "flat" ? settings.flatCommissionCents : Math.round(Number(payment.amount_cents ?? 0) * (settings.defaultCommissionRate / 100));
  const cappedAmount = Math.max(0, Math.min(rawAmount, settings.maximumCommissionPerUserCents - lifetime));
  if (cappedAmount <= 0) return null;
  const now = new Date();
  const eligibleAt = new Date(now.getTime() + (settings.eligibilityDelayDays * 86_400_000));
  const { data: commission, error: commissionError } = await db.from("referral_commissions").insert({ referral_id: referral.id, referrer_user_id: referral.referrer_user_id, referred_user_id: referral.referred_user_id, payment_id: payment.id, purchase_amount_cents: Number(payment.amount_cents ?? 0), commission_type: settings.defaultCommissionType, commission_rate: settings.defaultCommissionType === "percentage" ? settings.defaultCommissionRate : null, commission_amount_cents: cappedAmount, status: "pending", eligible_at: eligibleAt.toISOString(), created_at: now.toISOString(), updated_at: now.toISOString() }).select().single();
  if (commissionError || !commission) throw commissionError ?? new Error("Unable to create referral commission.");
  const { error: walletError } = await db.from("referral_wallets").update({ pending_balance_cents: Number(wallet.pending_balance_cents ?? 0) + cappedAmount, lifetime_earnings_cents: lifetime + cappedAmount, updated_at: now.toISOString() }).eq("user_id", referral.referrer_user_id);
  if (walletError) throw walletError;
  await db.from("referrals").update({ status: "pending", payment_source: details.paymentSource ?? details.orderId, updated_at: now.toISOString() }).eq("id", referral.id);
  await db.from("notifications").insert([{ user_id: referral.referrer_user_id, type: "referral_purchase_pending", title: "Referral commission pending", body: `A new referral purchase created a pending commission of $${money(cappedAmount).toFixed(2)}.` }, { user_id: referral.referred_user_id, type: "referral_purchase_recorded", title: "Referral purchase recorded", body: "Your purchase has been linked to the original referral source." }]);
  await db.from("activity_log").insert({ user_id: referral.referrer_user_id, action: "referral_commission_created", entity_type: "referral_commission", entity_id: commission.id, metadata: { paymentId: payment.id, amountCents: cappedAmount } });
  return commission;
}

export async function handleReversedReferralPayment(paymentId: string, status: "cancelled" | "refunded") {
  const db = requireSupabase();
  const { data: commission, error } = await db.from("referral_commissions").select("*").eq("payment_id", paymentId).maybeSingle();
  if (error) throw error;
  if (!commission) return null;
  const wallet = await walletFor(commission.referrer_user_id);
  const amount = Number(commission.commission_amount_cents ?? 0);
  const now = new Date().toISOString();
  const nextPending = commission.status === "pending" ? Math.max(0, Number(wallet.pending_balance_cents ?? 0) - amount) : Number(wallet.pending_balance_cents ?? 0);
  const nextAvailable = commission.status === "eligible" ? Math.max(0, Number(wallet.available_balance_cents ?? 0) - amount) : Number(wallet.available_balance_cents ?? 0);
  const { error: updateError } = await db.from("referral_commissions").update({ status, updated_at: now }).eq("id", commission.id);
  if (updateError) throw updateError;
  const { error: walletError } = await db.from("referral_wallets").update({ pending_balance_cents: nextPending, available_balance_cents: nextAvailable, updated_at: now }).eq("user_id", commission.referrer_user_id);
  if (walletError) throw walletError;
  await db.from("referrals").update({ status, updated_at: now }).eq("id", commission.referral_id);
  await db.from("notifications").insert({ user_id: commission.referrer_user_id, type: "referral_commission_reversed", title: "Referral commission reversed", body: `A referral commission was marked ${status} after the related payment changed state.` });
  return commission;
}

export async function adminReferralOverview() {
  await releaseEligibleCommissions();
  const db = requireSupabase();
  const [referralsResult, commissionsResult, walletsResult, clicksResult, payoutsResult] = await Promise.all([db.from("referrals").select("*").order("created_at", { ascending: false }), db.from("referral_commissions").select("*").order("created_at", { ascending: false }), db.from("referral_wallets").select("*"), db.from("referral_clicks").select("*"), db.from("payout_transactions").select("*")]);
  [referralsResult, commissionsResult, walletsResult, clicksResult, payoutsResult].forEach((result) => { if (result.error) throw result.error; });
  const referrals = (referralsResult.data ?? []) as ReferralRow[];
  const commissions = (commissionsResult.data ?? []) as CommissionRow[];
  const wallets = walletsResult.data ?? [];
  const clicks = clicksResult.data ?? [];
  const payouts = payoutsResult.data ?? [];
  const thisMonth = new Date();
  thisMonth.setUTCDate(1);
  thisMonth.setUTCHours(0, 0, 0, 0);
  const monthlySignups = referrals.filter((row) => new Date(row.created_at) >= thisMonth).length;
  const monthlyPurchases = commissions.filter((row) => new Date(row.created_at) >= thisMonth).length;
  const paidCommissionCents = commissions.filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.commission_amount_cents ?? 0), 0);
  const pendingCommissionCents = commissions.filter((row) => row.status === "pending").reduce((sum, row) => sum + Number(row.commission_amount_cents ?? 0), 0);
  const availableCommissionCents = (wallets as Array<{ available_balance_cents?: number }>).reduce((sum, row) => sum + Number(row.available_balance_cents ?? 0), 0);
  const referralRevenueCents = commissions.reduce((sum, row) => sum + Number(row.purchase_amount_cents ?? 0), 0);
  const topReferrers = await adminReferrers();
  return { totalReferralRevenue: money(referralRevenueCents), totalCommissionsPaid: money(paidCommissionCents), pendingCommissions: money(pendingCommissionCents), availableCommissions: money(availableCommissionCents), topReferrers: topReferrers.slice(0, 5), conversionRate: referrals.length === 0 ? 0 : Number((commissions.length / referrals.length).toFixed(3)), totalReferralSignups: referrals.length, totalReferralPurchases: commissions.length, monthlyReferralGrowth: { signups: monthlySignups, purchases: monthlyPurchases, clicks: clicks.filter((row) => new Date(String(row.created_at ?? 0)) >= thisMonth).length }, totalPayouts: money((payouts as Array<{ amount_cents?: number; status?: string }>).filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.amount_cents ?? 0), 0)) };
}

export async function adminReferrers() {
  await releaseEligibleCommissions();
  const db = requireSupabase();
  const [profilesResult, walletsResult, referralsResult, commissionsResult, clicksResult] = await Promise.all([db.from("profiles").select("id, display_name, referral_code, referral_status").not("referral_code", "is", null), db.from("referral_wallets").select("*"), db.from("referrals").select("*"), db.from("referral_commissions").select("*"), db.from("referral_clicks").select("*")]);
  [profilesResult, walletsResult, referralsResult, commissionsResult, clicksResult].forEach((result) => { if (result.error) throw result.error; });
  const profiles = profilesResult.data ?? [];
  const wallets = new Map((walletsResult.data ?? []).map((row) => [String(row.user_id), row]));
  const referrals = referralsResult.data ?? [];
  const commissions = commissionsResult.data ?? [];
  const clicks = clicksResult.data ?? [];
  return profiles.map((profile) => { const userCommissions = commissions.filter((row) => row.referrer_user_id === profile.id); const wallet = wallets.get(String(profile.id)) as ReferralWallet | undefined; return { userId: profile.id, user: displayName(profile as ReferralProfile, "MidiFlow user"), referralCode: profile.referral_code, clicks: clicks.filter((row) => row.referrer_user_id === profile.id).length, signups: referrals.filter((row) => row.referrer_user_id === profile.id).length, paidReferrals: userCommissions.filter((row) => row.status === "paid").length, earnings: money(userCommissions.reduce((sum, row) => sum + Number(row.commission_amount_cents ?? 0), 0)), pending: money(Number(wallet?.pending_balance_cents ?? 0)), available: money(Number(wallet?.available_balance_cents ?? 0)), status: profile.referral_status ?? "active", wallet }; }).sort((left, right) => right.earnings - left.earnings);
}

export async function adminCommissions(filters: { status?: string; query?: string }) {
  await releaseEligibleCommissions();
  const db = requireSupabase();
  let query = db.from("referral_commissions").select("*").order("created_at", { ascending: false }).limit(200);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw error;
  const commissions = (data ?? []) as CommissionRow[];
  const referralsResult = await db.from("referrals").select("id, referral_code").in("id", commissions.map((row) => row.referral_id));
  if (referralsResult.error) throw referralsResult.error;
  const profiles = await profileMap([...new Set(commissions.flatMap((row) => [row.referrer_user_id, row.referred_user_id]))]);
  const referralCodes = new Map((referralsResult.data ?? []).map((row) => [String(row.id), String(row.referral_code)]));
  const rows = commissions.map((commission) => ({ id: commission.id, referralCode: referralCodes.get(commission.referral_id) ?? "", referrer: displayName(profiles.get(commission.referrer_user_id), "Referrer"), referred: displayName(profiles.get(commission.referred_user_id), "Referred user"), purchaseAmount: money(commission.purchase_amount_cents), commissionAmount: money(commission.commission_amount_cents), status: commission.status, eligibleAt: commission.eligible_at, createdAt: commission.created_at }));
  if (!filters.query?.trim()) return rows;
  const needle = filters.query.trim().toLowerCase();
  return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
}

export async function adminPayoutRequests() {
  const { data, error } = await requireSupabase().from("payout_requests").select("*").order("requested_at", { ascending: false }).limit(200);
  if (error) throw error;
  const requests = data ?? [];
  const profiles = await profileMap([...new Set(requests.map((row) => String(row.user_id)))]);
  return requests.map((request) => ({ ...request, user: displayName(profiles.get(String(request.user_id)), "MidiFlow user") }));
}

export async function adminPayoutHistory() {
  const { data, error } = await requireSupabase().from("payout_transactions").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  const rows = data ?? [];
  const profiles = await profileMap([...new Set(rows.map((row) => String(row.user_id)))]);
  return rows.map((row) => ({ ...row, user: displayName(profiles.get(String(row.user_id)), "MidiFlow user") }));
}

export async function updateReferralSettings(input: Partial<ReferralSettings>) {
  const current = await loadReferralSettings();
  const next = { ...current, ...input };
  const { data, error } = await requireSupabase().from("system_settings").upsert({ key: "referral_program_config", value: next }).select().single();
  if (error) throw error;
  return data?.value ?? next;
}

export async function approvePayoutRequest(requestId: string, actorId: string, sendPayout: (input: { senderBatchId: string; receiver: string; amountValue: string; currency: string; note: string }) => Promise<{ payoutBatchId?: string | null; payoutItemId?: string | null; batchStatus?: string | null }>) {
  await releaseEligibleCommissions();
  const db = requireSupabase();
  const { data: request, error } = await db.from("payout_requests").select("*").eq("id", requestId).single();
  if (error || !request) throw error ?? new Error("Payout request not found.");
  if (request.status !== "pending") throw new Error("Only pending payout requests can be approved.");
  const wallet = await walletFor(String(request.user_id));
  if (Number(request.amount_cents ?? 0) > Number(wallet.available_balance_cents ?? 0)) throw new Error("Referral wallet does not have enough available balance.");
  const payout = await sendPayout({ senderBatchId: `midiflow-${request.id}`, receiver: String(request.paypal_email), amountValue: (Number(request.amount_cents ?? 0) / 100).toFixed(2), currency: "USD", note: "MidiFlow referral payout" });
  const now = new Date().toISOString();
  const { data: transaction, error: transactionError } = await db.from("payout_transactions").insert({ payout_request_id: request.id, user_id: request.user_id, amount_cents: request.amount_cents, paypal_email: request.paypal_email, paypal_payout_id: payout.payoutBatchId ?? null, paypal_transaction_id: payout.payoutItemId ?? null, status: "paid", processed_by: actorId, processed_at: now }).select().single();
  if (transactionError || !transaction) throw transactionError ?? new Error("Unable to record payout transaction.");
  const { error: requestError } = await db.from("payout_requests").update({ status: "paid", processed_at: now, processed_by: actorId, updated_at: now }).eq("id", request.id);
  if (requestError) throw requestError;
  const { error: walletError } = await db.from("referral_wallets").update({ available_balance_cents: Number(wallet.available_balance_cents ?? 0) - Number(request.amount_cents ?? 0), last_payout_at: now, paypal_email: request.paypal_email, updated_at: now }).eq("user_id", request.user_id);
  if (walletError) throw walletError;
  const { error: commissionError } = await db.from("referral_commissions").update({ status: "paid", payout_request_id: request.id, payout_transaction_id: transaction.id, updated_at: now }).eq("referrer_user_id", request.user_id).eq("status", "eligible");
  if (commissionError) throw commissionError;
  await db.from("notifications").insert({ user_id: request.user_id, type: "referral_payout_paid", title: "Referral payout completed", body: `Your referral payout of $${money(Number(request.amount_cents ?? 0)).toFixed(2)} has been sent to PayPal.` });
  return transaction;
}

export async function rejectPayoutRequest(requestId: string, actorId: string, notes?: string) {
  const db = requireSupabase();
  const { data: request, error } = await db.from("payout_requests").select("*").eq("id", requestId).single();
  if (error || !request) throw error ?? new Error("Payout request not found.");
  if (request.status !== "pending") throw new Error("Only pending payout requests can be rejected.");
  const now = new Date().toISOString();
  const { error: updateError } = await db.from("payout_requests").update({ status: "rejected", notes: notes ?? null, processed_by: actorId, processed_at: now, updated_at: now }).eq("id", request.id);
  if (updateError) throw updateError;
  await db.from("notifications").insert({ user_id: request.user_id, type: "referral_payout_rejected", title: "Referral payout rejected", body: notes?.trim() || "Your payout request was rejected. Review your wallet and contact support if you need more detail." });
  return { ok: true };
}