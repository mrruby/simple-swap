import { useTonConnectUI } from "@tonconnect/ui-react";

type SwapHeaderProps = {
	isWalletConnected: boolean;
};

export const SwapHeader = ({ isWalletConnected }: SwapHeaderProps) => {
	const [tonConnectUI] = useTonConnectUI();

	return (
		<>
			<h2 className="text-3xl font-bold mb-6 text-gray-800">Swap</h2>

			{!isWalletConnected && (
				<button
					onClick={() => tonConnectUI.openModal()}
					className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
				>
					Connect Wallet
				</button>
			)}
		</>
	);
};
