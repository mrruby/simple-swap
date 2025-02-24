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
 * Uses early returns to reduce nesting.
 */
export async function simulateLiquidityProvision(
	params: SimulateLiquidityProvisionParams,
) {
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

	// 3) Arbitrary
	if (provisionType === "Arbitrary") {
		if (!poolAddress || !tokenAUnits || !tokenBUnits) {
			throw new Error(
				"Arbitrary provision requires pool address and both token amounts.",
			);
		}
		return stonApiClient.simulateLiquidityProvision({
			...baseParams,
			provisionType: "Arbitrary",
			poolAddress,
			tokenAUnits,
			tokenBUnits,
		});
	}

	// Unknown
	throw new Error(`Unknown provision type: ${provisionType}`);
}
