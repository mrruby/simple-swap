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
