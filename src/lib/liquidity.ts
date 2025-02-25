import type { LiquidityProvisionType } from "@ston-fi/api";
import type {
	AssetInfoV2,
	LiquidityProvisionSimulation,
	RouterInfo,
} from "@ston-fi/api";
import { dexFactory } from "@ston-fi/sdk";
import { stonApiClient } from "./clients";
import { tonApiClient } from "./clients";
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
		...(walletAddress && { walletAddress }),
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
		if (!tokenAUnits && !tokenBUnits) {
			throw new Error("Balanced provision requires at least one token amount.");
		}
		// Balanced can take either A or B units, not both
		const selectedUnits = tokenAUnits
			? { tokenAUnits }
			: { tokenBUnits: tokenBUnits! };

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
	queryId: number;
	walletAddress: string;
}

export async function buildTwoSideDepositTx({
	routerInfo,
	sideToken,
	sideAmount,
	otherToken,
	queryId,
	walletAddress,
}: BuildTwoSideDepositTxParams) {
	const dexContracts = dexFactory(routerInfo);
	const routerContract = tonApiClient.open(
		dexContracts.Router.create(routerInfo.address),
	);
	const proxyTon = dexContracts.pTON.create(routerInfo.ptonMasterAddress);

	// Convert sideAmount to BigInt
	const isTonSide = sideToken.kind === "Ton";

	// For TON we use floatToBigNumber as well, but we must treat it as 9 decimals or just parse it with toNano
	// For simplicity, assume decimals=9 if Ton. This approach is consistent with 'toNano' usage.
	const decimals =
		sideToken.kind === "Ton" ? 9 : (sideToken.meta?.decimals ?? 9);
	const sendAmount = floatToBigNumber(sideAmount, decimals);

	if (isTonSide) {
		return routerContract.getProvideLiquidityTonTxParams({
			userWalletAddress: walletAddress,
			proxyTon,
			sendAmount,
			otherTokenAddress: otherToken.contractAddress,
			minLpOut: "1",
			queryId,
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
			minLpOut: "1",
			queryId,
		});
	}
}
