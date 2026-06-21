import ProviderSearchLandingPage, {
  generateProviderSearchLandingMetadata,
} from "@/components/ProviderSearchLandingPage";

export const dynamic = "force-dynamic";

export const generateMetadata = () =>
  generateProviderSearchLandingMetadata("chicas");

export default function ChicasPage() {
  return <ProviderSearchLandingPage routeKey="chicas" />;
}
