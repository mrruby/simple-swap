import type { AssetInfoV2, SwapSimulation } from "@ston-fi/api";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useEffect, useState } from "react";
import { buildSwapTransaction, fetchAssets, simulateSwap } from "../lib/swap";
import { formatAmount } from "../lib/utils";
import { SwapForm } from "./SwapForm";
import { SwapHeader } from "./SwapHeader";

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

export const Swap = () => {
	const walletAddress = useTonAddress();
	const [tonConnectUI] = useTonConnectUI();
	const [state, setState] = useState<SwapState>(initialState);

	const updateState = (updates: Partial<SwapState>) => {
		setState((current) => ({ ...current, ...updates }));
	};

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

	useEffect(() => {
		const runSimulation = async () => {
			const { offerAsset, askAsset, offerAmount, askAmount } = state;

			if (!offerAsset || !askAsset || (!offerAmount && !askAmount)) {
				updateState({ simulationResult: null, simulationError: "" });
				return;
			}

			updateState({
				loadingSimulation: true,
				simulationError: "",
				simulationResult: null,
			});

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
			} catch (err) {
				updateState({
					simulationError: (err as Error)?.message || "Simulation failed",
				});
			} finally {
				updateState({ loadingSimulation: false });
			}
		};

		runSimulation();
	}, [
		state.offerAsset,
		state.askAsset,
		state.offerAmount,
		state.askAmount,
		walletAddress,
	]);

	const handleSwap = async () => {
		const { simulationResult } = state;
		if (!simulationResult || !walletAddress) return;

		updateState({ loadingTx: true });

		try {  
			const messages = await buildSwapTransaction(
				simulationResult,
				walletAddress,
				{
					queryId: Date.now(),
				},
			);

			await tonConnectUI.sendTransaction({
				validUntil: Date.now() + 1000 * 60,
				messages,
			});

			updateState({
				offerAmount: "",
				askAmount: "",
				simulationResult: null,
			});
		} catch (error) {
			console.error("Swap transaction error", error);
		} finally {
			updateState({ loadingTx: false });
		}
	};

	return (
		<div className="max-w-lg mx-auto p-6 bg-white rounded-xl shadow-lg">
			<SwapHeader isWalletConnected={!!walletAddress} />
			<SwapForm
				{...state}
				isWalletConnected={!!walletAddress}
				onOfferAssetChange={(asset) => {
					updateState({
						offerAsset: asset,
						askAsset:
							asset?.contractAddress === state.askAsset?.contractAddress
								? null
								: state.askAsset,
						offerAmount: "",
						askAmount: "",
					});
				}}
				onAskAssetChange={(asset) => {
					updateState({
						askAsset: asset,
						askAmount: "",
					});
				}}
				onOfferAmountChange={(amount) => {
					updateState({ offerAmount: amount });
				}}
				onAskAmountChange={(amount) => {
					updateState({ askAmount: amount });
				}}
				onSwap={handleSwap}
			/>
		</div>
	);
};
