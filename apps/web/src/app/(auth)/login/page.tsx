"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
  usePageTitle("Sign In");
  const { t } = useTranslation();
  const { login } = useVault();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const mfaRequired = await login(email, masterPassword);
      if (mfaRequired) {
        sessionStorage.setItem("ironlox_mfa_email", email);
        router.push("/mfa");
        return;
      }
      toast.success(t("auth.vaultUnlocked"));
      router.push("/vault");
    } catch (err) {
      const apiErr = err as { message?: string };
      const msg = apiErr.message ?? t("auth.invalidEmailOrPassword");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{t("auth.signIn")}</CardTitle>
        <CardDescription>{t("app.tagline")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.masterPassword")}</Label>
            <Input
              id="password"
              type="password"
              required
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("auth.unlocking") : t("auth.unlockVault")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link href="/signup" className="text-primary hover:underline">
              {t("auth.createOne")}
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Lost your master password?{" "}
            <Link href="/recover" className="text-primary hover:underline">
              Use recovery key
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
