"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useVault } from "@/lib/vault-context";
import { usePageTitle } from "@/lib/utils";
import { AuthFormCard } from "@/components/shared/auth-form-card";
import { FormField } from "@/components/shared/form-field";
import { LoadingButton } from "@/components/shared/loading-button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export default function RecoverPage() {
  usePageTitle("Recover Account");
  const { apiClient } = useVault();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiClient) return;
    setLoading(true);
    try {
      await apiClient.recover({ recoveryKey: key, email });
      toast.success("Vault recovered. Enter your master password to unlock.");
      router.push("/login");
    } catch (err) {
      const apiErr = err as { message?: string };
      toast.error(apiErr.message ?? "Invalid recovery key");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormCard
      title="Recover Your Account"
      description="Enter your email and 32-character recovery key to regain access."
      icon={Shield}
      onSubmit={handleSubmit}
      footer={
        <p className="pt-4 text-center text-xs text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      <FormField id="email" label="Email">
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </FormField>
      <FormField id="key" label="Recovery Key">
        <Input
          id="key"
          required
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Enter your 32-character recovery key"
          className="font-mono text-xs"
        />
      </FormField>
      <LoadingButton
        type="submit"
        className="w-full"
        loading={loading}
        loadingText="Recovering..."
        disabled={key.length < 32}
      >
        Recover Vault
      </LoadingButton>
    </AuthFormCard>
  );
}
