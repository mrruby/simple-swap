import { StonApiClient } from "@ston-fi/api";
import { Client } from "@ston-fi/sdk";

export const stonApiClient = new StonApiClient({
	baseURL: import.meta.env.VITE_STON_API_URL ?? "https://api.ston.fi",
});

export const tonApiClient = new Client({
	endpoint:
		import.meta.env.VITE_TON_API_URL ?? "https://toncenter.com/api/v2/jsonRPC",
	apiKey: import.meta.env.VITE_TON_API_KEY,
});
