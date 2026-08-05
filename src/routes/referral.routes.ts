import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import * as referral from "../controllers/referral.controller.js";

export const referralRouter = Router();

referralRouter.post("/referrals/click", referral.click);
referralRouter.get("/referrals", requireAuth, referral.dashboard);
referralRouter.get("/referrals/stats", requireAuth, referral.stats);
referralRouter.get("/referrals/activity", requireAuth, referral.activity);
referralRouter.post("/referrals/copy", requireAuth, referral.copy);
referralRouter.post("/referrals/share", requireAuth, referral.share);
referralRouter.post("/referrals/payout-request", requireAuth, referral.payoutRequest);

referralRouter.get("/admin/referrals", requireAuth, requireAdmin, referral.adminReferrerList);
referralRouter.get("/admin/referrals/overview", requireAuth, requireAdmin, referral.adminOverview);
referralRouter.get("/admin/referrals/commissions", requireAuth, requireAdmin, referral.adminCommissionList);
referralRouter.get("/admin/referrals/payouts", requireAuth, requireAdmin, referral.adminPayoutRequestList);
referralRouter.get("/admin/referrals/payout-history", requireAuth, requireAdmin, referral.adminPayoutHistoryList);
referralRouter.get("/admin/referrals/settings", requireAuth, requireAdmin, referral.adminSettingsGet);
referralRouter.post("/admin/referrals/payouts/approve", requireAuth, requireAdmin, referral.adminApprovePayout);
referralRouter.post("/admin/referrals/payouts/reject", requireAuth, requireAdmin, referral.adminRejectPayout);
referralRouter.post("/admin/referrals/settings", requireAuth, requireAdmin, referral.adminSettings);