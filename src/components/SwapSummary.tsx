import type { SwapSimulation } from "@ston-fi/api";
import { formatAmount } from "../lib/utils";

type SwapSummaryProps = {
	loading: boolean;
	error: string;
	simulation: SwapSimulation | null;
	offerAssetDecimals?: number;
	askAssetDecimals?: number;
};

export const SwapSummary = ({
	loading,
	error,
	simulation,
	offerAssetDecimals = 9,
	askAssetDecimals = 9,
}: SwapSummaryProps) => {
	if (loading) {
		return (
			<div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
				<p className="text-gray-600 flex items-center justify-center">
					<svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
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
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					Calculating best swap route...
				</p>
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

	if (!simulation) {
		return null;
	}

	return (
		<div className="p-6 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
			<div className="flex justify-between items-center">
				<span className="text-gray-600 font-medium">Rate</span>
				<span className="text-gray-900 font-semibold">
					{formatAmount(simulation.swapRate, offerAssetDecimals)}
				</span>
			</div>

			<div className="flex justify-between items-center">
				<span className="text-gray-600 font-medium">Price Impact</span>
				<span className="text-gray-900 font-semibold">
					{(Number(simulation.priceImpact) * 100).toFixed(2)}%
				</span>
			</div>

			<div className="flex justify-between items-center">
				<span className="text-gray-600 font-medium">Minimum Received</span>
				<span className="text-gray-900 font-semibold">
					{formatAmount(simulation.minAskUnits, askAssetDecimals)}
				</span>
			</div>

			<div className="flex justify-between items-center">
				<span className="text-gray-600 font-medium">Slippage Tolerance</span>
				<span className="text-gray-900 font-semibold">
					{(Number(simulation.slippageTolerance) * 100).toFixed(2)}%
				</span>
			</div>
		</div>
	);
};
