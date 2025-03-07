import type { LiquidityProvisionType } from "@ston-fi/api";
import type {
	AssetInfoV2,
	LiquidityProvisionSimulation,
	RouterInfo,
} from "@ston-fi/api";
import { dexFactory } from "@ston-fi/sdk";
import { stonApiClient, tonApiClient } from "./clients";
import { floatToBigNumber } from "./utils";

/** Types for liquidity provisioning simulation */
export type SimulateLiquidityProvisionParams = {
	provisionType: LiquidityProvisionType;
	poolAddress?: string;
	walletAddress?: string;
	tokenA: string;
	tokenB: string;
	tokenAUnits?: string;
	tokenBUnits?: string;
	slippageTolerance?: string; // e.g. "0.001"
};

/**
 * Simulate liquidity provision.
 * Uses early returns to reduce nesting.
 */
export async function simulateLiquidityProvision(
	params: SimulateLiquidityProvisionParams,
): Promise<LiquidityProvisionSimulation> {
	const {
		provisionType,
		walletAddress,
		tokenA,
		tokenB,
		tokenAUnits,
		tokenBUnits,
		poolAddress,
		slippageTolerance = "0.001",
	} = params;

	// Common base parameters
	const baseParams = {
		tokenA,
		tokenB,
		slippageTolerance,
		walletAddress,
	};

	// 1) Initial
	if (provisionType === "Initial") {
		if (!tokenAUnits || !tokenBUnits) {
			throw new Error("Initial provision requires both token amounts.");
		}
		return stonApiClient.simulateLiquidityProvision({
			...baseParams,
			provisionType: "Initial",
			tokenAUnits,
			tokenBUnits,
		});
	}

	// 2) Balanced
	if (provisionType === "Balanced") {
		if (!poolAddress) {
			throw new Error("Balanced provision requires pool address.");
		}
		// Balanced simulation requires one token amount
		// If both are provided, we prioritize tokenA
		// If neither is provided, default to 1 unit of tokenB
		const selectedUnits = tokenAUnits
			? { tokenAUnits }
			: { tokenBUnits: tokenBUnits || "1" };

		return stonApiClient.simulateLiquidityProvision({
			...baseParams,
			provisionType: "Balanced",
			poolAddress,
			...selectedUnits,
		});
	}

	// Unknown
	throw new Error(`Unknown provision type: ${provisionType}`);
}

/**
 * Build transaction parameters for a single side deposit.
 * We derive routerContract and proxyTon internally from routerInfo.
 */
interface BuildTwoSideDepositTxParams {
	routerInfo: RouterInfo;
	sideToken: AssetInfoV2;
	sideAmount: string;
	otherToken: AssetInfoV2;
	walletAddress: string;
	minLpOut: string;
}

export async function buildTwoSideDepositTx({
	routerInfo,
	sideToken,
	sideAmount,
	otherToken,
	walletAddress,
	minLpOut,
}: BuildTwoSideDepositTxParams) {
	const dexContracts = dexFactory(routerInfo);
	const routerContract = tonApiClient.open(
		dexContracts.Router.create(routerInfo.address),
	);
	const proxyTon = dexContracts.pTON.create(routerInfo.ptonMasterAddress);

	// Convert sideAmount to BigInt using optional decimals
	const sendAmount = floatToBigNumber(sideAmount, sideToken.meta?.decimals);

	const isTonSide = sideToken.kind === "Ton";

	if (isTonSide) {
		return routerContract.getProvideLiquidityTonTxParams({
			userWalletAddress: walletAddress,
			proxyTon,
			sendAmount,
			otherTokenAddress: otherToken.contractAddress,
			minLpOut,
		});
	} else {
		// If the other token is TON, we pass the pTon address as "otherTokenAddress"
		const otherIsTon = otherToken.kind === "Ton";
		const otherAddress = otherIsTon
			? proxyTon.address.toString()
			: otherToken.contractAddress;

		return routerContract.getProvideLiquidityJettonTxParams({
			userWalletAddress: walletAddress,
			sendTokenAddress: sideToken.contractAddress,
			sendAmount: sendAmount.toString(),
			otherTokenAddress: otherAddress,
			minLpOut,
		});
	}
}
