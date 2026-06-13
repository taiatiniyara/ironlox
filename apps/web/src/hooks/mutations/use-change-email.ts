import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useVault } from "@/lib/vault-context";
import { queryKeys } from "@/lib/query-keys";

export function useChangeEmailMutation() {
  const { apiClient } = useVault();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { newEmail: string; authHash: string }) => apiClient!.changeEmail(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.account });
    },
  });
}
