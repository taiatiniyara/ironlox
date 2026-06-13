"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { useRecoverMutation } from "@/hooks/mutations/use-recover";
import { AuthFormCard } from "@/components/shared/auth-form-card";
import { FormField } from "@/components/shared/form-field";
import { LoadingButton } from "@/components/shared/loading-button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { deriveEncryptionKey, unwrapVaultKey, decryptVault, hexToBytes } from "@ironlox/crypto";

export default function RecoverPage() {
  usePageTitle("Recover Account");
  const { t } = useTranslation();
  const { apiClient } = useVault();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [newMasterPassword, setNewMasterPassword] = useState("");
  const [step, setStep] = useState<"recover" | "newPassword">("recover");
  const [loading, setLoading] = useState(false);
  const [recoveryData, setRecoveryData] = useState<{
    encryptionSalt: string;
    wrappedVaultKey: string;
    accessToken: string;
    refreshToken: string;
  } | null>(null);

  const recoverMutation = useRecoverMutation();

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    if (!apiClient) return;
    recoverMutation.mutate(
      { recoveryKey: key, email },
      {
        onSuccess: (response) => {
          if (response.encryptionSalt && response.wrappedVaultKey) {
            setRecoveryData({
              encryptionSalt: response.encryptionSalt,
              wrappedVaultKey: response.wrappedVaultKey,
              accessToken: response.accessToken,
              refreshToken: response.refreshToken,
            });
            setStep("newPassword");
            toast.success(t("recovery.recoveredSetPassword"));
          } else {
            toast.success(t("recovery.recovered"));
            localStorage.setItem("ironlox_access_token", response.accessToken);
            localStorage.setItem("ironlox_refresh_token", response.refreshToken);
            localStorage.setItem("ironlox_email", email);
            router.push("/vault");
          }
        },
        onError: (err) => {
          const apiErr = err as { message?: string };
          toast.error(apiErr.message ?? t("recovery.invalidKey"));
        },
      },
    );
  }

  async function handleSetNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!apiClient || !recoveryData || !newMasterPassword) return;
    setLoading(true);
    try {
      const encryptionKey = await deriveEncryptionKey(
        newMasterPassword,
        hexToBytes(recoveryData.encryptionSalt),
      );
      const vaultKey = await unwrapVaultKey(recoveryData.wrappedVaultKey, encryptionKey);

      const blob = await apiClient.getVaultBlob().catch(() => null);
      if (blob) {
        await decryptVault(blob, vaultKey);
      }

      localStorage.setItem("ironlox_access_token", recoveryData.accessToken);
      localStorage.setItem("ironlox_refresh_token", recoveryData.refreshToken);
      localStorage.setItem("ironlox_email", email);
      router.push("/vault");
      toast.success(t("recovery.recoveredUnlocked"));
    } catch (err) {
      const apiErr = err as { message?: string };
      toast.error(apiErr.message ?? t("recovery.recoveryFailed"));
    } finally {
      setLoading(false);
    }
  }

  if (step === "newPassword") {
    return (
      <AuthFormCard
        title={t("recovery.setNewTitle")}
        description={t("recovery.setNewDesc")}
        icon={Shield}
        onSubmit={handleSetNewPassword}
        footer={
          <p className="pt-4 text-center text-xs text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              {t("recovery.backToSignIn")}
            </Link>
          </p>
        }
      >
        <FormField id="newPassword" label={t("recovery.newMasterPassword")}>
          <Input
            id="newPassword"
            type="password"
            required
            value={newMasterPassword}
            onChange={(e) => setNewMasterPassword(e.target.value)}
            placeholder={t("recovery.newPasswordPlaceholder")}
          />
        </FormField>
        <LoadingButton
          type="submit"
          className="w-full"
          loading={loading}
          loadingText={t("recovery.settingPassword")}
          disabled={newMasterPassword.length < 8}
        >
          {t("recovery.setNewPassword")}
        </LoadingButton>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard
      title={t("recovery.title")}
      description={t("recovery.desc")}
      icon={Shield}
      onSubmit={handleRecover}
      footer={
        <p className="pt-4 text-center text-xs text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            {t("recovery.backToSignIn")}
          </Link>
        </p>
      }
    >
      <FormField id="email" label={t("auth.email")}>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.emailPlaceholder")}
        />
      </FormField>
      <FormField id="key" label={t("recovery.recoveryKey")}>
        <Input
          id="key"
          required
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t("recovery.recoveryKeyPlaceholder")}
          className="font-mono text-xs"
        />
      </FormField>
      <LoadingButton
        type="submit"
        className="w-full"
        loading={recoverMutation.isPending}
        loadingText={t("recovery.recovering")}
        disabled={key.length < 32}
      >
        {t("recovery.recover")}
      </LoadingButton>
    </AuthFormCard>
  );
}
