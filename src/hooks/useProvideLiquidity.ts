import type {
	AssetInfoV2,
	LiquidityProvisionType,
	RouterInfo,
} from "@ston-fi/api";
import { useQuery } from "@tanstack/react-query";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useCallback, useEffect, useState } from "react";
import { stonApiClient } from "../lib/clients";
import { buildTwoSideDepositTx } from "../lib/liquidity";
import { fetchAssets } from "../lib/swap";
import { parseAmountValue } from "../lib/utils";
import {
	getUpdatedBalancedAmounts,
	useSimulateLiquidity,
} from "./useSimulateLiquidity";

/**
 * Type guard for errors with optional 'data' property
 */
const isApiError = (error: unknown): error is { data?: string } =>
	typeof error === "object" && error !== null && "data" in error;

/**
 * Validate liquidity provision inputs
 *
 */
const validateProvide = (
	tokenA: AssetInfoV2 | null,
	tokenB: AssetInfoV2 | null,
	amountA: string,
	amountB: string,
	isWalletConnected: boolean,
): string | null => {
	if (!tokenA || !tokenB) {
		return "Please select both tokens (A and B).";
	}

	if (!isWalletConnected) {
		return "Please connect your wallet.";
	}
	// Convert user inputs to numeric
	const valA = parseAmountValue(amountA);
	const valB = parseAmountValue(amountB);

	// Check if both tokens have amounts
	const hasBothAmounts = valA > 0 && valB > 0;

	if (!isWalletConnected) {
		return "Please connect your wallet.";
	}

	if (!hasBothAmounts) {
		return "Both token amounts must be greater than 0.";
	}

	return null;
};

/**
 * Hook to retrieve a suitable router (v2.2 with poolCreationEnabled)
 */
const useSuitableRouter = () =>
	useQuery<RouterInfo[], Error, RouterInfo | undefined>({
		queryKey: ["availableRouters"],
		queryFn: () => stonApiClient.getRouters(),
		select: (routers) =>
			routers.find((router) => {
				const isLatest = router.majorVersion === 2 && router.minorVersion === 2;
				const isPoolCreationEnabled = router.poolCreationEnabled;

				return isLatest && isPoolCreationEnabled;
			}),
	});

/**
 * Form data type for liquidity provision
 */
type LiquidityFormData = {
	tokenA: AssetInfoV2 | null;
	tokenB: AssetInfoV2 | null;
	amountA: string;
	amountB: string;
	firstChangedSide: "A" | "B" | null;
	activeSide: "A" | "B" | null;
	provisionType: LiquidityProvisionType;
	poolAddress?: string;
	provisionHistory: LiquidityProvisionType[];
};

/**
 * Hook for providing liquidity with simulation support
 */
export const useProvideLiquidity = () => {
	const walletAddress = useTonAddress();
	const [tonConnectUI] = useTonConnectUI();
	const isWalletConnected = Boolean(walletAddress);

	// Form state
	const [formData, setFormData] = useState<LiquidityFormData>({
		tokenA: null,
		tokenB: null,
		amountA: "",
		amountB: "",
		firstChangedSide: null,
		activeSide: null,
		provisionType: "Initial",
		poolAddress: undefined,
		provisionHistory: [],
	});

	// UI state
	const [error, setError] = useState("");
	const [loadingTx, setLoadingTx] = useState(false);
	const [allAssets, setAllAssets] = useState<AssetInfoV2[]>([]);

	// Load assets when wallet connects
	useEffect(() => {
		if (!isWalletConnected) {
			setAllAssets([]);
			return;
		}
		fetchAssets(walletAddress).then(setAllAssets).catch(console.error);
	}, [isWalletConnected, walletAddress]);

	// Get router
	const {
		data: matchedRouter,
		isLoading: isRoutersLoading,
		error: routersError,
	} = useSuitableRouter();

	// Run simulation
	const {
		data: lpSimulation,
		isLoading: loadingSimulation,
		error: simulationError,
	} = useSimulateLiquidity({
		walletAddress,
		tokenA: formData.tokenA || undefined,
		tokenB: formData.tokenB || undefined,
		amountA: formData.amountA,
		amountB: formData.amountB,
		provisionType: formData.provisionType,
		poolAddress: formData.poolAddress,
		activeSide: formData.activeSide,
	});

	// Auto-update other side for Balanced mode
	useEffect(() => {
		if (!lpSimulation) return;

		const { amountA, amountB } = getUpdatedBalancedAmounts(
			formData.provisionType,
			formData.activeSide,
			formData.amountA,
			formData.amountB,
			formData.tokenA || undefined,
			formData.tokenB || undefined,
			lpSimulation,
		);

		if (amountA !== formData.amountA || amountB !== formData.amountB) {
			setFormData((prev) => ({ ...prev, amountA, amountB }));
		}
	}, [
		lpSimulation,
		formData.amountA,
		formData.amountB,
		formData.provisionType,
		formData.activeSide,
		formData.tokenA,
		formData.tokenB,
	]);

	// Handle "already exists" error for Initial mode
	useEffect(() => {
		if (!simulationError || formData.provisionType !== "Initial") return;
		if (!isApiError(simulationError)) return;

		const errorMsg = simulationError.data;
		if (typeof errorMsg !== "string") return;

		// Support both regex patterns for pool already exists errors
		const standardMatch = errorMsg.match(/already exists:\s*(\S+)/);
		const alternateMatch = errorMsg.match(
			/already exists for selected type of router: \[(.*?)\]/,
		);

		// Extract pool address from either match pattern
		const poolAddress =
			standardMatch?.[1] ||
			(alternateMatch ? alternateMatch[1].split(",")[0].trim() : null);
		if (!poolAddress) return;

		setFormData((prev) => {
			const newHistory = prev.provisionHistory.includes("Balanced")
				? prev.provisionHistory
				: [...prev.provisionHistory, "Balanced" as LiquidityProvisionType];

			const nextActiveSide =
				prev.firstChangedSide ||
				(prev.amountA ? "A" : prev.amountB ? "B" : null);

			return {
				...prev,
				provisionType: "Balanced" as LiquidityProvisionType,
				poolAddress,
				provisionHistory: newHistory,
				activeSide: nextActiveSide,
			};
		});
	}, [simulationError, formData.provisionType]);

	// Token change handler
	const handleTokenChange =
		(side: "A" | "B") => (asset: AssetInfoV2 | null) => {
			setFormData((prev) => {
				const oldAsset = side === "A" ? prev.tokenA : prev.tokenB;
				const oldAddress = oldAsset?.contractAddress;
				const newAddress = asset?.contractAddress;

				let newState = {
					...prev,
					...(side === "A"
						? { tokenA: asset, amountA: "" }
						: { tokenB: asset, amountB: "" }),
				};

				// If the user is actually switching token (different from old one),
				// reset form to "Initial" and clear amounts so no unwanted simulation occurs.
				if (oldAddress && newAddress && oldAddress !== newAddress) {
					newState = {
						...newState,
						provisionType: "Initial",
						activeSide: null,
						firstChangedSide: null,
						amountA: "",
						amountB: "",
						poolAddress: undefined,
						provisionHistory: [],
					};
				}

				return newState;
			});
		};

	// Amount change handler
	const handleAmountChange = (side: "A" | "B") => (amount: string) => {
		setFormData((prev) => {
			const firstChange =
				!prev.firstChangedSide && amount ? side : prev.firstChangedSide;
			const nextActiveSide =
				prev.provisionType === "Balanced" ? side : prev.activeSide;

			return {
				...prev,
				["amount" + side]: amount,
				firstChangedSide: firstChange,
				activeSide: nextActiveSide,
			};
		});
	};
	// Provide liquidity handler
	const handleProvide = useCallback(async () => {
		setError("");

		// Validate inputs
		const validationErr = validateProvide(
			formData.tokenA,
			formData.tokenB,
			formData.amountA,
			formData.amountB,
			isWalletConnected,
		);
		if (validationErr) {
			setError(validationErr);
			return;
		}

		if (!matchedRouter || !walletAddress) {
			setError("No suitable router found or wallet not connected.");
			return;
		}

		// We need minLpUnits from the simulation to respect slippage.
		if (!lpSimulation?.minLpUnits) {
			setError(
				"Unable to retrieve simulation data or minLpUnits. Please try again.",
			);
			return;
		}

		try {
			setLoadingTx(true);

			// Use the simulation's minLpUnits for both deposit transactions
			const minLpOut = lpSimulation.minLpUnits;

			const txParamsA = await buildTwoSideDepositTx({
				routerInfo: matchedRouter,
				sideToken: formData.tokenA!,
				sideAmount: formData.amountA,
				otherToken: formData.tokenB!,
				walletAddress,
				minLpOut,
			});

			const txParamsB = await buildTwoSideDepositTx({
				routerInfo: matchedRouter,
				sideToken: formData.tokenB!,
				sideAmount: formData.amountB,
				otherToken: formData.tokenA!,
				walletAddress,
				minLpOut,
			});

			const messages = [txParamsA, txParamsB].map((tx) => ({
				address: tx.to.toString(),
				amount: tx.value.toString(),
				payload: tx.body?.toBoc().toString("base64"),
			}));

			await tonConnectUI.sendTransaction({
				validUntil: Date.now() + 5 * 60 * 1000,
				messages,
			});
		} catch (err: any) {
			console.error(err);
			setError(err?.message || "Failed to provide liquidity");
		} finally {
			setLoadingTx(false);
		}
	}, [
		formData,
		isWalletConnected,
		matchedRouter,
		walletAddress,
		tonConnectUI,
		lpSimulation,
	]);

	return {
		isWalletConnected,
		allAssets,

		// Input data
		tokenA: formData.tokenA,
		tokenB: formData.tokenB,
		amountA: formData.amountA,
		amountB: formData.amountB,
		provisionType: formData.provisionType,

		// Simulation state
		lpSimulation,
		simulationError: simulationError?.message || "",
		loadingSimulation,
		loadingTx,
		error,
		isRoutersLoading,
		routersError,
		matchedRouter,

		// Updaters
		setProvisionType: (type: LiquidityProvisionType) =>
			setFormData((prev) => {
				const newHistory = prev.provisionHistory.includes(type)
					? prev.provisionHistory
					: [...prev.provisionHistory, type];
				return { ...prev, provisionType: type, provisionHistory: newHistory };
			}),
		handleTokenAChange: handleTokenChange("A"),
		handleTokenBChange: handleTokenChange("B"),
		handleAmountAChange: handleAmountChange("A"),
		handleAmountBChange: handleAmountChange("B"),
		handleProvide,
	};
};
