import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useVault } from "@/lib/vault-context";
import { queryKeys } from "@/lib/query-keys";

export function useMfaEnableMutation() {
  const { apiClient } = useVault();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { secret: string; code: string }) => apiClient!.mfaEnable(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.account });
    },
  });
}
