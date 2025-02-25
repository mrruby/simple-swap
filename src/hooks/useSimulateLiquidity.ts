import type {
	AssetInfoV2,
	LiquidityProvisionSimulation,
	LiquidityProvisionType,
} from "@ston-fi/api";
import { useQuery } from "@tanstack/react-query";
import { simulateLiquidityProvision } from "../lib/liquidity";
import { formatAmount, toTokenUnits } from "../lib/utils";
import { useDebounce } from "./useDebounce";

/**
 * Types for the input to the simulation hook
 */
export interface UseSimulateLiquidityParams {
	walletAddress?: string;
	/**
	 * Full token objects so we can access addresses and decimals.
	 */
	tokenA?: AssetInfoV2;
	tokenB?: AssetInfoV2;
	amountA?: string;
	amountB?: string;
	provisionType: LiquidityProvisionType;
	poolAddress?: string;
	/**
	 * For Balanced, we only pass one side's amount. This is determined by activeSide.
	 */
	activeSide?: "A" | "B" | null;
}

/**
 * Hook to simulate liquidity provisioning with debounced inputs.
 * Uses early returns and pure helper functions.
 */
export function useSimulateLiquidity(params: UseSimulateLiquidityParams) {
	const {
		walletAddress,
		tokenA,
		tokenB,
		amountA,
		amountB,
		provisionType,
		poolAddress,
		activeSide,
	} = params;

	// Debounce user inputs
	const debouncedAmountA = useDebounce(amountA, 500);
	const debouncedAmountB = useDebounce(amountB, 500);
	const debouncedSide = useDebounce(activeSide, 500);

	// Determine if the simulation can run
	const isEnabled = Boolean(
		walletAddress &&
			tokenA &&
			tokenB &&
			(provisionType === "Balanced"
				? debouncedAmountA || debouncedAmountB
				: debouncedAmountA && debouncedAmountB),
	);

	return useQuery<
		LiquidityProvisionSimulation | null,
		Error,
		LiquidityProvisionSimulation | null,
		readonly (string | number | undefined | null)[]
	>({
		queryKey: [
			"simulateLiquidity",
			walletAddress,
			tokenA?.contractAddress,
			tokenB?.contractAddress,
			debouncedAmountA,
			debouncedAmountB,
			provisionType,
			poolAddress,
			debouncedSide,
		],
		queryFn: async () => {
			if (!isEnabled) {
				return null;
			}

			// Get decimals from token objects
			const decimalsA = tokenA?.meta?.decimals ?? 9;
			const decimalsB = tokenB?.meta?.decimals ?? 9;

			// Convert amounts to token units based on decimals
			const tokenAUnits = debouncedAmountA
				? toTokenUnits(debouncedAmountA, decimalsA)
				: undefined;
			const tokenBUnits = debouncedAmountB
				? toTokenUnits(debouncedAmountB, decimalsB)
				: undefined;

			// For Balanced, only pass the active side's units
			const finalTokenAUnits =
				provisionType === "Balanced" && debouncedSide === "B"
					? undefined
					: tokenAUnits;
			const finalTokenBUnits =
				provisionType === "Balanced" && debouncedSide === "A"
					? undefined
					: tokenBUnits;

			return simulateLiquidityProvision({
				walletAddress,
				tokenA: tokenA!.contractAddress,
				tokenB: tokenB!.contractAddress,
				provisionType,
				poolAddress,
				tokenAUnits: finalTokenAUnits,
				tokenBUnits: finalTokenBUnits,
				slippageTolerance: "0.001",
			});
		},
		enabled: isEnabled,
		retry: false,
	});
}

/**
 * For Balanced, we auto-update the other side using data from simulation.
 * Pure function that returns updated amounts based on simulation data.
 */
export function getUpdatedBalancedAmounts(
	provisionType: LiquidityProvisionType,
	activeSide: "A" | "B" | null,
	currentA: string,
	currentB: string,
	tokenA?: AssetInfoV2,
	tokenB?: AssetInfoV2,
	simulation?: LiquidityProvisionSimulation | null,
): { amountA: string; amountB: string } {
	// Early return if no simulation or not Balanced
	if (!simulation || provisionType !== "Balanced" || !tokenA || !tokenB) {
		return { amountA: currentA, amountB: currentB };
	}

	const { tokenAUnits, tokenBUnits } = simulation;
	const decimalsA = tokenA.meta?.decimals ?? 9;
	const decimalsB = tokenB.meta?.decimals ?? 9;

	// Update B amount if A is active and we have B units
	if (activeSide === "A" && tokenBUnits) {
		return {
			amountA: currentA,
			amountB: formatAmount(tokenBUnits, decimalsB),
		};
	}

	// Update A amount if B is active and we have A units
	if (activeSide === "B" && tokenAUnits) {
		return {
			amountA: formatAmount(tokenAUnits, decimalsA),
			amountB: currentB,
		};
	}

	// Keep amounts as-is if no active side or missing data
	return { amountA: currentA, amountB: currentB };
}
