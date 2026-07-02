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
  generateProviderCityMetadata("escorts", props);

export default function EscortsCityPage(props: CityPageProps) {
  return <ProviderCitySearchPage routeKey="escorts" {...props} />;
}
