import { useSimpleSwap } from "../hooks/useSimpleSwap";
import { SwapForm } from "./SwapForm";
import { SwapHeader } from "./SwapHeader";

export const Swap = () => {
	// Extract all swap state and handlers from our custom hook
	const {
		isWalletConnected,
		state,
		handleOfferAssetChange,
		handleAskAssetChange,
		handleOfferAmountChange,
		handleAskAmountChange,
		handleSwap,
	} = useSimpleSwap();

	const {
		allAssets,
		offerAsset,
		askAsset,
		offerAmount,
		askAmount,
		simulationResult,
		simulationError,
		loadingSimulation,
		loadingTx,
	} = state;

	return (
		<div className="max-w-lg mx-auto p-6 bg-white rounded-xl shadow-lg">
			<SwapHeader isWalletConnected={isWalletConnected} />
			<SwapForm
				allAssets={allAssets}
				offerAsset={offerAsset}
				askAsset={askAsset}
				offerAmount={offerAmount}
				askAmount={askAmount}
				simulationResult={simulationResult}
				simulationError={simulationError}
				loadingSimulation={loadingSimulation}
				loadingTx={loadingTx}
				isWalletConnected={isWalletConnected}
				onOfferAssetChange={handleOfferAssetChange}
				onAskAssetChange={handleAskAssetChange}
				onOfferAmountChange={handleOfferAmountChange}
				onAskAmountChange={handleAskAmountChange}
				onSwap={handleSwap}
			/>
		</div>
	);
};
