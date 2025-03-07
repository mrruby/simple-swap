import { type AssetInfoV2, AssetTag, type SwapSimulation } from "@ston-fi/api";
import { dexFactory } from "@ston-fi/sdk";
import type { SendTransactionRequest } from "@tonconnect/ui-react";
import { stonApiClient, tonApiClient } from "./clients";
import { floatToBigNumber } from "./utils";

type SimulateSwapParams = {
	offerAssetAddress: string;
	askAssetAddress: string;
	offerAmount?: string;
	askAmount?: string;
	slippageTolerancePercent?: number;
	referralAddress?: string;
	referralValue?: number;
	decimalsOffer?: number;
	decimalsAsk?: number;
};

export const fetchAssets = async (
	walletAddress?: string,
): Promise<AssetInfoV2[]> => {
	if (!walletAddress) return [];

	try {
		// First get wallet assets to get balances
		const walletAssets = await stonApiClient.getWalletAssets(walletAddress);

		// Then get all available assets with high liquidity
		const condition = [
			AssetTag.LiquidityVeryHigh,
			AssetTag.LiquidityHigh,
			AssetTag.LiquidityMedium,
		].join(" | ");

		const allAssets = await stonApiClient.queryAssets({ condition });

		// Create a map of wallet assets for quick lookup
		const walletAssetsMap = new Map(
			walletAssets.map((asset) => [asset.contractAddress, asset]),
		);

		// Merge wallet balances into all assets
		return allAssets
			.map((asset) => ({
				...asset,
				balance: walletAssetsMap.get(asset.contractAddress)?.balance || "0",
			}))
			.sort((a, b) => (b.popularityIndex ?? 0) - (a.popularityIndex ?? 0));
	} catch (error) {
		console.error("Failed to fetch assets:", error);
		return [];
	}
};

export const simulateSwap = async ({
	offerAssetAddress,
	askAssetAddress,
	offerAmount,
	askAmount,
	slippageTolerancePercent = 1,
	referralAddress,
	referralValue,
	decimalsOffer,
	decimalsAsk,
}: SimulateSwapParams) => {
	if (!offerAssetAddress || !askAssetAddress) {
		throw new Error("Missing asset addresses");
	}

	const slippageTolerance = (slippageTolerancePercent / 100).toString();
	const baseParams = {
		offerAddress: offerAssetAddress,
		askAddress: askAssetAddress,
		slippageTolerance,
		referralAddress,
		referralFeeBps: referralValue?.toString(),
		dexV2: true,
	};

	if (offerAmount) {
		const offerUnits = floatToBigNumber(offerAmount, decimalsOffer).toString();
		return stonApiClient.simulateSwap({ ...baseParams, offerUnits });
	}

	if (askAmount) {
		const askUnits = floatToBigNumber(askAmount, decimalsAsk).toString();
		return stonApiClient.simulateReverseSwap({ ...baseParams, askUnits });
	}

	throw new Error("Either offerAmount or askAmount must be specified");
};

export const buildSwapTransaction = async (
	swapSimulation: SwapSimulation,
	userWalletAddress: string,
	params?: {
		queryId?: number;
		referralAddress?: string;
		referralValue?: number;
	},
): Promise<SendTransactionRequest["messages"]> => {
	const routerInfo = await stonApiClient.getRouter(
		swapSimulation.routerAddress,
	);
	if (!routerInfo) {
		throw new Error(`Router ${swapSimulation.routerAddress} not found`);
	}

	const dexContracts = dexFactory(routerInfo);
	const routerContract = tonApiClient.open(
		dexContracts.Router.create(routerInfo.address),
	);
	const proxyTon = dexContracts.pTON.create(routerInfo.ptonMasterAddress);

	const TON_ADDRESS = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
	const isTonOffer = swapSimulation.offerAddress === TON_ADDRESS;
	const isTonAsk = swapSimulation.askAddress === TON_ADDRESS;

	const txParams =
		!isTonOffer && !isTonAsk
			? await routerContract.getSwapJettonToJettonTxParams({
					userWalletAddress,
					offerJettonAddress: swapSimulation.offerAddress,
					offerAmount: swapSimulation.offerUnits,
					askJettonAddress: swapSimulation.askAddress,
					minAskAmount: swapSimulation.minAskUnits,
					...params,
				})
			: isTonOffer
				? await routerContract.getSwapTonToJettonTxParams({
						userWalletAddress,
						proxyTon,
						offerAmount: swapSimulation.offerUnits,
						askJettonAddress: swapSimulation.askAddress,
						minAskAmount: swapSimulation.minAskUnits,
						...params,
					})
				: await routerContract.getSwapJettonToTonTxParams({
						userWalletAddress,
						proxyTon,
						offerJettonAddress: swapSimulation.offerAddress,
						offerAmount: swapSimulation.offerUnits,
						minAskAmount: swapSimulation.minAskUnits,
						...params,
					});

	return [
		{
			address: txParams.to.toString(),
			amount: txParams.value.toString(),
			payload: txParams.body?.toBoc().toString("base64"),
		},
	];
};
