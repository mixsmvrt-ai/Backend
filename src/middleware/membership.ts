import type { NextFunction, Response } from "express";
import type { AuthRequest } from "./auth.js";
import { assertActiveMembership, assertPlusMembership } from "../services/membership.service.js";
export async function requireActiveMembership(request: AuthRequest, response: Response, next: NextFunction) {
	try {
		await assertActiveMembership(request.user!.id);
		next();
	} catch (error) {
		const typed = error as { statusCode?: number; code?: string; redirectTo?: string; membership?: unknown };
		const status = typed.statusCode ?? 500;
		response.status(status).json({
			error: error instanceof Error ? error.message : "Unable to validate membership",
			code: typed.code ?? (status === 403 ? "MEMBERSHIP_EXPIRED" : "MEMBERSHIP_CHECK_FAILED"),
			redirectTo: typed.redirectTo,
			membership: typed.membership,
		});
	}
}

export async function requirePlusMembership(request: AuthRequest, response: Response, next: NextFunction) {
	try {
		await assertPlusMembership(request.user!.id);
		next();
	} catch (error) {
		const typed = error as { statusCode?: number; code?: string; membership?: unknown };
		response.status(typed.statusCode ?? 403).json({ error: error instanceof Error ? error.message : "The Plus plan is required", code: typed.code ?? "PLUS_PLAN_REQUIRED", membership: typed.membership });
	}
}
