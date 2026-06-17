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
  generateProviderCityMetadata("damas-de-compania", props);

export default function DamasDeCompaniaCityPage(props: CityPageProps) {
  return <ProviderCitySearchPage routeKey="damas-de-compania" {...props} />;
}
