import ProviderSearchLandingPage, {
  generateProviderSearchLandingMetadata,
} from "@/components/ProviderSearchLandingPage";

export const dynamic = "force-dynamic";

export const generateMetadata = () =>
  generateProviderSearchLandingMetadata("damas-de-compania");

export default function DamasDeCompaniaPage() {
  return <ProviderSearchLandingPage routeKey="damas-de-compania" />;
}
