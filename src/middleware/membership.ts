import type { NextFunction, Response } from "express";
import type { AuthRequest } from "./auth.js";
import { assertActiveMembership } from "../services/membership.service.js";
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
