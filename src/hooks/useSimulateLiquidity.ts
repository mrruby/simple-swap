import type {
	LiquidityProvisionSimulation,
	LiquidityProvisionType,
} from "@ston-fi/api";
import { useQuery } from "@tanstack/react-query";
import { simulateLiquidityProvision } from "../lib/liquidity";
import { floatToBigNumber, formatAmount } from "../lib/utils";
import { useDebounce } from "./useDebounce";

/**
 * Types for the input to the simulation hook
 */
export interface UseSimulateLiquidityParams {
	walletAddress?: string;
	tokenA?: string;
	tokenB?: string;
	amountA?: string;
	amountB?: string;
	provisionType: LiquidityProvisionType;
	poolAddress?: string;
	decimalsA: number;
	decimalsB: number;
	/**
	 * For Balanced, we only pass one side's amount. This is determined by activeSide.
	 */
	activeSide?: "A" | "B" | null;
}

/**
 * Use this hook to simulate liquidity provision with debounced input values.
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
		decimalsA,
		decimalsB,
		activeSide,
	} = params;

	// Debounce amounts
	const debouncedAmountA = useDebounce(amountA, 500);
	const debouncedAmountB = useDebounce(amountB, 500);
	// Debounce activeSide so that we don't thrash simulations
	const debouncedActiveSide = useDebounce(activeSide, 500);

	/**
	 * If we don't have enough input data to run the simulation,
	 * we can disable the query or return early.
	 */
	const isEnabled = Boolean(
		walletAddress &&
			tokenA &&
			tokenB &&
			(provisionType === "Balanced"
				? // Balanced requires at least one side
					debouncedAmountA || debouncedAmountB
				: // "Initial" or "Arbitrary" require both sides
					debouncedAmountA && debouncedAmountB),
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
			tokenA,
			tokenB,
			debouncedAmountA,
			debouncedAmountB,
			provisionType,
			poolAddress,
			debouncedActiveSide,
			decimalsA,
			decimalsB,
		],
		queryFn: async () => {
			if (!isEnabled) {
				return null;
			}

			// Prepare token units
			let tokenAUnits: string | undefined;
			let tokenBUnits: string | undefined;

			if (provisionType === "Balanced") {
				// We only pass the side indicated by activeSide
				if (debouncedActiveSide === "A" && debouncedAmountA) {
					tokenAUnits = floatToBigNumber(
						debouncedAmountA,
						decimalsA,
					).toString();
				} else if (debouncedActiveSide === "B" && debouncedAmountB) {
					tokenBUnits = floatToBigNumber(
						debouncedAmountB,
						decimalsB,
					).toString();
				} else {
					// If no side is set, fallback to whichever side is non-empty
					if (debouncedAmountA) {
						tokenAUnits = floatToBigNumber(
							debouncedAmountA,
							decimalsA,
						).toString();
					} else if (debouncedAmountB) {
						tokenBUnits = floatToBigNumber(
							debouncedAmountB,
							decimalsB,
						).toString();
					}
				}

				// Balanced requires a poolAddress
				if (!poolAddress) {
					throw new Error(
						"Balanced provision requires an existing poolAddress",
					);
				}

				if (!tokenAUnits && !tokenBUnits) {
					// No input side => no simulation
					return null;
				}

				return simulateLiquidityProvision({
					provisionType: "Balanced",
					poolAddress,
					walletAddress,
					tokenA: tokenA!,
					tokenB: tokenB!,
					tokenAUnits,
					tokenBUnits,
					slippageTolerance: "0.001",
				});
			} else {
				// "Initial" or "Arbitrary" require both amounts
				if (!debouncedAmountA || !debouncedAmountB) {
					return null;
				}
				tokenAUnits = floatToBigNumber(debouncedAmountA, decimalsA).toString();
				tokenBUnits = floatToBigNumber(debouncedAmountB, decimalsB).toString();

				if (provisionType === "Initial") {
					return simulateLiquidityProvision({
						provisionType: "Initial",
						walletAddress,
						tokenA: tokenA!,
						tokenB: tokenB!,
						tokenAUnits,
						tokenBUnits,
						slippageTolerance: "0.001",
					});
				} else {
					// "Arbitrary"
					if (!poolAddress) {
						throw new Error("Arbitrary provision requires poolAddress");
					}
					return simulateLiquidityProvision({
						provisionType: "Arbitrary",
						poolAddress,
						walletAddress,
						tokenA: tokenA!,
						tokenB: tokenB!,
						tokenAUnits,
						tokenBUnits,
						slippageTolerance: "0.001",
					});
				}
			}
		},
		enabled: isEnabled,
		retry: false,
	});
}

/**
 * Utility to update the "other" side of Balanced provisioning after simulation.
 * For Balanced, we read from the simulation whichever side is not activeSide
 * so the amounts reflect a balanced ratio.
 */
export function getUpdatedBalancedAmounts(
	provisionType: LiquidityProvisionType,
	activeSide: "A" | "B" | null,
	currentA: string,
	currentB: string,
	decimalsA: number,
	decimalsB: number,
	simulation?: LiquidityProvisionSimulation | null,
) {
	if (!simulation) {
		return { amountA: currentA, amountB: currentB };
	}

	if (provisionType !== "Balanced") {
		return { amountA: currentA, amountB: currentB };
	}

	// For Balanced, we read from the simulation whichever side is not activeSide
	// so the amounts reflect a balanced ratio. We'll replace the other side only.
	// If activeSide === "A", we override B with the simulated tokenBUnits.
	// If activeSide === "B", we override A with the simulated tokenAUnits.
	if (activeSide === "A" && simulation.tokenBUnits) {
		return {
			amountA: currentA,
			amountB: formatAmount(simulation.tokenBUnits, decimalsB),
		};
	} else if (activeSide === "B" && simulation.tokenAUnits) {
		return {
			amountA: formatAmount(simulation.tokenAUnits, decimalsA),
			amountB: currentB,
		};
	}

	// If no side was determined, or there's no updated amounts, keep as-is
	return { amountA: currentA, amountB: currentB };
}
