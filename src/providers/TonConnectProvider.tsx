import { TonConnectUIProvider } from "@tonconnect/ui-react";

const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

type TonConnectProviderProps = {
	children: React.ReactNode;
};

export const TonConnectProvider = ({ children }: TonConnectProviderProps) => {
	return (
		<TonConnectUIProvider manifestUrl={manifestUrl}>
			{children}
		</TonConnectUIProvider>
	);
};
