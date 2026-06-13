import { useMutation } from "@tanstack/react-query";
import { useVault } from "@/lib/vault-context";

export function useDeleteAccountMutation() {
  const { apiClient } = useVault();
  return useMutation({
    mutationFn: () => apiClient!.deleteAccount(),
  });
}
