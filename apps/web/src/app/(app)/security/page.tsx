"use client";

import { useMemo, useState, useCallback } from "react";
import { useVault } from "@/lib/vault-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle,
  CheckCircle2, Key, Clock, Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface LoginItem { id: string; name: string; password: string; username: string; updatedAt: string; hasTotp: boolean; }

async function sha1(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function checkHibp(password: string): Promise<number> {
  const hash = await sha1(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  if (!res.ok) return 0;
  const text = await res.text();
  const lines = text.split("\n");
  for (const line of lines) {
    const [h, count] = line.split(":");
    if (h?.trim() === suffix) return parseInt(count ?? "0", 10);
  }
  return 0;
}

export default function SecurityPage() {
  const { vault } = useVault();
  const [hibpRunning, setHibpRunning] = useState(false);
  const [hibpResults, setHibpResults] = useState<Array<{ name: string; count: number }>>([]);
  const [hibpDone, setHibpDone] = useState(false);

  const logins = useMemo((): LoginItem[] => {
    if (!vault) return [];
    return vault.items.filter((i) => !i.deleted && i.type === "login").map((i) => {
      const f = i.fields as Record<string, unknown>;
      return { id: i.id, name: i.name, password: (f.password as string) ?? "", username: (f.username as string) ?? "", updatedAt: i.updatedAt, hasTotp: !!f.totpSecret };
    });
  }, [vault]);

  const { weak, reused, old, missing2fa } = useMemo(() => {
    const weak: LoginItem[] = []; const reused: LoginItem[] = []; const old: LoginItem[] = []; const missing2fa: LoginItem[] = [];
    const seenPasswords = new Map<string, string>();
    for (const login of logins) {
      if (!login.password) continue;
      const length = login.password.length;
      const hasUpper = /[A-Z]/.test(login.password); const hasLower = /[a-z]/.test(login.password);
      const hasDigit = /[0-9]/.test(login.password); const hasSymbol = /[^A-Za-z0-9]/.test(login.password);
      const variety = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;
      if (length < 8 || variety < 3) weak.push(login);
      if (seenPasswords.has(login.password)) reused.push(login);
      seenPasswords.set(login.password, login.name);
      const ageDays = (Date.now() - new Date(login.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 730) old.push(login);
      if (!login.hasTotp) missing2fa.push(login);
    }
    return { weak, reused, old, missing2fa };
  }, [logins]);

  const total = logins.length || 1;
  const issues = weak.length + reused.length + old.length + missing2fa.length + (hibpResults.length > 0 ? hibpResults.length : 0);
  const maxIssues = total * 5;
  const score = Math.max(0, Math.round(100 - (issues / maxIssues) * 100));

  const runHibpCheck = useCallback(async () => {
    setHibpRunning(true);
    setHibpDone(false);
    const results: Array<{ name: string; count: number }> = [];
    let checked = 0;
    for (const login of logins) {
      if (!login.password) continue;
      try {
        const count = await checkHibp(login.password);
        if (count > 0) results.push({ name: login.name, count });
      } catch { /* skip network errors */ }
      checked++;
      if (checked % 5 === 0) {
        setHibpResults([...results]);
      }
      await new Promise((r) => setTimeout(r, 1600)); // rate limit: ~1 req/sec
    }
    setHibpResults(results);
    setHibpRunning(false);
    setHibpDone(true);
    if (results.length === 0) toast.success("No breaches found");
    else toast.warning(`${results.length} passwords found in breaches`);
  }, [logins]);

  if (!vault || logins.length === 0) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <h1 className="text-xl font-semibold mb-4">Security Dashboard</h1>
        <Card><CardContent className="py-8 text-center"><ShieldCheck className="size-10 text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">Add some login items to see your vault health report.</p></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Security Dashboard</h1>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`rounded-full p-3 ${score >= 80 ? "bg-green-500/10" : score >= 50 ? "bg-yellow-500/10" : "bg-red-500/10"}`}>
              {score >= 80 ? <ShieldCheck className="size-6 text-green-500" /> : score >= 50 ? <ShieldAlert className="size-6 text-yellow-500" /> : <ShieldX className="size-6 text-red-500" />}
            </div>
            <div><p className="text-2xl font-bold">{score}%</p><p className="text-xs text-muted-foreground">Vault Health Score</p></div>
          </div>
          <Progress value={score} />
          <p className="text-xs text-muted-foreground mt-2">Based on {logins.length} login {logins.length === 1 ? "item" : "items"}</p>
        </CardContent>
      </Card>

      {weak.length > 0 && <IssueCard icon={AlertTriangle} color="yellow" title="Weak Passwords" count={weak.length} items={weak.map((l) => `${l.name} (${l.password.length} chars)`)} />}
      {reused.length > 0 && <IssueCard icon={Key} color="red" title="Reused Passwords" count={reused.length} items={reused.map((l) => l.name)} />}
      {old.length > 0 && <IssueCard icon={Clock} color="yellow" title="Aging Passwords" count={old.length} items={old.map((l) => `${l.name} (not changed in >2 years)`)} />}
      {missing2fa.length > 0 && <IssueCard icon={ShieldAlert} color="yellow" title="Missing 2FA" count={missing2fa.length} items={missing2fa.map((l) => l.name)} />}
      {hibpResults.length > 0 && <IssueCard icon={AlertTriangle} color="red" title="Found in Breaches" count={hibpResults.length} items={hibpResults.map((r) => `${r.name} (${r.count.toLocaleString()} times)`)} />}

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="size-4 text-yellow-500" />Breach Check</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">Check passwords against Have I Been Pwned using k-anonymity (passwords never leave your device).</p>
          {hibpDone && hibpResults.length === 0 && <p className="text-xs text-green-600 mb-2">All passwords are safe. No breaches found.</p>}
          <Button variant="outline" size="sm" className="w-full" onClick={runHibpCheck} disabled={hibpRunning}>
            {hibpRunning ? <><Loader2 className="size-3.5 mr-1 animate-spin" />Checking...</> : hibpDone ? "Re-run Breach Check" : "Run Breach Check"}
          </Button>
        </CardContent>
      </Card>

      {issues === 0 && hibpDone && (
        <Card><CardContent className="py-6 text-center"><CheckCircle2 className="size-10 text-green-500 mx-auto mb-3" /><p className="text-sm font-medium">Your vault looks great!</p><p className="text-xs text-muted-foreground">All passwords are strong, unique, and not found in breaches.</p></CardContent></Card>
      )}
    </div>
  );
}

function IssueCard({ icon: Icon, color, title, count, items }: { icon: React.ComponentType<{ className?: string }>; color: "red" | "yellow"; title: string; count: number; items: string[]; }) {
  const colorIcon = color === "red" ? "text-red-500" : "text-yellow-500";
  return (
    <Card className={`border-l-4 ${color === "red" ? "border-l-red-500" : "border-l-yellow-500"}`}>
      <CardHeader className="pb-2"><div className="flex items-center gap-2"><Icon className={`size-4 ${colorIcon}`} /><CardTitle className="text-sm">{title}</CardTitle><Badge variant="secondary" className="ml-auto">{count}</Badge></div></CardHeader>
      <CardContent><ul className="space-y-1">{items.slice(0, 5).map((item, i) => (<li key={i} className="text-xs text-muted-foreground">{item}</li>))}{items.length > 5 && (<li className="text-xs text-muted-foreground">...and {items.length - 5} more</li>)}</ul></CardContent>
    </Card>
  );
}
