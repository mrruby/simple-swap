import type { SwapStatus } from "@ston-fi/api";
import { useQuery } from "@tanstack/react-query";
import { stonApiClient } from "../lib/clients";

export interface ITransactionDetails {
  queryId: number;
  routerAddress: string;
  ownerAddress: string;
}

const SWAP_STATUS_REFETCH_INTERVAL_MS = 5_000; // 5s
const SWAP_STATUS_TIMEOUT_MS = 300_000; // 5m

export const useSwapStatusQuery = (transactionDetails?: ITransactionDetails) => {
  return useQuery({
    queryKey: ["swap-status", transactionDetails?.queryId],
    queryFn: async () => {
      if (!transactionDetails) return null;

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, SWAP_STATUS_TIMEOUT_MS);

      try {
        let swapStatus: SwapStatus;
        do {
          swapStatus = await stonApiClient.getSwapStatus({
            ...transactionDetails,
            queryId: transactionDetails.queryId.toString(),
          });

          if (swapStatus["@type"] === "Found") {
            break;
          }

          await new Promise(resolve => setTimeout(resolve, SWAP_STATUS_REFETCH_INTERVAL_MS));
        } while (swapStatus["@type"] === "NotFound");

        return swapStatus;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    enabled: !!transactionDetails,
    refetchOnWindowFocus: false,
    retry: 3,
  });
}; 