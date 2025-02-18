import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "./index.css";
import App from "./App.tsx";

const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<TonConnectUIProvider manifestUrl={manifestUrl}>
				<App />
				<Toaster position="top-right" richColors />
			</TonConnectUIProvider>
		</QueryClientProvider>
	</StrictMode>,
);
