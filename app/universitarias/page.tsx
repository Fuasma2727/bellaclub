import ProviderSearchLandingPage, {
  generateProviderSearchLandingMetadata,
} from "@/components/ProviderSearchLandingPage";

export const dynamic = "force-dynamic";

export const generateMetadata = () =>
  generateProviderSearchLandingMetadata("universitarias");

export default function UniversitariasPage() {
  return <ProviderSearchLandingPage routeKey="universitarias" />;
}
