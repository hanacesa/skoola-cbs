import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * senangPay (DOKU) sandbox calls for the browser demo wallet. Uses the same
 * sandbox Client ID / Secret Key as the seeded SENANGPAY provider, without
 * needing MySQL. Sandbox only — no real money moves.
 */
const SANDBOX_BASE = "https://api-sandbox.doku.com";

async function signedHeaders(target: string, body: string | null) {
  const { createHash, createHmac, randomUUID } = await import("crypto");
  const clientId = process.env["SENANGPAY_SANDBOX_CLIENT_ID"] || "BRN-0221-1790574635839";
  const secret = process.env["SENANGPAY_SANDBOX_SECRET_KEY"] || "SK-lywUjepVfcjf1mnFnk0E";
  const requestId = randomUUID();
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  let component = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${target}`;
  if (body !== null) component += `\nDigest:${createHash("sha256").update(body).digest("base64")}`;
  const signature = createHmac("sha256", secret).update(component).digest("base64");
  return {
    "Client-Id": clientId,
    "Request-Id": requestId,
    "Request-Timestamp": timestamp,
    Signature: `HMACSHA256=${signature}`,
    "Content-Type": "application/json",
  };
}

export const startDemoReload = createServerFn({ method: "POST" })
  .inputValidator((input: { amount: number; returnUrl: string; name: string; email: string; phone: string }) =>
    z
      .object({
        amount: z.number().min(1).max(1000),
        returnUrl: z.string().url().max(500),
        name: z.string().trim().min(1).max(80),
        email: z.string().trim().email().max(120),
        phone: z.string().trim().min(6).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const invoice = `DEMO-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1e6)}`;
    const target = "/checkout/v1/payment";
    const body = JSON.stringify({
      order: {
        amount: Number(data.amount.toFixed(2)),
        invoice_number: invoice,
        currency: "MYR",
        callback_url: `${data.returnUrl}${data.returnUrl.includes("?") ? "&" : "?"}invoice=${encodeURIComponent(invoice)}`,
      },
      payment: { payment_due_date: 60 },
      customer: { name: data.name, email: data.email, phone: data.phone },
    });
    const res = await fetch(`${SANDBOX_BASE}${target}`, { method: "POST", headers: await signedHeaders(target, body), body });
    const json = (await res.json().catch(() => ({}))) as {
      message?: string[];
      response?: { payment?: { url?: string } };
    };
    const url = json.response?.payment?.url ?? null;
    if (!res.ok || !url) {
      return { ok: false as const, error: json.message?.join(", ") || `senangPay sandbox answered HTTP ${res.status}` };
    }
    return { ok: true as const, invoice, checkoutUrl: url };
  });

export const checkDemoReload = createServerFn({ method: "POST" })
  .inputValidator((input: { invoice: string }) =>
    z.object({ invoice: z.string().regex(/^DEMO-[A-Z0-9-]+$/).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const target = `/orders/v1/status/${data.invoice}`;
    const res = await fetch(`${SANDBOX_BASE}${target}`, { headers: await signedHeaders(target, null) });
    const json = (await res.json().catch(() => ({}))) as { transaction?: { status?: string } };
    const raw = String(json.transaction?.status ?? "PENDING").toUpperCase();
    const status: "PENDING" | "SUCCESS" | "FAILED" =
      raw === "SUCCESS" ? "SUCCESS" : ["FAILED", "EXPIRED", "CANCELLED"].includes(raw) ? "FAILED" : "PENDING";
    return { status, providerStatus: raw };
  });
