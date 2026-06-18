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
  generateProviderCityMetadata("universitarias", props);

export default function UniversitariasCityPage(props: CityPageProps) {
  return <ProviderCitySearchPage routeKey="universitarias" {...props} />;
}
