import type { Metadata } from "next";
import { JetBrains_Mono, Roboto } from "next/font/google";
import "../index.css";
import { Toaster } from "@seidor_it/ui/components/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const roboto = Roboto({
	subsets: ["latin"],
	variable: "--font-roboto",
	display: "swap",
});
const mono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-jetbrains",
	display: "swap",
});

export const metadata: Metadata = {
	title: "Mesa · Central de chamados",
	description:
		"Um espaço para acompanhar, atender e resolver chamados de suporte.",
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html
			lang="pt-BR"
			suppressHydrationWarning
			className={`${roboto.variable} ${mono.variable}`}
		>
			<body className="antialiased">
				<ThemeProvider
					attribute="class"
					defaultTheme="light"
					enableSystem={false}
					disableTransitionOnChange
				>
					<TooltipProvider>
						{children}
						<Toaster richColors position="bottom-right" />
					</TooltipProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
