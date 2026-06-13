import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useVault } from "@/lib/vault-context";
import { queryKeys } from "@/lib/query-keys";
import type { LoginResponse } from "@ironlox/schemas";

export function useMfaVerifyMutation() {
  const { apiClient } = useVault();
  const queryClient = useQueryClient();
  return useMutation<LoginResponse, Error, { code: string; email: string; tempToken: string }>({
    mutationFn: (params) => apiClient!.mfaVerify(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.account });
    },
  });
}
