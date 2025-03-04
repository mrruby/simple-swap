import type { AssetInfoV2, SwapSimulation } from "@ston-fi/api";
import { CHAIN, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { buildSwapTransaction, fetchAssets, simulateSwap } from "../lib/swap";
import { formatAmount } from "../lib/utils";
import { useSwapStatusNotifications } from "./useSwapStatusNotifications";
import { ITransactionDetails } from "./useSwapStatusQuery";

type SwapState = {
	allAssets: AssetInfoV2[];
	offerAsset: AssetInfoV2 | null;
	askAsset: AssetInfoV2 | null;
	offerAmount: string;
	askAmount: string;
	simulationResult: SwapSimulation | null;
	simulationError: string;
	loadingSimulation: boolean;
	loadingTx: boolean;
};

const initialState: SwapState = {
	allAssets: [],
	offerAsset: null,
	askAsset: null,
	offerAmount: "",
	askAmount: "",
	simulationResult: null,
	simulationError: "",
	loadingSimulation: false,
	loadingTx: false,
};

export function useSimpleSwap() {
	const walletAddress = useTonAddress();
	const [tonConnectUI] = useTonConnectUI();

	// Check if the user is on testnet
	const isTestnet = Boolean(
		tonConnectUI?.wallet?.account?.chain !== CHAIN.MAINNET
	);

	// Local swap state
	const [state, setState] = useState<SwapState>(initialState);

	// Transaction details for status tracking
	const [transactionDetails, setTransactionDetails] = useState<
		ITransactionDetails | undefined
	>(undefined);

	// Pass transaction details into the status notifications hook
	useSwapStatusNotifications(transactionDetails);

	// Helper to partially update the swap state
	const updateState = (updates: Partial<SwapState>) => {
		setState((current) => ({ ...current, ...updates }));
	};

	// Load user assets on mount or whenever wallet changes
	useEffect(() => {
		const loadAssets = async () => {
			if (!walletAddress) return;
			try {
				const assets = await fetchAssets(walletAddress);
				updateState({ allAssets: assets });
			} catch (error) {
				console.error("Failed to fetch assets", error);
			}
		};

		loadAssets();
	}, [walletAddress]);

	// Reset local state if wallet is disconnected
	useEffect(() => {
		if (!walletAddress) {
			setState(initialState);
			setTransactionDetails(undefined);
		}
	}, [walletAddress]);

	// Run simulation whenever offer/ask amounts or assets change
	useEffect(() => {
		let isCancelled = false;

		const runSimulation = async () => {
			const { offerAsset, askAsset, offerAmount, askAmount } = state;
			if (!offerAsset || !askAsset) return;

			try {
				const result = await simulateSwap({
					walletAddress,
					offerAssetAddress: offerAsset.contractAddress,
					askAssetAddress: askAsset.contractAddress,
					offerAmount: offerAmount || undefined,
					askAmount: askAmount || undefined,
					decimalsOffer: offerAsset.meta?.decimals ?? 9,
					decimalsAsk: askAsset.meta?.decimals ?? 9,
				});

				if (!isCancelled) {
					updateState({
						simulationResult: result,
						...(offerAmount
							? {
									askAmount: formatAmount(
										result.minAskUnits,
										askAsset.meta?.decimals,
									),
								}
							: {
									offerAmount: formatAmount(
										result.offerUnits,
										offerAsset.meta?.decimals,
									),
								}),
					});
				}
			} catch (err) {
				if (!isCancelled) {
					updateState({
						simulationError: (err as Error)?.message || "Simulation failed",
					});
				}
			} finally {
				if (!isCancelled) {
					updateState({ loadingSimulation: false });
				}
			}
		};

		const { offerAsset, askAsset, offerAmount, askAmount } = state;

		// If not connected or insufficient data, reset simulation
		if (
			!walletAddress ||
			!offerAsset ||
			!askAsset ||
			(!offerAmount && !askAmount)
		) {
			updateState({ simulationResult: null, simulationError: "" });
			return;
		}

		// Otherwise start simulation
		updateState({
			loadingSimulation: true,
			simulationError: "",
			simulationResult: null,
		});
		runSimulation();

		return () => {
			isCancelled = true;
		};
	}, [
		state.offerAsset,
		state.askAsset,
		state.offerAmount,
		state.askAmount,
		walletAddress,
	]);

	// Handler to perform the swap
	const handleSwap = async () => {
		const { simulationResult } = state;
		if (!simulationResult || !walletAddress) return;

		updateState({ loadingTx: true });

		try {
			const queryId = Date.now();
			const messages = await buildSwapTransaction(
				simulationResult,
				walletAddress,
				{
					queryId,
				},
			);

			await tonConnectUI.sendTransaction({
				validUntil: Date.now() + 1000 * 60,
				messages,
			});

			// Save transaction details for status polling
			setTransactionDetails({
				queryId,
				routerAddress: simulationResult.routerAddress,
				ownerAddress: walletAddress,
			});

			toast.info("Transaction Sent", {
				description: "Your swap transaction has been sent to the network",
			});

			updateState({
				offerAmount: "",
				askAmount: "",
				simulationResult: null,
			});
		} catch (error) {
			console.error("Swap transaction error", error);
			toast.error("Transaction Failed", {
				description: "Failed to send your swap transaction. Please try again.",
			});
		} finally {
			updateState({ loadingTx: false });
		}
	};

	// Helpers to handle user input changes
	const handleOfferAssetChange = (asset: AssetInfoV2 | null) => {
		updateState({
			offerAsset: asset,
			askAsset:
				asset?.contractAddress === state.askAsset?.contractAddress
					? null
					: state.askAsset,
			offerAmount: "",
			askAmount: "",
		});
	};

	const handleAskAssetChange = (asset: AssetInfoV2 | null) => {
		updateState({
			askAsset: asset,
			askAmount: "",
		});
	};

	const handleOfferAmountChange = (amount: string) => {
		updateState({ offerAmount: amount });
	};

	const handleAskAmountChange = (amount: string) => {
		updateState({ askAmount: amount });
	};

	return {
		isWalletConnected: !!walletAddress,
		isTestnet,
		state,
		handleOfferAssetChange,
		handleAskAssetChange,
		handleOfferAmountChange,
		handleAskAmountChange,
		handleSwap,
	};
}
