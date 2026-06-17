import ProviderSearchLandingPage, {
  generateProviderSearchLandingMetadata,
} from "@/components/ProviderSearchLandingPage";

export const revalidate = 300;

export const generateMetadata = () =>
  generateProviderSearchLandingMetadata("chicas");

export default function ChicasPage() {
  return <ProviderSearchLandingPage routeKey="chicas" />;
}
