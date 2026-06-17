import ProviderSearchLandingPage, {
  generateProviderSearchLandingMetadata,
} from "@/components/ProviderSearchLandingPage";

export const revalidate = 300;

export const generateMetadata = () =>
  generateProviderSearchLandingMetadata("acompanantes");

export default function AcompanantesPage() {
  return <ProviderSearchLandingPage routeKey="acompanantes" />;
}
