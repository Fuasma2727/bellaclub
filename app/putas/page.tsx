import ProviderSearchLandingPage, {
  generateProviderSearchLandingMetadata,
} from "@/components/ProviderSearchLandingPage";

export const dynamic = "force-dynamic";

export const generateMetadata = () =>
  generateProviderSearchLandingMetadata("putas");

export default function PutasPage() {
  return <ProviderSearchLandingPage routeKey="putas" />;
}
