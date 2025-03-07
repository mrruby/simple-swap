import { NavLink, Outlet, Route, Routes } from "react-router";
import { ProvideLiquidity } from "./components/ProvideLiquidity";
import { Swap } from "./components/Swap";

function Layout() {
	return (
		<main className="min-h-screen bg-gray-50 font-sans antialiased">
			<div className="container mx-auto min-h-screen py-8">
				<nav className="flex gap-4 mb-6 justify-center">
					<NavLink
						to="/"
						className={({ isActive }) =>
							`p-3 rounded-lg font-medium ${
								isActive
									? "bg-blue-600 text-white"
									: "bg-white border border-gray-200 text-gray-700"
							}`
						}
						end
					>
						Swap
					</NavLink>
					<NavLink
						to="/liquidity"
						className={({ isActive }) =>
							`p-3 rounded-lg font-medium ${
								isActive
									? "bg-blue-600 text-white"
									: "bg-white border border-gray-200 text-gray-700"
							}`
						}
					>
						Provide Liquidity
					</NavLink>
				</nav>
				<div className="flex items-center justify-center">
					<Outlet />
				</div>
			</div>
		</main>
	);
}

export default function App() {
	return (
		<Routes>
			<Route element={<Layout />}>
				<Route index element={<Swap />} />
				<Route path="liquidity" element={<ProvideLiquidity />} />
			</Route>
		</Routes>
	);
}
