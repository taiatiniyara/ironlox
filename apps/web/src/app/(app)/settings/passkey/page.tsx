"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePageTitle } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function PasskeyPage() {
  usePageTitle("Passkey");
  const router = useRouter();
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/settings")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold">Passkeys</h1>
      </div>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto rounded-full bg-primary/10 p-3 mb-2">
            <Fingerprint className="size-6 text-primary" />
          </div>
          <CardTitle>Register a Passkey</CardTitle>
          <CardDescription>
            Use biometrics or a hardware security key for faster login and MFA verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => toast.info("Passkey support coming soon.")}>
            <Fingerprint className="size-4 mr-2" /> Register Passkey
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
