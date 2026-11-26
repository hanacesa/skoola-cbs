import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { signIn } from "@/lib/auth.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign In — CBS Core Ledger" },
      {
        name: "description",
        content:
          "Secure staff sign-in for the CBS core banking and e-wallet control plane.",
      },
      { property: "og:title", content: "Staff Sign In — CBS Core Ledger" },
      {
        property: "og:description",
        content: "Secure staff sign-in for the CBS core banking control plane.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const login = useServerFn(signIn);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/" });
  }, [loading, user, navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await login({ data: { username: email.trim(), password } });
      await qc.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="panel w-full max-w-sm p-6">
        <p className="figure text-sm font-semibold tracking-tight text-primary">
          CBS · CORE LEDGER
        </p>
        <h1 className="mt-2 text-lg font-semibold">
          Staff sign in
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Access is restricted to authorised banking operations staff.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Username or work email</Label>
            <Input
              id="email"
              type="text"
              placeholder="admin"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {message ? <p className="text-xs text-warning">{message}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : "Sign in"}
          </Button>
        </form>
        <Link
          to="/demo-wallet"
          className="mt-4 block text-center text-xs text-primary hover:underline"
        >
          Test senangPay with a demo wallet (no sign-in)
        </Link>
      </div>
    </div>
  );
}
