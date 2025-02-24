import type { LiquidityProvisionType } from "@ston-fi/api";
import { stonApiClient } from "./clients";

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
 */
export async function simulateLiquidityProvision(
	params: SimulateLiquidityProvisionParams,
) {
	const baseParams = {
		tokenA: params.tokenA,
		tokenB: params.tokenB,
		slippageTolerance: params.slippageTolerance ?? "0.001",
		...(params.walletAddress && { walletAddress: params.walletAddress }),
	};

	switch (params.provisionType) {
		case "Initial":
			if (!params.tokenAUnits || !params.tokenBUnits) {
				throw new Error("Initial provision requires both token amounts");
			}
			return stonApiClient.simulateLiquidityProvision({
				...baseParams,
				provisionType: "Initial",
				tokenAUnits: params.tokenAUnits,
				tokenBUnits: params.tokenBUnits,
			});

		case "Balanced":
			if (!params.poolAddress) {
				throw new Error("Balanced provision requires pool address");
			}
			if (!params.tokenAUnits && !params.tokenBUnits) {
				throw new Error(
					"Balanced provision requires at least one token amount",
				);
			}
			// If both token amounts are provided, choose tokenAUnits by default
			const selectedUnits = params.tokenAUnits
				? { tokenAUnits: params.tokenAUnits }
				: { tokenBUnits: params.tokenBUnits! };
			return stonApiClient.simulateLiquidityProvision({
				...baseParams,
				provisionType: "Balanced",
				poolAddress: params.poolAddress,
				...selectedUnits,
			});

		case "Arbitrary":
			if (!params.poolAddress || !params.tokenAUnits || !params.tokenBUnits) {
				throw new Error(
					"Arbitrary provision requires pool address and both token amounts",
				);
			}
			return stonApiClient.simulateLiquidityProvision({
				...baseParams,
				provisionType: "Arbitrary",
				poolAddress: params.poolAddress,
				tokenAUnits: params.tokenAUnits,
				tokenBUnits: params.tokenBUnits,
			});

		default:
			throw new Error(`Unknown provision type: ${params.provisionType}`);
	}
}
