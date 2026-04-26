/**
 * Module-level store for pending webhook responses.
 * Auth Webhook stores the Express response object here (keyed by a unique request ID).
 * "Respond to Auth Webhook" retrieves it and sends the final response.
 *
 * NOTE: This works when webhook handler and workflow nodes run in the same process.
 * In n8n queue mode with separate webhook workers, use "When Last Node Finishes" instead.
 */

// Use generic type to avoid requiring @types/express as a dependency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResponseObject = any;

const pending = new Map<string, { resp: ResponseObject; timer: ReturnType<typeof setTimeout> }>();

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function storeResponse(id: string, resp: ResponseObject): void {
	// Auto-cleanup after timeout to prevent memory leaks
	const timer = setTimeout(() => {
		const entry = pending.get(id);
		if (entry) {
			try { entry.resp.status(504).json({ error: 'Gateway Timeout' }); } catch { /* already sent */ }
			pending.delete(id);
		}
	}, TIMEOUT_MS);
	pending.set(id, { resp, timer });
}

export function consumeResponse(id: string): ResponseObject | undefined {
	const entry = pending.get(id);
	if (!entry) return undefined;
	clearTimeout(entry.timer);
	pending.delete(id);
	return entry.resp;
}
