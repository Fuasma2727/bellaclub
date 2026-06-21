import ProviderSearchLandingPage, {
  generateProviderSearchLandingMetadata,
} from "@/components/ProviderSearchLandingPage";

export const dynamic = "force-dynamic";

export const generateMetadata = () =>
  generateProviderSearchLandingMetadata("acompanantes");

export default function AcompanantesPage() {
  return <ProviderSearchLandingPage routeKey="acompanantes" />;
}
