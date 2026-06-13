import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useVault } from "@/lib/vault-context";
import { queryKeys } from "@/lib/query-keys";
import type { LoginResponse } from "@ironlox/schemas";

export function useRecoverMutation() {
  const { apiClient } = useVault();
  const queryClient = useQueryClient();
  return useMutation<LoginResponse, Error, { recoveryKey: string; email: string }>({
    mutationFn: (params) => apiClient!.recover(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.account });
    },
  });
}
