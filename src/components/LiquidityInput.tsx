import type { AssetInfoV2 } from "@ston-fi/api";
import { formatBalance } from "../lib/utils";

type LiquidityInputProps = {
  label: string;
  assets: AssetInfoV2[];
  selectedAsset: AssetInfoV2 | null;
  amount: string;
  onAssetChange: (asset: AssetInfoV2 | null) => void;
  onAmountChange: (amount: string) => void;
};

export const LiquidityInput = ({
  label,
  assets,
  selectedAsset,
  amount,
  onAssetChange,
  onAmountChange,
}: LiquidityInputProps) => {
  const formattedBalance = selectedAsset
    ? formatBalance(selectedAsset.balance, selectedAsset.meta?.decimals)
    : "0";

  return (
    <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
      <label className="block text-base font-semibold text-gray-800 mb-3">
        {label}
      </label>

      <div className="flex gap-4">
        <select
          className="flex-1 p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all text-base font-medium text-gray-900"
          value={selectedAsset?.contractAddress || ""}
          onChange={(e) => {
            const asset = assets.find(
              (a) => a.contractAddress === e.target.value,
            );
            onAssetChange(asset || null);
          }}
        >
          <option value="" className="text-gray-400">
            Select Asset
          </option>
          {assets.map((asset) => (
            <option
              key={asset.contractAddress}
              value={asset.contractAddress}
              className="text-gray-900 font-medium"
            >
              {asset.meta?.symbol || asset.contractAddress.slice(0, 6)}
            </option>
          ))}
        </select>

        <input
          type="text"
          className="flex-1 p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all disabled:bg-gray-100 disabled:cursor-not-allowed text-base font-medium text-gray-900 placeholder-gray-400"
          placeholder="0.0"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          disabled={!selectedAsset}
        />
      </div>

      {selectedAsset && (
        <div className="mt-3 text-sm font-medium text-gray-700 flex items-center justify-between">
          <span className="mr-1">Balance:</span>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-900">
              {formattedBalance}
            </span>
            <span className="text-gray-600">{selectedAsset.meta?.symbol}</span>
          </div>
        </div>
      )}
    </div>
  );
}; 