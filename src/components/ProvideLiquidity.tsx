import { useProvideLiquidity } from "../hooks/useProvideLiquidity";
import { LiquidityInput } from "./LiquidityInput";
import { LiquiditySummary } from "./LiquiditySummary";

export function ProvideLiquidity() {
	const {
		isWalletConnected,
		allAssets,
		tokenA,
		tokenB,
		amountA,
		amountB,
		loadingTx,
		error,
		isRoutersLoading,
		routersError,
		matchedRouter,
		lpSimulation,
		simulationError,
		loadingSimulation,
		handleTokenAChange,
		handleTokenBChange,
		handleAmountAChange,
		handleAmountBChange,
		handleProvide,
	} = useProvideLiquidity();

	if (!isWalletConnected) {
		return (
			<div className="max-w-lg mx-auto p-6 bg-white rounded-xl shadow-lg">
				<h2 className="text-3xl font-bold text-gray-800 mb-4">
					Provide Liquidity
				</h2>
				<p className="text-gray-700">Please connect your wallet to continue.</p>
			</div>
		);
	}

	if (isRoutersLoading) {
		return (
			<div className="max-w-lg mx-auto p-6 bg-white rounded-xl shadow-lg">
				<h2 className="text-3xl font-bold text-gray-800 mb-4">
					Provide Liquidity
				</h2>
				<p className="text-gray-700">Loading routers...</p>
			</div>
		);
	}

	if (routersError) {
		return (
			<div className="max-w-lg mx-auto p-6 bg-white rounded-xl shadow-lg">
				<h2 className="text-3xl font-bold text-gray-800 mb-4">
					Provide Liquidity
				</h2>
				<p className="text-red-600">
					Error fetching routers: {String(routersError)}
				</p>
			</div>
		);
	}

	if (!matchedRouter) {
		return (
			<div className="max-w-lg mx-auto p-6 bg-white rounded-xl shadow-lg">
				<h2 className="text-3xl font-bold text-gray-800 mb-4">
					Provide Liquidity
				</h2>
				<p className="text-gray-700">
					No suitable router found (looking for a router with v2.2 and pool
					creation enabled).
				</p>
			</div>
		);
	}

	return (
		<div className="max-w-lg mx-auto p-6 bg-white rounded-xl shadow-lg">
			<h2 className="text-3xl font-bold text-gray-800 mb-4">
				Provide Liquidity
			</h2>

			{/* First Token Input */}
			<div className="mb-4">
				<LiquidityInput
					assets={allAssets}
					selectedAsset={tokenA}
					amount={amountA}
					onAssetChange={handleTokenAChange}
					onAmountChange={handleAmountAChange}
					label="Token A"
				/>
			</div>

			{/* Second Token Input */}
			<div className="mb-4">
				<LiquidityInput
					assets={allAssets}
					selectedAsset={tokenB}
					amount={amountB}
					onAssetChange={handleTokenBChange}
					onAmountChange={handleAmountBChange}
					label="Token B"
				/>
			</div>

			{/* Liquidity Summary */}
			<div className="mb-4">
				<LiquiditySummary
					loading={loadingSimulation}
					error={simulationError}
					simulation={lpSimulation ?? null}
					tokenADecimals={tokenA?.meta?.decimals}
					tokenBDecimals={tokenB?.meta?.decimals}
				/>
			</div>

			{/* Error Display */}
			{error && (
				<div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
			)}

			{/* Provide Button */}
			<button
				onClick={handleProvide}
				disabled={loadingTx || !tokenA || !tokenB || !amountA || !amountB}
				className={`w-full py-3 px-4 rounded-lg font-medium text-white ${
					loadingTx || !tokenA || !tokenB || !amountA || !amountB
						? "bg-gray-400 cursor-not-allowed"
						: "bg-blue-600 hover:bg-blue-700"
				}`}
			>
				{loadingTx ? "Providing Liquidity..." : "Provide Liquidity"}
			</button>

			{/* Router Info (for debugging) */}
			<div className="mt-4 text-sm text-gray-500">
				<p>Router: {matchedRouter.address}</p>
				<p>
					Version: v{matchedRouter.majorVersion}.{matchedRouter.minorVersion}
				</p>
			</div>
		</div>
	);
}
