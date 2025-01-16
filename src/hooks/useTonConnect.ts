import { useTonConnectUI } from "@tonconnect/ui-react";

export const useTonConnect = () => {
	const [tonConnectUI] = useTonConnectUI();
	const wallet = tonConnectUI?.wallet;

	const connect = async () => {
		await tonConnectUI?.openModal();
	};

	const disconnect = async () => {
		await tonConnectUI?.disconnect();
	};

	return {
		wallet,
		connected: wallet?.account?.address !== undefined,
		connect,
		disconnect,
	};
};
