import type { AssetInfoV2, SwapSimulation } from "@ston-fi/api";
import { SwapInput } from "./SwapInput";
import { SwapSummary } from "./SwapSummary";

type SwapFormProps = {
	allAssets: AssetInfoV2[];
	offerAsset: AssetInfoV2 | null;
	askAsset: AssetInfoV2 | null;
	offerAmount: string;
	askAmount: string;
	simulationResult: SwapSimulation | null;
	simulationError: string;
	loadingSimulation: boolean;
	loadingTx: boolean;
	isWalletConnected: boolean;
	isTestnet: boolean;
	onOfferAssetChange: (asset: AssetInfoV2 | null) => void;
	onAskAssetChange: (asset: AssetInfoV2 | null) => void;
	onOfferAmountChange: (amount: string) => void;
	onAskAmountChange: (amount: string) => void;
	onSwap: () => void;
};

export const SwapForm = ({
	allAssets,
	offerAsset,
	askAsset,
	offerAmount,
	askAmount,
	simulationResult,
	simulationError,
	loadingSimulation,
	loadingTx,
	isWalletConnected,
	isTestnet,
	onOfferAssetChange,
	onAskAssetChange,
	onOfferAmountChange,
	onAskAmountChange,
	onSwap,
}: SwapFormProps) => {
	return (
		<div className="space-y-6 mt-4">
			<SwapInput
				label="You Pay"
				assets={allAssets}
				selectedAsset={offerAsset}
				amount={offerAmount}
				onAssetChange={onOfferAssetChange}
				onAmountChange={onOfferAmountChange}
			/>

			<SwapInput
				label="You Receive"
				assets={allAssets.filter(
					(a) => a.contractAddress !== offerAsset?.contractAddress,
				)}
				selectedAsset={askAsset}
				amount={askAmount}
				onAssetChange={onAskAssetChange}
				onAmountChange={onAskAmountChange}
			/>

			<SwapSummary
				loading={loadingSimulation}
				error={simulationError}
				simulation={simulationResult}
				offerAssetDecimals={offerAsset?.meta?.decimals}
				askAssetDecimals={askAsset?.meta?.decimals}
			/>

			{isTestnet && (
				<div className="p-4 text-red-600 text-sm border border-red-200 rounded-lg">
					Testnet is not supported. Please switch to mainnet to proceed.
				</div>
			)}

			<button
				onClick={onSwap}
				disabled={
					!simulationResult ||
					loadingTx ||
					!isWalletConnected ||
					isTestnet
				}
				className="w-full p-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{loadingTx ? "Swapping..." : "Swap"}
			</button>
		</div>
	);
};
