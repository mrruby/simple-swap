# Simple Ston.fi SDK Swap Example

This is a simple example application demonstrating how to use the Ston.fi SDK to perform token swaps on TON blockchain. The app is built using React, TypeScript and Vite.

## Demo

Check out the live demo at [https://ston-fi-simple-swap.netlify.app/](https://ston-fi-simple-swap.netlify.app/)

## Key Dependencies

- [@ston-fi/api](https://github.com/ston-fi/sdk) - Ston.fi API client
- [@ston-fi/sdk](https://github.com/ston-fi/sdk) - Ston.fi SDK for token swaps
- [@ton/core](https://github.com/ton-core/ton-core) - TON blockchain core functionality
- [@ton/crypto](https://github.com/ton-core/ton-crypto) - Cryptographic utilities for TON
- [@ton/ton](https://github.com/ton-core/ton) - TON blockchain interaction
- [@tonconnect/ui-react](https://github.com/ton-connect/sdk) - TON wallet connection UI
- React

## Development Tools

- TypeScript
- Vite
- TailwindCSS
- Biome (for formatting and linting)
- Bun (for fast package management and development)

## Getting Started

1. Install Bun if you haven't already:

```bash
curl -fsSL https://bun.sh/install | bash
```

2. Install dependencies:

```bash
bun install
```

3. Start the development server:

```bash
bun dev
```

4. Build for production:

```bash
bun run build
```

## Features

- Connect TON wallet using TonConnect
- View available tokens and their balances
- Swap tokens using Ston.fi DEX
- Real-time price simulation
- Support for TON and Jetton tokens
- Slippage tolerance settings
- Price impact calculation

## Project Structure

```
src/
├── components/         # React components
│   ├── Swap.tsx       # Main swap component
│   ├── SwapForm.tsx   # Swap form interface
│   ├── SwapHeader.tsx # Header with wallet connection
│   ├── SwapInput.tsx  # Token input component
│   └── SwapSummary.tsx# Swap details summary
├── lib/               # Core functionality
│   ├── clients.ts     # API clients setup
│   ├── swap.ts        # Swap-related functions
│   └── utils.ts       # Utility functions
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Ston.fi](https://ston.fi) for providing the DEX infrastructure
- [TON Blockchain](https://ton.org) for the underlying blockchain platform
- [TON Connect](https://github.com/ton-connect/sdk) for wallet integration
