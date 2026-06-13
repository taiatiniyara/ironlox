"use client";

import { useVault } from "@/lib/vault-context";
import { useLoginEventsQuery } from "@/hooks/queries/use-login-events";
import { useChangeEmailMutation } from "@/hooks/mutations/use-change-email";
import { useChangePasswordMutation } from "@/hooks/mutations/use-change-password";
import { useDeleteAccountMutation } from "@/hooks/mutations/use-delete-account";
import { useMfaEnableMutation } from "@/hooks/mutations/use-mfa-enable";
import { useMfaDisableMutation } from "@/hooks/mutations/use-mfa-disable";
import Link from "next/link";
import { usePageTitle } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { FormField } from "@/components/shared/form-field";
import { FormDialog } from "@/components/shared/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Moon,
  Sun,
  Monitor,
  Trash2,
  Shield,
  Key,
  Mail,
  Clock,
  QrCode,
  Download,
  Crown,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  generateSalt,
  deriveAuthHash,
  deriveEncryptionKey,
  wrapVaultKey,
  generateRecoveryKey,
  generateTotpSecret,
  verifyTotp,
  generateTotpUri,
  toHex,
  exportVaultToCsv,
} from "@ironlox/crypto";

const PREF_KEYS = {
  vaultTimeout: "ironlox_vault_timeout",
  clipboardClear: "ironlox_clipboard_clear",
} as const;

function loadPref(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

function savePref(key: string, value: string) {
  localStorage.setItem(key, value);
}

export default function SettingsPage() {
  const { t } = useTranslation();
  usePageTitle(t("settings.title"));
  const { email, logout, vaultKey } = useVault();
  const { theme, setTheme } = useTheme();
  const [vaultTimeout, setVaultTimeout] = useState(() => loadPref(PREF_KEYS.vaultTimeout, "5min"));
  const [clipboardClear, setClipboardClear] = useState(() =>
    loadPref(PREF_KEYS.clipboardClear, "60s"),
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  const [passOpen, setPassOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");

  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaQrDataUrl, setMfaQrDataUrl] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const { data: loginEvents = [] } = useLoginEventsQuery();

  const changeEmailMutation = useChangeEmailMutation();
  const changePasswordMutation = useChangePasswordMutation();
  const deleteAccountMutation = useDeleteAccountMutation();
  const mfaEnableMutation = useMfaEnableMutation();
  const mfaDisableMutation = useMfaDisableMutation();

  useEffect(() => {
    const stored = localStorage.getItem("ironlox_recovery_key");
    if (stored) setRecoveryKey(stored);
  }, []);

  function handleVaultTimeout(v: string) {
    setVaultTimeout(v);
    savePref(PREF_KEYS.vaultTimeout, v);
    toast.success(t("settings.autoLockUpdated"));
  }
  function handleClipboardClear(v: string) {
    setClipboardClear(v);
    savePref(PREF_KEYS.clipboardClear, v);
    toast.success(t("settings.clipboardUpdated"));
  }

  function handleDelete() {
    deleteAccountMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("settings.deleteInitiated"));
        setTimeout(() => logout(), 1500);
      },
      onError: () => toast.error(t("settings.deleteFailed")),
      onSettled: () => setDeleteOpen(false),
    });
  }

  function handleRegenerateKey() {
    setRegenerating(true);
    const newKey = generateRecoveryKey();
    localStorage.setItem("ironlox_recovery_key", newKey);
    setRecoveryKey(newKey);
    setShowKey(true);
    setRegenerating(false);
    toast.success(t("settings.recoveryGenerated"));
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail || !emailPassword) return;
    const salt = generateSalt();
    const authHashRaw = await deriveAuthHash(emailPassword, newEmail, salt);
    changeEmailMutation.mutate(
      { newEmail, authHash: toHex(authHashRaw) },
      {
        onSuccess: () => {
          toast.success(t("settings.emailSent"));
          setEmailOpen(false);
        },
        onError: () => toast.error(t("settings.emailChangeFailed")),
      },
    );
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPass || !newPass || !vaultKey) return;
    const newSalt = generateSalt();
    const newEncKey = await deriveEncryptionKey(newPass, newSalt);
    const newWrapped = await wrapVaultKey(vaultKey, newEncKey);
    const authSalt = generateSalt();
    const authHashRaw = await deriveAuthHash(newPass, email ?? "", authSalt);
    changePasswordMutation.mutate(
      {
        currentEncryptionSalt: "",
        newEncryptionSalt: toHex(newSalt),
        newWrappedVaultKey: newWrapped,
        newAuthHash: toHex(authHashRaw),
        newAuthSalt: toHex(authSalt),
      },
      {
        onSuccess: () => {
          toast.success(t("settings.passwordChanged"));
          setPassOpen(false);
        },
        onError: () => toast.error(t("settings.passwordChangeFailed")),
      },
    );
  }

  async function startMfaSetup() {
    const secret = generateTotpSecret();
    setMfaSecret(secret);
    setMfaCode("");
    setMfaOpen(true);
    try {
      const uri = generateTotpUri(secret, email ?? "user@ironlox.com", "Ironlox");
      const dataUrl = await QRCode.toDataURL(uri, { width: 200, margin: 1 });
      setMfaQrDataUrl(dataUrl);
    } catch {
      setMfaQrDataUrl("");
    }
  }

  async function handleEnableMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaSecret || !mfaCode) return;
    if (!(await verifyTotp(mfaSecret, mfaCode))) {
      toast.error(t("settings.invalidCode"));
      return;
    }
    mfaEnableMutation.mutate(
      { secret: mfaSecret, code: mfaCode },
      {
        onSuccess: () => {
          setMfaEnabled(true);
          setMfaOpen(false);
          toast.success(t("settings.mfaEnabledToast"));
        },
        onError: () => toast.error("Failed to enable MFA"),
      },
    );
  }

  function handleDisableMfa() {
    mfaDisableMutation.mutate(undefined, {
      onSuccess: () => {
        setMfaEnabled(false);
        toast.success(t("settings.mfaDisabled"));
      },
      onError: (err: unknown) => {
        const apiErr = err as { status?: number; message?: string };
        if (apiErr.status === 501) {
          toast.error("MFA disable is not yet available. Please try again later.");
        } else {
          toast.error(apiErr.message ?? "Failed to disable MFA");
        }
      },
    });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">{t("settings.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.account")}</CardTitle>
          <CardDescription>{email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("settings.tier")}</span>
            <span className="text-sm text-muted-foreground">{t("settings.free")}</span>
          </div>
          <Separator />
          <Link href="/settings/billing" className="block">
            <Button variant="outline" size="sm" className="w-full justify-start gap-2">
              <Crown className="size-4" />
              {t("settings.billing")}
            </Button>
          </Link>
          <Separator />
          <FormDialog
            open={emailOpen}
            onOpenChange={setEmailOpen}
            title={t("settings.changeEmail")}
            description={t("settings.changeEmailDesc")}
            trigger={
              <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                <Mail className="size-4" />
                {t("settings.changeEmail")}
              </Button>
            }
            onSubmit={handleChangeEmail}
            submitLabel={t("settings.sendVerification")}
            submitLoading={changeEmailMutation.isPending}
            submitLoadingLabel={t("settings.sending")}
          >
            <FormField label={t("settings.newEmail")}>
              <Input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
              />
            </FormField>
            <FormField label={t("settings.masterPasswordForChange")}>
              <Input
                type="password"
                required
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
              />
            </FormField>
          </FormDialog>
          <FormDialog
            open={passOpen}
            onOpenChange={setPassOpen}
            title={t("settings.changePassword")}
            description={t("settings.changePasswordDesc")}
            trigger={
              <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                <Key className="size-4" />
                {t("settings.changePassword")}
              </Button>
            }
            onSubmit={handleChangePassword}
            submitLabel={t("settings.changePassword")}
            submitLoading={changePasswordMutation.isPending}
            submitLoadingLabel={t("settings.changing")}
          >
            <FormField label={t("settings.currentPassword")}>
              <Input
                type="password"
                required
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
              />
            </FormField>
            <FormField label={t("settings.newPassword")}>
              <Input
                type="password"
                required
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder={t("settings.newPasswordPlaceholder")}
              />
            </FormField>
          </FormDialog>
          <Separator />
          <FormDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title={t("settings.deleteConfirmTitle")}
            description={t("settings.deleteConfirmDesc")}
            trigger={
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash2 className="size-4" />
                {t("settings.deleteAccount")}
              </Button>
            }
            onSubmit={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            submitLabel={t("settings.deleteYes")}
            submitLoading={deleteAccountMutation.isPending}
            submitLoadingLabel={t("settings.deleting")}
            variant="destructive"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                const vaultData = localStorage.getItem("ironlox_vault_snapshot");
                if (vaultData) {
                  try {
                    const vault = JSON.parse(vaultData);
                    const csv = exportVaultToCsv(vault);
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "ironlox-export.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Vault exported. Please save the file securely.");
                  } catch {
                    toast.error("Export failed. Please use the Export page instead.");
                  }
                } else {
                  toast.error("No vault data available. Please export from the Export page.");
                }
              }}
            >
              <Download className="size-3.5" />
              {t("settings.exportBeforeDelete")}
            </Button>
          </FormDialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.appearance")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {(["light", "dark", "system"] as const).map((themeOption) => (
              <Button
                key={themeOption}
                variant={theme === themeOption ? "default" : "outline"}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setTheme(themeOption)}
              >
                {themeOption === "light" ? (
                  <Sun className="size-3.5" />
                ) : themeOption === "dark" ? (
                  <Moon className="size-3.5" />
                ) : (
                  <Monitor className="size-3.5" />
                )}
                <span className="text-xs">{t(`settings.${themeOption}`)}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.security")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("settings.autoLock")}</span>
            <Select
              value={vaultTimeout}
              onValueChange={(v) => {
                if (v) handleVaultTimeout(v);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1min">{t("settings.1min")}</SelectItem>
                <SelectItem value="5min">{t("settings.5min")}</SelectItem>
                <SelectItem value="15min">{t("settings.15min")}</SelectItem>
                <SelectItem value="1hour">{t("settings.1hour")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("settings.clipboardClear")}</span>
            <Select
              value={clipboardClear}
              onValueChange={(v) => {
                if (v) handleClipboardClear(v);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30s">{t("settings.30s")}</SelectItem>
                <SelectItem value="60s">{t("settings.60s")}</SelectItem>
                <SelectItem value="2min">{t("settings.2min")}</SelectItem>
                <SelectItem value="never">{t("settings.never")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("settings.lockNow")}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              {t("settings.lock")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="size-4" />
            {t("settings.mfa")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mfaEnabled ? (
            <div className="space-y-2">
              <p className="text-sm text-green-600 dark:text-green-400">
                {t("settings.mfaEnabled")}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisableMfa}
                disabled={mfaDisableMutation.isPending}
              >
                {t("settings.disableMfa")}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={startMfaSetup}
            >
              <QrCode className="size-4" />
              {t("settings.enableMfa")}
            </Button>
          )}
        </CardContent>
      </Card>

      <FormDialog
        open={mfaOpen}
        onOpenChange={setMfaOpen}
        title={t("settings.mfaSetup")}
        description={t("settings.mfaSetupDesc")}
        onSubmit={handleEnableMfa}
        submitLabel={t("settings.enable")}
        submitLoading={mfaEnableMutation.isPending}
        submitLoadingLabel={t("settings.verifying")}
        submitDisabled={mfaCode.length !== 6}
      >
        {mfaQrDataUrl ? (
          <div className="flex justify-center">
            <img
              src={mfaQrDataUrl}
              alt="MFA QR code"
              className="rounded-lg border border-border"
              width={200}
              height={200}
            />
          </div>
        ) : (
          <div className="bg-muted rounded-lg p-6 flex items-center justify-center">
            <p className="text-xs text-muted-foreground animate-pulse">
              {t("settings.generatingQr")}
            </p>
          </div>
        )}
        <div className="bg-muted rounded-lg p-3 space-y-2">
          <p className="text-[10px] text-muted-foreground">{t("settings.manualKey")}</p>
          <p className="font-mono text-xs text-center break-all">{mfaSecret}</p>
        </div>
        <FormField label={t("settings.verificationCode")}>
          <Input
            placeholder="000000"
            maxLength={6}
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            className="font-mono text-center text-lg tracking-widest"
          />
        </FormField>
      </FormDialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="size-4" />
            {t("settings.recoveryKey")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recoveryKey && showKey ? (
            <div className="bg-muted rounded-lg p-3">
              <p className="font-mono text-xs text-center break-all">{recoveryKey}</p>
            </div>
          ) : recoveryKey ? (
            <p className="text-sm text-muted-foreground">{t("settings.recoveryKeySaved")}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("settings.recoveryKeyNone")}</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!recoveryKey}
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? t("settings.hideKey") : t("settings.viewKey")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleRegenerateKey}
              disabled={regenerating}
            >
              {regenerating
                ? t("settings.generating")
                : recoveryKey
                  ? t("settings.regenerate")
                  : t("settings.generate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loginEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="size-4" />
              {t("settings.loginHistory")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-auto">
              {loginEvents.slice(0, 20).map((e, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {new Date(e.timestamp).toLocaleString()}
                  </span>
                  <span>{e.cityCountry}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
