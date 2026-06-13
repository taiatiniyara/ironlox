import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useVault } from "@/lib/vault-context";
import { queryKeys } from "@/lib/query-keys";

export function useDeleteAttachmentMutation() {
  const { apiClient } = useVault();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient!.deleteAttachment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.account });
    },
  });
}
