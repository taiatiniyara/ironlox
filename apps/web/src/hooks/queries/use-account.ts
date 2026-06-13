import { useQuery } from "@tanstack/react-query";
import { useVault } from "@/lib/vault-context";
import { queryKeys } from "@/lib/query-keys";

export function useAccountQuery() {
  const { apiClient } = useVault();
  return useQuery({
    queryKey: queryKeys.account,
    queryFn: () => apiClient!.getAccount(),
    enabled: !!apiClient,
  });
}
