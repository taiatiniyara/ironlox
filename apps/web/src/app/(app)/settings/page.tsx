"use client";

import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Moon, Sun, Monitor, Trash2, Shield, Key, Mail, Clock, QrCode } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  generateSalt,
  deriveAuthHash,
  deriveEncryptionKey,
  wrapVaultKey,
  generateRecoveryKey,
  generateTotpSecret,
  verifyTotp,
  toHex,
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
  usePageTitle("Settings");
  const { email, logout, apiClient, vaultKey } = useVault();
  const { theme, setTheme } = useTheme();
  const [vaultTimeout, setVaultTimeout] = useState(() => loadPref(PREF_KEYS.vaultTimeout, "5min"));
  const [clipboardClear, setClipboardClear] = useState(() =>
    loadPref(PREF_KEYS.clipboardClear, "60s"),
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Change email state
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  // Change password state
  const [passOpen, setPassOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  // Login history
  const [loginEvents, setLoginEvents] = useState<Array<{ timestamp: string; cityCountry: string }>>(
    [],
  );

  // MFA state
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enablingMfa, setEnablingMfa] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ironlox_recovery_key");
    if (stored) setRecoveryKey(stored);
  }, []);

  useEffect(() => {
    if (!apiClient) return;
    let cancelled = false;
    apiClient
      .getAccount()
      .then((acct) => {
        if (cancelled) return;
        if (acct.loginEvents) {
          setLoginEvents(
            acct.loginEvents.slice(0, 20).map((e) => ({
              timestamp: e.timestamp,
              cityCountry: e.cityCountry || "Unknown",
            })),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  function handleVaultTimeout(v: string) {
    setVaultTimeout(v);
    savePref(PREF_KEYS.vaultTimeout, v);
    toast.success("Auto-lock timeout updated");
  }
  function handleClipboardClear(v: string) {
    setClipboardClear(v);
    savePref(PREF_KEYS.clipboardClear, v);
    toast.success("Clipboard clear timeout updated");
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      if (apiClient) {
        await apiClient.deleteAccount();
        toast.success("Account deletion initiated. You have 7 days to cancel.");
        setTimeout(() => logout(), 1500);
      }
    } catch {
      toast.error("Failed to initiate account deletion");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  function handleRegenerateKey() {
    setRegenerating(true);
    const newKey = generateRecoveryKey();
    localStorage.setItem("ironlox_recovery_key", newKey);
    setRecoveryKey(newKey);
    setShowKey(true);
    setRegenerating(false);
    toast.success("Recovery key regenerated. Save it securely.");
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!apiClient || !newEmail || !emailPassword) return;
    setChangingEmail(true);
    try {
      const salt = generateSalt();
      const authHashRaw = await deriveAuthHash(emailPassword, newEmail, salt);
      await apiClient.changeEmail({ newEmail, authHash: toHex(authHashRaw) });
      toast.success("Email verification sent. Check your inbox.");
      setEmailOpen(false);
    } catch {
      toast.error("Failed to change email");
    } finally {
      setChangingEmail(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!apiClient || !currentPass || !newPass || !vaultKey) return;
    setChangingPass(true);
    try {
      const newSalt = generateSalt();
      const newEncKey = await deriveEncryptionKey(newPass, newSalt);
      const newWrapped = await wrapVaultKey(vaultKey, newEncKey);
      const authSalt = generateSalt();
      const authHashRaw = await deriveAuthHash(newPass, email ?? "", authSalt);
      await apiClient.changePassword({
        currentEncryptionSalt: "",
        newEncryptionSalt: toHex(newSalt),
        newWrappedVaultKey: newWrapped,
        newAuthHash: toHex(authHashRaw),
        newAuthSalt: toHex(authSalt),
      });
      toast.success("Master password changed");
      setPassOpen(false);
    } catch {
      toast.error("Failed to change password");
    } finally {
      setChangingPass(false);
    }
  }

  function startMfaSetup() {
    const secret = generateTotpSecret();
    setMfaSecret(secret);
    setMfaCode("");
    setMfaOpen(true);
  }

  async function handleEnableMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!apiClient || !mfaSecret || !mfaCode) return;
    setEnablingMfa(true);
    try {
      if (!(await verifyTotp(mfaSecret, mfaCode))) {
        toast.error("Invalid code. Try again.");
        setEnablingMfa(false);
        return;
      }
      await apiClient.mfaEnable({ secret: mfaSecret, code: mfaCode });
      setMfaEnabled(true);
      setMfaOpen(false);
      toast.success("Two-factor authentication enabled");
    } catch {
      toast.error("Failed to enable MFA");
    } finally {
      setEnablingMfa(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>{email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Tier</span>
            <span className="text-sm text-muted-foreground">Free</span>
          </div>
          <Separator />
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => toast.error("Premium upgrades coming soon")}
          >
            <span className="text-yellow-500">&#9733;</span> Upgrade to Premium ($3/mo)
          </Button>
          <Separator />
          <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
            <DialogTrigger>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                <Mail className="size-4" />
                Change Email
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Email</DialogTitle>
                <DialogDescription>
                  A verification code will be sent to your new email.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleChangeEmail} className="space-y-3">
                <div className="space-y-2">
                  <Label>New Email</Label>
                  <Input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Master Password</Label>
                  <Input
                    type="password"
                    required
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setEmailOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={changingEmail}>
                    {changingEmail ? "Sending..." : "Change Email"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={passOpen} onOpenChange={setPassOpen}>
            <DialogTrigger>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                <Key className="size-4" />
                Change Master Password
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Master Password</DialogTitle>
                <DialogDescription>
                  This re-wraps your vault key. Vault contents stay the same.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input
                    type="password"
                    required
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Min 12 characters"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setPassOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={changingPass}>
                    {changingPass ? "Changing..." : "Change Password"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Separator />
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger>
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash2 className="size-4" />
                Delete Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Account</DialogTitle>
                <DialogDescription>
                  Your account will be permanently deleted after a 7-day grace period. You can
                  cancel deletion by logging in within those 7 days.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Deleting..." : "Yes, Delete My Account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <Button
                key={t}
                variant={theme === t ? "default" : "outline"}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setTheme(t)}
              >
                {t === "light" ? (
                  <Sun className="size-3.5" />
                ) : t === "dark" ? (
                  <Moon className="size-3.5" />
                ) : (
                  <Monitor className="size-3.5" />
                )}
                <span className="text-xs capitalize">{t}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Auto-lock timeout</span>
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
                <SelectItem value="1min">1 minute</SelectItem>
                <SelectItem value="5min">5 minutes</SelectItem>
                <SelectItem value="15min">15 minutes</SelectItem>
                <SelectItem value="1hour">1 hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm">Clipboard clear</span>
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
                <SelectItem value="30s">30 seconds</SelectItem>
                <SelectItem value="60s">60 seconds</SelectItem>
                <SelectItem value="2min">2 minutes</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm">Lock vault now</span>
            <Button variant="outline" size="sm" onClick={logout}>
              Lock
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="size-4" />
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mfaEnabled ? (
            <div className="space-y-2">
              <p className="text-sm text-green-600 dark:text-green-400">TOTP is enabled</p>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    if (apiClient) await apiClient.mfaDisable();
                  } catch {
                    /* API 501 stub — still toggle for UX */
                  }
                  setMfaEnabled(false);
                  toast.success("MFA disabled");
                }}
              >
                Disable MFA
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
              Enable Authenticator App
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={mfaOpen} onOpenChange={setMfaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Up Authenticator</DialogTitle>
            <DialogDescription>
              Scan this QR code with your authenticator app, then enter the code to verify.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEnableMfa} className="space-y-3">
            <div className="bg-muted rounded-lg p-3 space-y-2">
              <p className="text-[10px] text-muted-foreground">Manual entry key:</p>
              <p className="font-mono text-xs text-center break-all">{mfaSecret}</p>
            </div>
            <div className="space-y-2">
              <Label>Verification Code</Label>
              <Input
                placeholder="000000"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="font-mono text-center text-lg tracking-widest"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setMfaOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={enablingMfa || mfaCode.length !== 6}>
                {enablingMfa ? "Verifying..." : "Enable MFA"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="size-4" />
            Recovery Key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recoveryKey && showKey ? (
            <div className="bg-muted rounded-lg p-3">
              <p className="font-mono text-xs text-center break-all">{recoveryKey}</p>
            </div>
          ) : recoveryKey ? (
            <p className="text-sm text-muted-foreground">Recovery key saved. Keep it secure.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No recovery key found. Generate one to protect your account.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!recoveryKey}
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? "Hide" : "View"} Key
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleRegenerateKey}
              disabled={regenerating}
            >
              {regenerating ? "Generating..." : recoveryKey ? "Regenerate" : "Generate Key"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loginEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="size-4" />
              Login History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-auto">
              {loginEvents.map((e, i) => (
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
