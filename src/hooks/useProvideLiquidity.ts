import type {
	AssetInfoV2,
	LiquidityProvisionType,
	RouterInfo,
} from "@ston-fi/api";
import { DEX, pTON } from "@ston-fi/sdk";
import { useQuery } from "@tanstack/react-query";
import { toNano } from "@ton/ton";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useCallback, useEffect, useState } from "react";
import { stonApiClient, tonApiClient } from "../lib/clients";
import { fetchAssets } from "../lib/swap";
import { floatToBigNumber } from "../lib/utils";
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
 * Parse amount for token or TON with appropriate decimals
 */
const parseAmountForToken = (token: AssetInfoV2, amount: string): bigint => 
	token.kind === "Ton"
		? toNano(amount)
		: floatToBigNumber(amount, token.meta?.decimals ?? 9);

/**
 * Build transaction parameters for a single side deposit
 */
const buildTwoSideDepositTx = async (
	routerContract: InstanceType<typeof DEX.v2_2.Router>,
	isTonSide: boolean,
	sideToken: AssetInfoV2,
	sideAmount: string,
	otherToken: AssetInfoV2,
	proxyTon: InstanceType<typeof pTON.v2_1>,
	queryId: number,
	walletAddress: string,
) => {
	const sendAmount = parseAmountForToken(sideToken, sideAmount);

	if (isTonSide) {
		return routerContract.getProvideLiquidityTonTxParams(
			tonApiClient.provider(routerContract.address),
			{
				userWalletAddress: walletAddress,
				proxyTon,
				sendAmount,
				otherTokenAddress: otherToken.contractAddress,
				minLpOut: "1",
				queryId,
			},
		);
	}

	const otherIsTon = otherToken.kind === "Ton";
	const otherAddress = otherIsTon
		? proxyTon.address.toString()
		: otherToken.contractAddress;

	return routerContract.getProvideLiquidityJettonTxParams(
		tonApiClient.provider(routerContract.address),
		{
			userWalletAddress: walletAddress,
			sendTokenAddress: sideToken.contractAddress,
			sendAmount: sendAmount.toString(),
			otherTokenAddress: otherAddress,
			minLpOut: "1",
			queryId,
		},
	);
};

/**
 * Validate liquidity provision inputs
 */
const validateProvide = (
	tokenA: AssetInfoV2 | null,
	tokenB: AssetInfoV2 | null,
	amountA: string,
	amountB: string,
	provisionType: LiquidityProvisionType,
	isWalletConnected: boolean,
): string | null => {
	if (!tokenA || !tokenB) {
		return "Please select both tokens (A and B).";
	}
	if (!isWalletConnected) {
		return "Please connect your wallet.";
	}

	const hasA = !!amountA;
	const hasB = !!amountB;

	// Balanced requires at least one side
	if (provisionType === "Balanced" && !hasA && !hasB) {
		return "For 'Balanced' provisioning, enter at least one token amount.";
	}

	// "Initial" or "Arbitrary" require both sides
	if ((provisionType === "Initial" || provisionType === "Arbitrary") && (!hasA || !hasB)) {
		return `For '${provisionType}' provisioning, please enter both token amounts.`;
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
			routers.find(
				(r) => r.majorVersion === 2 && r.minorVersion === 2 && r.poolCreationEnabled,
			),
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
		fetchAssets(walletAddress)
			.then(setAllAssets)
			.catch(console.error);
	}, [isWalletConnected, walletAddress]);

	// Get router
	const {
		data: matchedRouter,
		isLoading: isRoutersLoading,
		error: routersError,
	} = useSuitableRouter();

	// Run simulation
	const decimalsA = formData.tokenA?.meta?.decimals ?? 9;
	const decimalsB = formData.tokenB?.meta?.decimals ?? 9;

	const {
		data: lpSimulation,
		isLoading: loadingSimulation,
		error: simulationError,
	} = useSimulateLiquidity({
		walletAddress,
		tokenA: formData.tokenA?.contractAddress,
		tokenB: formData.tokenB?.contractAddress,
		amountA: formData.amountA,
		amountB: formData.amountB,
		provisionType: formData.provisionType,
		poolAddress: formData.poolAddress,
		decimalsA,
		decimalsB,
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
			decimalsA,
			decimalsB,
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
		decimalsA,
		decimalsB,
	]);

	// Handle "already exists" error for Initial mode
	useEffect(() => {
		if (!simulationError || formData.provisionType !== "Initial") return;
		if (!isApiError(simulationError)) return;

		const errorMsg = simulationError.data;
		if (typeof errorMsg !== "string") return;

		const match = errorMsg.match(/already exists:\s*(\S+)/);
		if (!match?.[1]) return;

		setFormData((prev) => {
			const newHistory = prev.provisionHistory.includes("Balanced")
				? prev.provisionHistory
				: [...prev.provisionHistory, "Balanced" as LiquidityProvisionType];

			const nextActiveSide = prev.firstChangedSide || 
				(prev.amountA ? "A" : prev.amountB ? "B" : null);

			return {
				...prev,
				provisionType: "Balanced" as LiquidityProvisionType,
				poolAddress: match[1],
				provisionHistory: newHistory,
				activeSide: nextActiveSide,
			};
		});
	}, [simulationError, formData.provisionType]);

	// Token change handler
	const handleTokenChange = useCallback(
		(side: "A" | "B") => (asset: AssetInfoV2 | null) => {
			setFormData((prev) => ({
				...prev,
				[`token${side}`]: asset,
				[`amount${side}`]: "",
				activeSide: prev.provisionType === "Balanced" ? side : prev.activeSide,
			}));
		},
		[],
	);

	// Amount change handler
	const handleAmountChange = useCallback(
		(side: "A" | "B") => (amount: string) => {
			setFormData((prev) => {
				const firstChange = !prev.firstChangedSide && amount ? side : prev.firstChangedSide;
				const nextActiveSide = prev.provisionType === "Balanced" ? side : prev.activeSide;

				return {
					...prev,
					[`amount${side}`]: amount,
					firstChangedSide: firstChange,
					activeSide: nextActiveSide,
				};
			});
		},
		[],
	);

	// Provide liquidity handler
	const handleProvide = useCallback(async () => {
		setError("");

		// Validate inputs
		const validationErr = validateProvide(
			formData.tokenA,
			formData.tokenB,
			formData.amountA,
			formData.amountB,
			formData.provisionType,
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

		try {
			setLoadingTx(true);

			const routerContract = DEX.v2_2.Router.create(matchedRouter.address);
			const proxyTon = pTON.v2_1.create(matchedRouter.ptonMasterAddress);

			const isTonA = formData.tokenA!.kind === "Ton";
			const isTonB = formData.tokenB!.kind === "Ton";

			const queryIdBase = Date.now();
			const txParamsA = await buildTwoSideDepositTx(
				routerContract,
				isTonA,
				formData.tokenA!,
				formData.amountA,
				formData.tokenB!,
				proxyTon,
				queryIdBase,
				walletAddress,
			);
			const txParamsB = await buildTwoSideDepositTx(
				routerContract,
				isTonB,
				formData.tokenB!,
				formData.amountB,
				formData.tokenA!,
				proxyTon,
				queryIdBase + 1,
				walletAddress,
			);

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
