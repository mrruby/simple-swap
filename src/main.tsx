import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { BrowserRouter } from "react-router";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";


const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<TonConnectUIProvider manifestUrl={manifestUrl}>
				<BrowserRouter>
					<App />
					<Toaster position="top-right" richColors />
				</BrowserRouter>
			</TonConnectUIProvider>
		</QueryClientProvider>
	</StrictMode>,
);
