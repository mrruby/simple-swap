import type { AssetInfoV2, LiquidityProvisionSimulation } from "@ston-fi/api";
import { formatAmount } from "../lib/utils";

type LiquiditySummaryProps = {
	loading: boolean;
	error: string;
	simulation: LiquidityProvisionSimulation | null;
	tokenA?: AssetInfoV2;
	tokenB?: AssetInfoV2;
};

export const LiquiditySummary = ({
	loading,
	error,
	simulation,
	tokenA,
	tokenB,
}: LiquiditySummaryProps) => {
	if (loading) {
		return (
			<div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
				<svg
					className="animate-spin h-5 w-5 mx-auto mb-2 text-gray-600"
					viewBox="0 0 24 24"
				>
					<circle
						className="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						strokeWidth="4"
						fill="none"
					></circle>
					<path
						className="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 
               1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
				<p className="text-gray-600">Simulating liquidity provision...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-6 bg-red-50 rounded-lg border border-red-200">
				<p className="text-red-600 font-medium">{error}</p>
			</div>
		);
	}

	// If no simulation or no data yet, render nothing
	if (!simulation) {
		return null;
	}

	const decimalsA = tokenA?.meta?.decimals ?? 9;
	const decimalsB = tokenB?.meta?.decimals ?? 9;

	// For convenience, parse relevant simulation fields
	const {
		estimatedLpUnits,
		minLpUnits,
		minTokenAUnits,
		minTokenBUnits,
		tokenAUnits,
		tokenBUnits,
		tokenA: tokenAAddress,
		tokenB: tokenBAddress,
		lpAccountAddress,
		poolAddress,
		provisionType,
	} = simulation;

	return (
		<div className="p-6 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
			{/* Provision Type */}
			<div className="flex justify-between">
				<span className="text-gray-600 font-medium">Provision Type</span>
				<span className="text-gray-900 font-semibold">{provisionType}</span>
			</div>

			{/* Amounts for A and B (simulated) */}
			<div className="flex justify-between">
				<span className="text-gray-600 font-medium">Token A Amount</span>
				<span className="text-gray-900 font-semibold">
					{formatAmount(tokenAUnits, decimalsA)}{" "}
					<small className="text-gray-500">
						{tokenAAddress.slice(0, 6)}...
					</small>
				</span>
			</div>
			<div className="flex justify-between">
				<span className="text-gray-600 font-medium">Token B Amount</span>
				<span className="text-gray-900 font-semibold">
					{formatAmount(tokenBUnits, decimalsB)}{" "}
					<small className="text-gray-500">
						{tokenBAddress.slice(0, 6)}...
					</small>
				</span>
			</div>

			{/* Estimated LP tokens user might receive */}
			<div className="flex justify-between">
				<span className="text-gray-600 font-medium">Estimated LP units</span>
				<span className="text-gray-900 font-semibold">
					{formatAmount(estimatedLpUnits, 9)}
				</span>
			</div>

			{/* Minimum LP user might receive */}
			<div className="flex justify-between">
				<span className="text-gray-600 font-medium">Min LP units</span>
				<span className="text-gray-900 font-semibold">
					{formatAmount(minLpUnits, 9)}
				</span>
			</div>

			{/* Minimum token A and B that must be accepted by the pool */}
			<div className="flex justify-between">
				<span className="text-gray-600 font-medium">Min Token A deposit</span>
				<span className="text-gray-900 font-semibold">
					{formatAmount(minTokenAUnits, decimalsA)}
				</span>
			</div>
			<div className="flex justify-between">
				<span className="text-gray-600 font-medium">Min Token B deposit</span>
				<span className="text-gray-900 font-semibold">
					{formatAmount(minTokenBUnits, decimalsB)}
				</span>
			</div>

			{/* Addresses */}
			{poolAddress && (
				<div className="flex justify-between text-sm text-gray-500">
					<span>Pool Address</span>
					<span>{poolAddress}</span>
				</div>
			)}
			{lpAccountAddress && (
				<div className="flex justify-between text-sm text-gray-500">
					<span>LP Account</span>
					<span>{lpAccountAddress}</span>
				</div>
			)}
		</div>
	);
};
