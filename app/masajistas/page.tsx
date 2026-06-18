import ProviderSearchLandingPage, {
  generateProviderSearchLandingMetadata,
} from "@/components/ProviderSearchLandingPage";

export const revalidate = 300;

export const generateMetadata = () =>
  generateProviderSearchLandingMetadata("masajistas");

export default function MasajistasPage() {
  return <ProviderSearchLandingPage routeKey="masajistas" />;
}
