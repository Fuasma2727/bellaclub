import ProviderSearchLandingPage, {
  generateProviderSearchLandingMetadata,
} from "@/components/ProviderSearchLandingPage";

export const dynamic = "force-dynamic";

export const generateMetadata = () =>
  generateProviderSearchLandingMetadata("masajistas");

export default function MasajistasPage() {
  return <ProviderSearchLandingPage routeKey="masajistas" />;
}
