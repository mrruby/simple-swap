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
 * Utility to parse amounts as BN for token or TON.
 */
function parseAmountForToken(token: AssetInfoV2, amount: string) {
	if (token.kind === "Ton") {
		return toNano(amount);
	}
	const decimals = token.meta?.decimals ?? 9;
	return floatToBigNumber(amount, decimals);
}

/**
 * Builds the transaction parameters for depositing a single side
 * (either TON or a Jetton) in a two-sided deposit operation.
 */
async function buildTwoSideDepositTx(
	routerContract: InstanceType<typeof DEX.v2_2.Router>,
	isTonSide: boolean,
	sideToken: AssetInfoV2,
	sideAmount: string,
	otherToken: AssetInfoV2,
	proxyTon: InstanceType<typeof pTON.v2_1>,
	queryId: number,
	walletAddress: string,
) {
	const sendAmount = parseAmountForToken(sideToken, sideAmount);

	if (isTonSide) {
		return await routerContract.getProvideLiquidityTonTxParams(
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

	const isOtherTon = otherToken.kind === "Ton";
	const otherTokenAddr = isOtherTon
		? proxyTon.address.toString()
		: otherToken.contractAddress;

	return await routerContract.getProvideLiquidityJettonTxParams(
		tonApiClient.provider(routerContract.address),
		{
			userWalletAddress: walletAddress,
			sendTokenAddress: sideToken.contractAddress,
			sendAmount: sendAmount.toString(),
			otherTokenAddress: otherTokenAddr,
			minLpOut: "1",
			queryId,
		},
	);
}

/**
 * Validate whether the user has provided enough input to proceed with a deposit transaction.
 */
function validateProvide(
	tokenA: AssetInfoV2 | null,
	tokenB: AssetInfoV2 | null,
	amountA: string,
	amountB: string,
	provisionType: LiquidityProvisionType,
	isWalletConnected: boolean,
): string | null {
	if (!tokenA || !tokenB) {
		return "Please select both tokens (token A and token B).";
	}
	if (!isWalletConnected) {
		return "Please connect your wallet.";
	}
	// Balanced requires at least one side
	if (provisionType === "Balanced") {
		if (!amountA && !amountB) {
			return "For 'Balanced' provisioning, enter at least one token amount.";
		}
	} else {
		// "Initial" and "Arbitrary" require both sides
		if (!amountA || !amountB) {
			return "For 'Initial' or 'Arbitrary' provisioning, please enter both token amounts.";
		}
	}
	return null;
}

/**
 * Hook to retrieve a router that is v2.2 with poolCreationEnabled, in a declarative style.
 */
function useSuitableRouter() {
	return useQuery<RouterInfo[], Error, RouterInfo | undefined>({
		queryKey: ["availableRouters"],
		queryFn: () => stonApiClient.getRouters(),
		select: (routers) =>
			routers.find(
				(router) =>
					router.majorVersion === 2 &&
					router.minorVersion === 2 &&
					router.poolCreationEnabled,
			),
	});
}

/**
 * Type guard for errors with a data property
 */
function isFetchError(error: unknown): error is { data?: string } {
	return typeof error === "object" && error !== null && "data" in error;
}

/**
 * This hook provides two-sided liquidity-providing functionality
 * plus simulation (like how we do with swap).
 */
export const useProvideLiquidity = () => {
	const walletAddress = useTonAddress();
	const [tonConnectUI] = useTonConnectUI();
	const isWalletConnected = Boolean(walletAddress);

	// Single state object for user input
	const [formData, setFormData] = useState<{
		tokenA: AssetInfoV2 | null;
		tokenB: AssetInfoV2 | null;
		amountA: string;
		amountB: string;
		firstChangedSide: "A" | "B" | null;
		activeSide: "A" | "B" | null;
		provisionType: LiquidityProvisionType;
		poolAddress?: string;
		/**
		 * Track the history of provision types we've used so far.
		 * We'll rely on this to detect the "first Balanced" scenario
		 * without a raw boolean.
		 */
		provisionHistory: LiquidityProvisionType[];
	}>({
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

	// Local states for result or errors
	const [error, setError] = useState("");
	const [loadingTx, setLoadingTx] = useState(false);

	// Assets: fetched once user is connected
	const [allAssets, setAllAssets] = useState<AssetInfoV2[]>([]);

	useEffect(() => {
		if (!isWalletConnected) {
			setAllAssets([]);
			return;
		}
		fetchAssets(walletAddress)
			.then((assets) => setAllAssets(assets))
			.catch((err) => console.error(err));
	}, [isWalletConnected, walletAddress]);

	// Query the matched router
	const {
		data: matchedRouter,
		isLoading: isRoutersLoading,
		error: routersError,
	} = useSuitableRouter();

	/**
	 * A separate hook to run the simulation in a declarative manner.
	 * We'll parse the decimals from each token for the simulation.
	 */
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

	/**
	 * Once we get the simulation result for Balanced, auto-update the other side
	 * using getUpdatedBalancedAmounts. If "Initial" or "Arbitrary," do not override.
	 */
	useEffect(() => {
		if (!lpSimulation) {
			return;
		}
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
			setFormData((prev) => ({
				...prev,
				amountA,
				amountB,
			}));
		}
	}, [
		lpSimulation,
		formData.provisionType,
		formData.activeSide,
		formData.amountA,
		formData.amountB,
		decimalsA,
		decimalsB,
	]);

	/**
	 * If simulation is "Initial" but returns 400 "already exists", we switch to "Balanced".
	 * We keep the first input side only. Then we store the discovered pool address.
	 */
	useEffect(() => {
		if (!simulationError) return;

		if (isFetchError(simulationError)) {
			const errorMessage = simulationError.data;
			if (typeof errorMessage === "string") {
				const match = errorMessage.match(/already exists:\s*(\S+)/);
				if (match && match[1]) {
					// Pool already exists => switch to Balanced
					setFormData((prev) => {
						let nextHistory = prev.provisionHistory;
						if (!nextHistory.includes("Balanced")) {
							nextHistory = [...nextHistory, "Balanced"];
						}

						// If user typed both sides in "Initial", we want to rely on firstChangedSide
						// as the active side. If firstChangedSide is still null for some reason,
						// we fallback to "A" or "B" depending on whichever side has a non-empty value.
						let nextActiveSide = prev.firstChangedSide;
						if (!nextActiveSide) {
							// fallback logic if firstChangedSide is null
							if (prev.amountA) {
								nextActiveSide = "A";
							} else if (prev.amountB) {
								nextActiveSide = "B";
							}
						}

						return {
							...prev,
							provisionType: "Balanced",
							poolAddress: match[1],
							provisionHistory: nextHistory,
							activeSide: nextActiveSide,
						};
					});
				}
			}
		}
	}, [simulationError]);

	/**
	 * Handler for changing token A or B. Resets the amount and sets active side.
	 */
	const handleTokenChange = useCallback(
		(side: "A" | "B") => (asset: AssetInfoV2 | null) => {
			setFormData((prev) => ({
				...prev,
				[`token${side}`]: asset,
				[`amount${side}`]: "",
				// If Balanced, we set activeSide to this side
				activeSide: prev.provisionType === "Balanced" ? side : prev.activeSide,
			}));
		},
		[],
	);

	/**
	 * Handler for changing amount A or B.
	 * - If it's the first non-empty change overall, record firstChangedSide.
	 * - If Balanced, update activeSide to this side so we only pass that side's input.
	 */
	const handleAmountChange = useCallback(
		(side: "A" | "B") => (amount: string) => {
			setFormData((prev) => {
				let nextFirstChanged = prev.firstChangedSide;
				if (!prev.firstChangedSide && amount) {
					// This is the first time the user typed a non-empty amount on any side
					nextFirstChanged = side;
				}

				let nextActiveSide = prev.activeSide;
				if (prev.provisionType === "Balanced") {
					// For balanced, we want to use whichever side user last changed
					nextActiveSide = side;
				}

				return {
					...prev,
					[`amount${side}`]: amount,
					firstChangedSide: nextFirstChanged,
					activeSide: nextActiveSide,
				};
			});
		},
		[],
	);

	/**
	 * The "provide" transaction. Validate first, then build the deposit TX messages for each side.
	 */
	const handleProvide = useCallback(async () => {
		setError("");
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
			setError(
				"No suitable router found or wallet not connected. Please check your setup.",
			);
			return;
		}

		setLoadingTx(true);
		try {
			// Prepare deposit transactions
			const routerContract = DEX.v2_2.Router.create(matchedRouter.address);
			const proxyTon = pTON.v2_1.create(matchedRouter.ptonMasterAddress);

			const isTonA = formData.tokenA!.kind === "Ton";
			const isTonB = formData.tokenB!.kind === "Ton";

			const queryIdBase = Date.now();

			const txParamsArray = [
				await buildTwoSideDepositTx(
					routerContract,
					isTonA,
					formData.tokenA!,
					formData.amountA,
					formData.tokenB!,
					proxyTon,
					queryIdBase,
					walletAddress,
				),
				await buildTwoSideDepositTx(
					routerContract,
					isTonB,
					formData.tokenB!,
					formData.amountB,
					formData.tokenA!,
					proxyTon,
					queryIdBase + 1,
					walletAddress,
				),
			];

			const messages = txParamsArray.map((txParams) => ({
				address: txParams.to.toString(),
				amount: txParams.value.toString(),
				payload: txParams.body?.toBoc().toString("base64"),
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
		setError,
		setLoadingTx,
	]);

	return {
		isWalletConnected,
		allAssets,

		// Data
		tokenA: formData.tokenA,
		tokenB: formData.tokenB,
		amountA: formData.amountA,
		amountB: formData.amountB,
		provisionType: formData.provisionType,
		lpSimulation: lpSimulation,
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
				// If we haven't included this type in history, add it
				let nextHistory = prev.provisionHistory;
				if (!nextHistory.includes(type)) {
					nextHistory = [...nextHistory, type];
				}
				return { ...prev, provisionType: type, provisionHistory: nextHistory };
			}),
		handleTokenAChange: handleTokenChange("A"),
		handleTokenBChange: handleTokenChange("B"),
		handleAmountAChange: handleAmountChange("A"),
		handleAmountBChange: handleAmountChange("B"),
		handleProvide,
	};
};
