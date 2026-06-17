import ProviderCitySearchPage, {
  generateProviderCityMetadata,
  generateProviderCityStaticParams,
} from "@/components/ProviderCitySearchPage";

type CityPageProps = {
  params: Promise<{
    citySlug: string;
  }>;
};

export const revalidate = 300;
export const dynamicParams = true;

export const generateStaticParams = generateProviderCityStaticParams;

export const generateMetadata = (props: CityPageProps) =>
  generateProviderCityMetadata("acompanantes", props);

export default function AcompanantesCityPage(props: CityPageProps) {
  return <ProviderCitySearchPage routeKey="acompanantes" {...props} />;
}
