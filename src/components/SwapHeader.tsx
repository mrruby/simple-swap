import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useState } from "react";

type SwapHeaderProps = {
	isWalletConnected: boolean;
};

function shortAddress(address: string) {
	if (address.length <= 11) return address;
	return address.slice(0, 5) + "..." + address.slice(-5);
}

export const SwapHeader = ({ isWalletConnected }: SwapHeaderProps) => {
	const [tonConnectUI] = useTonConnectUI();
	const walletAddress = useTonAddress();

	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	const handleDisconnect = async () => {
		await tonConnectUI.disconnect();
		setIsDropdownOpen(false);
	};

	const toggleDropdown = () => {
		setIsDropdownOpen((prev) => !prev);
	};

	return (
		<div className="flex items-center justify-between mb-6">
			<h2 className="text-3xl font-bold text-gray-800">Swap</h2>
			{!isWalletConnected ? (
				<button
					onClick={() => tonConnectUI.openModal()}
					className="p-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
				>
					Connect Wallet
				</button>
			) : (
				walletAddress && (
					<div className="relative">
						<button
							onClick={toggleDropdown}
							className="p-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
						>
							{shortAddress(walletAddress)}
						</button>

						{isDropdownOpen && (
							<div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-md z-10">
								<button
									onClick={handleDisconnect}
									className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
								>
									Disconnect
								</button>
							</div>
						)}
					</div>
				)
			)}
		</div>
	);
};
