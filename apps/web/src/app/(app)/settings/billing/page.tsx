"use client";

import { useAccountQuery } from "@/hooks/queries/use-account";
import { usePageTitle } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Crown, ExternalLink, HardDrive, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function BillingPage() {
  usePageTitle("Billing");
  const router = useRouter();

  const { data: account, isLoading } = useAccountQuery();

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
          <Skeleton className="h-24 w-full" />
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
              {account.tier === "free" && (
                <Button
                  className="w-full gap-2"
                  onClick={() => toast("Premium upgrades coming soon")}
                >
                  <Crown className="size-4" />
                  Upgrade to Premium
                </Button>
              )}
              {account.tier === "premium" && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => toast("Stripe portal coming soon")}
                >
                  <ExternalLink className="size-4" />
                  Manage Subscription
                </Button>
              )}
            </CardContent>
          </Card>

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
