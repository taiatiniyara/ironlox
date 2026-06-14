"use client";

import { useState } from "react";
import { useAccountQuery } from "@/hooks/queries/use-account";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Crown, ExternalLink, HardDrive, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type BillingCycle = "monthly" | "annual";

export default function BillingPage() {
  usePageTitle("Billing");
  const router = useRouter();
  const { apiClient } = useVault();

  const { data: account, isLoading } = useAccountQuery();
  const [cycle, setCycle] = useState<BillingCycle>("annual");
  const [upgrading, setUpgrading] = useState(false);
  const [managing, setManaging] = useState(false);

  async function handleUpgrade() {
    if (!apiClient) return;
    setUpgrading(true);
    try {
      const { url } = await apiClient.createCheckoutSession(cycle);
      window.location.href = url;
    } catch {
      toast("Failed to start checkout. Please try again.");
      setUpgrading(false);
    }
  }

  async function handleManage() {
    if (!apiClient) return;
    setManaging(true);
    try {
      const { url } = await apiClient.createPortalSession();
      window.location.href = url;
    } catch {
      toast("Failed to open subscription portal. Please try again.");
      setManaging(false);
    }
  }

  const price = cycle === "monthly" ? "$4" : "$3";
  const period = cycle === "monthly" ? "month" : "month";
  const saveText = cycle === "annual" ? "Save 25% ($36/yr)" : null;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/settings")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold">Billing & Plan</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : account ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Crown className="size-4 text-yellow-500" />
                Current Plan
              </CardTitle>
              <CardDescription>
                {account.tier === "premium"
                  ? "You are on the Premium plan."
                  : "You are on the Free plan."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Plan</span>
                <span className="text-sm font-medium capitalize">{account.tier}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm">Price</span>
                <span className="text-sm text-muted-foreground">
                  {account.tier === "premium" ? "$3/month (annual)" : "Free"}
                </span>
              </div>
            </CardContent>
          </Card>

          {account.tier === "free" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upgrade to Premium</CardTitle>
                <CardDescription>
                  All premium features, priority support, and more storage.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Billing cycle toggle */}
                <div className="flex items-center justify-center gap-2">
                  <div className="inline-flex rounded-lg bg-muted p-1">
                    <button
                      type="button"
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        cycle === "monthly"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                      onClick={() => setCycle("monthly")}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        cycle === "annual"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                      onClick={() => setCycle("annual")}
                    >
                      Annual
                    </button>
                  </div>
                </div>

                {/* Price display */}
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {price}
                    <span className="text-base font-normal text-muted-foreground">/{period}</span>
                  </p>
                  {saveText && (
                    <Badge variant="secondary" className="mt-1">
                      {saveText}
                    </Badge>
                  )}
                </div>

                <Button className="w-full gap-2" onClick={handleUpgrade} disabled={upgrading}>
                  <Crown className="size-4" />
                  {upgrading ? "Redirecting to checkout..." : `Upgrade to Premium`}
                </Button>
              </CardContent>
            </Card>
          )}

          {account.tier === "premium" && (
            <Card>
              <CardContent className="pt-6">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleManage}
                  disabled={managing}
                >
                  <ExternalLink className="size-4" />
                  {managing ? "Opening portal..." : "Manage Subscription"}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Manage billing, payment methods, and invoices via Stripe.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="size-4" />
                Usage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>File Storage</span>
                  <span>
                    {account.attachmentUsed}MB / {account.attachmentQuota}MB
                  </span>
                </div>
                <Progress
                  value={
                    account.attachmentQuota > 0
                      ? (account.attachmentUsed / account.attachmentQuota) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>
              <Separator />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="size-4" />
                Plan Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Unlimited passwords</span>
                  <span className="text-green-500">&#x2713;</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span>TOTP 2FA codes</span>
                  <span
                    className={
                      account.tier === "premium" ? "text-green-500" : "text-muted-foreground"
                    }
                  >
                    {account.tier === "premium" ? "\u2713" : "Premium"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span>HIBP breach monitoring</span>
                  <span
                    className={
                      account.tier === "premium" ? "text-green-500" : "text-muted-foreground"
                    }
                  >
                    {account.tier === "premium" ? "\u2713" : "Premium"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span>File attachments (2GB)</span>
                  <span
                    className={
                      account.tier === "premium" ? "text-green-500" : "text-muted-foreground"
                    }
                  >
                    {account.tier === "premium" ? "\u2713" : "Premium"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span>Priority support</span>
                  <span
                    className={
                      account.tier === "premium" ? "text-green-500" : "text-muted-foreground"
                    }
                  >
                    {account.tier === "premium" ? "\u2713" : "Premium"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
