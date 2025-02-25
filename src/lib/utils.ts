export function floatToBigNumber(value: string, decimals: number) {
	let [integer = "0", fraction = "0"] = value.split(".");

	const negative = integer.startsWith("-");

	if (negative) integer = integer.slice(1);

	fraction = fraction.padEnd(decimals, "0").slice(0, decimals);

	return BigInt(`${negative ? "-" : ""}${integer}${fraction}`);
}

export function formatBalance(
	balance: string | undefined,
	decimals: number = 9,
): string {
	if (!balance) return "0";

	const bigIntBalance = BigInt(balance);
	const divisor = BigInt(10 ** decimals);
	const integerPart = bigIntBalance / divisor;
	const fractionalPart = bigIntBalance % divisor;

	let formattedFraction = fractionalPart.toString().padStart(decimals, "0");
	// Remove trailing zeros
	formattedFraction = formattedFraction.replace(/0+$/, "");

	return formattedFraction
		? `${integerPart}.${formattedFraction}`
		: integerPart.toString();
}

export function formatAmount(
	amount: string | undefined,
	decimals: number = 9,
): string {
	if (!amount) return "0";

	try {
		const value = BigInt(amount);
		const divisor = BigInt(10 ** decimals);
		const integerPart = value / divisor;
		const fractionalPart = value % divisor;

		let formattedFraction = fractionalPart.toString().padStart(decimals, "0");
		// Remove trailing zeros
		formattedFraction = formattedFraction.replace(/0+$/, "");

		return formattedFraction
			? `${integerPart}.${formattedFraction}`
			: integerPart.toString();
	} catch {
		return amount;
	}
}

/**
 * Overloaded function to convert a string amount to token units
 * with proper TS types for string or undefined.
 */
export function toTokenUnits(amount: string, decimals: number): string;
export function toTokenUnits(amount: undefined, decimals: number): undefined;
export function toTokenUnits(
	amount: string | undefined,
	decimals: number,
): string | undefined {
	if (amount === undefined) return undefined;
	return floatToBigNumber(amount, decimals).toString();
}

/**
 * Parse string to float, ensuring NaN -> 0
 */
export function parseAmountValue(amount: string): number {
	const value = parseFloat(amount);
	return Number.isNaN(value) ? 0 : value;
}

/**
 * Generate a random 53-bit integer.
 * (In JavaScript, we reliably handle up to 53 bits for integer precision.)
 */
export function generateRandomQueryId(): number {
	const arr = new Uint32Array(2);
	crypto.getRandomValues(arr);
	// Combine to up to 64 bits, then mask to 53 bits
	const combined = (BigInt(arr[0]) << 32n) | BigInt(arr[1]);
	const mask53 = (1n << 53n) - 1n;
	return Number(combined & mask53);
}
