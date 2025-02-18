import { useEffect } from "react";
import { toast } from "sonner";
import {
	type ITransactionDetails,
	useSwapStatusQuery,
} from "./useSwapStatusQuery";

export const useSwapStatusNotifications = (
	transactionDetails?: ITransactionDetails,
) => {
	const { data, isError } = useSwapStatusQuery(transactionDetails);

	useEffect(() => {
		if (!isError) return;
		toast.error("Transaction status check failed", {
			description: "Unable to fetch the latest status of your transaction",
		});
	}, [isError]);

	useEffect(() => {
		if (!data?.exitCode) return;

		if (data.exitCode === "failed") {
			toast.error("Transaction Failed", {
				description: "Your swap transaction has failed. Please try again.",
			});
		} else if (data.exitCode === "swap_ok") {
			toast.success("Transaction Successful", {
				description: "Your swap has been completed successfully!",
			});
		} else {
			toast.info("Transaction Status", {
				description: `Transaction finished with status: ${data.exitCode}`,
			});
		}
	}, [data?.exitCode]);
};
