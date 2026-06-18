import ProviderSearchLandingPage, {
  generateProviderSearchLandingMetadata,
} from "@/components/ProviderSearchLandingPage";

export const revalidate = 300;

export const generateMetadata = () =>
  generateProviderSearchLandingMetadata("putas");

export default function PutasPage() {
  return <ProviderSearchLandingPage routeKey="putas" />;
}
