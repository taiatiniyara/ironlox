import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useVault } from "@/lib/vault-context";
import { queryKeys } from "@/lib/query-keys";

export function useChangePasswordMutation() {
  const { apiClient } = useVault();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      currentEncryptionSalt: string;
      newEncryptionSalt: string;
      newWrappedVaultKey: string;
      newAuthHash: string;
      newAuthSalt: string;
    }) => apiClient!.changePassword(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.account });
    },
  });
}
