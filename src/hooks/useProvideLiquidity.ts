import { useEffect, useState } from "react";
import type { AssetInfoV2, RouterInfo } from "@ston-fi/api";
import { fetchAssets } from "../lib/swap";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { DEX, pTON } from "@ston-fi/sdk";
import { toNano } from "@ton/ton";
import { stonApiClient, tonApiClient } from "../lib/clients";
import { useQuery } from "@tanstack/react-query";
import { floatToBigNumber } from "../lib/utils";

// Types
type TokenPair = {
  tokenA: AssetInfoV2 | null;
  tokenB: AssetInfoV2 | null;
};

type TokenAmounts = {
  amountA: string;
  amountB: string;
};

// Utility hooks
const useAssets = (isWalletConnected: boolean, walletAddress: string | undefined) => {
  const [allAssets, setAllAssets] = useState<AssetInfoV2[]>([]);

  useEffect(() => {
    if (!isWalletConnected) {
      setAllAssets([]);
      return;
    }

    const loadAssets = async () => {
      const assets = await fetchAssets(walletAddress);
      setAllAssets(assets);
    };

    loadAssets().catch(console.error);
  }, [isWalletConnected, walletAddress]);

  return allAssets;
};

const useRouter = () => {
  return useQuery<RouterInfo[], Error, RouterInfo | undefined>({
    queryKey: ["availableRouters"],
    queryFn: () => stonApiClient.getRouters(),
    select: (routers) => routers.find(
      (router) =>
        router.majorVersion === 2 && router.minorVersion === 2 &&
        router.poolCreationEnabled
    ),
  });
};

// Transaction building utilities
const parseAmountForToken = (token: AssetInfoV2, amount: string) => {
  if (token.kind === "Ton") {
    return toNano(amount);
  }
  const decimals = token.meta?.decimals ?? 9;
  return floatToBigNumber(amount, decimals);
};

const buildTwoSideDepositTx = async (
  routerContract: InstanceType<typeof DEX.v2_2.Router>,
  isTonSide: boolean,
  sideToken: AssetInfoV2,
  sideAmount: string,
  otherToken: AssetInfoV2,
  proxyTon: InstanceType<typeof pTON.v2_1>,
  queryId: number,
  walletAddress: string
) => {
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
      }
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
    }
  );
};

/**
 * This hook provides two-sided liquidity-providing functionality for:
 * - TON/Jetton pools
 * - Jetton/TON pools
 * - Jetton/Jetton pools
 * using Ston.fi Router v2.2.
 */
export const useProvideLiquidity = () => {
  const walletAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const isWalletConnected = Boolean(walletAddress);

  // Use extracted hooks
  const allAssets = useAssets(isWalletConnected, walletAddress);
  const { data: matchedRouter, isLoading: isRoutersLoading, error: routersError } = useRouter();

  // Token states
  const [tokens, setTokens] = useState<TokenPair>({ tokenA: null, tokenB: null });
  const [amounts, setAmounts] = useState<TokenAmounts>({ amountA: "", amountB: "" });
  
  // Transaction states
  const [loadingTx, setLoadingTx] = useState(false);
  const [error, setError] = useState<string>("");

  const handleTokenChange = (side: 'A' | 'B') => (asset: AssetInfoV2 | null) => {
    setTokens(prev => ({
      ...prev,
      [`token${side}`]: asset
    }));
    setAmounts(prev => ({
      ...prev,
      [`amount${side}`]: ""
    }));
  };

  const handleAmountChange = (side: 'A' | 'B') => (val: string) => {
    setAmounts(prev => ({
      ...prev,
      [`amount${side}`]: val
    }));
  };

  const validateProvide = () => {
    if (!tokens.tokenA || !tokens.tokenB) {
      throw new Error("Please select both tokens (token A and token B).");
    }
    if (!walletAddress || !matchedRouter) {
      throw new Error("Please connect your wallet or no suitable router found.");
    }
    if (!amounts.amountA || !amounts.amountB) {
      throw new Error("Please enter both token amounts for two-sided deposit.");
    }
  };

  const handleProvide = async () => {
    try {
      validateProvide();

      setError("");
      setLoadingTx(true);

      const routerContract = DEX.v2_2.Router.create(matchedRouter!.address);
      const proxyTon = pTON.v2_1.create(matchedRouter!.ptonMasterAddress);

      const isTonA = tokens.tokenA!.kind === "Ton";
      const isTonB = tokens.tokenB!.kind === "Ton";
      const queryIdBase = Date.now();

      const txParamsArray = [
        await buildTwoSideDepositTx(
          routerContract,
          isTonA,
          tokens.tokenA!,
          amounts.amountA,
          tokens.tokenB!,
          proxyTon,
          queryIdBase,
          walletAddress!
        ),
        await buildTwoSideDepositTx(
          routerContract,
          isTonB,
          tokens.tokenB!,
          amounts.amountB,
          tokens.tokenA!,
          proxyTon,
          queryIdBase + 1,
          walletAddress!
        )
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
  };

  return {
    isWalletConnected,
    allAssets,
    tokenA: tokens.tokenA,
    tokenB: tokens.tokenB,
    amountA: amounts.amountA,
    amountB: amounts.amountB,
    loadingTx,
    error,
    isRoutersLoading,
    routersError,
    matchedRouter,
    handleTokenAChange: handleTokenChange('A'),
    handleTokenBChange: handleTokenChange('B'),
    handleAmountAChange: handleAmountChange('A'),
    handleAmountBChange: handleAmountChange('B'),
    handleProvide,
  };
}; 