"use client";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePageTitle } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function PasskeyPage() {
  usePageTitle("Passkey");
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/settings")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold">{t("passkey.title")}</h1>
      </div>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto rounded-full bg-primary/10 p-3 mb-2">
            <Fingerprint className="size-6 text-primary" />
          </div>
          <CardTitle>{t("passkey.registerTitle")}</CardTitle>
          <CardDescription>{t("passkey.registerDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => toast.info(t("passkey.comingSoon"))}>
            <Fingerprint className="size-4 mr-2" /> {t("passkey.register")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
