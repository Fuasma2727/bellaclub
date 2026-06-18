import ProviderSearchLandingPage, {
  generateProviderSearchLandingMetadata,
} from "@/components/ProviderSearchLandingPage";

export const revalidate = 300;

export const generateMetadata = () =>
  generateProviderSearchLandingMetadata("universitarias");

export default function UniversitariasPage() {
  return <ProviderSearchLandingPage routeKey="universitarias" />;
}
