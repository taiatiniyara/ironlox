import { useAccountQuery } from "@/hooks/queries/use-account";
import { useRouter } from "next/navigation";

export function usePremium() {
  const { data: account, isLoading } = useAccountQuery();
  const router = useRouter();

  return {
    isPremium: account?.tier === "premium",
    isFree: account?.tier === "free",
    isLoading,
    tier: account?.tier ?? null,
    navigateToUpgrade: () => router.push("/settings/billing"),
  };
}
