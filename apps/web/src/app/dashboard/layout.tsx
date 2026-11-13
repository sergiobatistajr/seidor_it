import Providers from "@/components/providers";

// Preserve the scaffold's API/query context on its legacy dashboard route.
export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <Providers>{children}</Providers>;
}
