import { useAccountQuery } from "./use-account";

export function useLoginEventsQuery() {
  const { data, isLoading, isError, error } = useAccountQuery();
  return {
    data: data?.loginEvents ?? [],
    isLoading,
    isError,
    error,
  };
}
