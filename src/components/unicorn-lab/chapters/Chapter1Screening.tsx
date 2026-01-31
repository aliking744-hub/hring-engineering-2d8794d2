import GenomicScreeningHub from "../screening/GenomicScreeningHub";
import { UnicornAnalysis } from "../UnicornLabLayout";

interface Chapter1ScreeningProps {
  analyses: UnicornAnalysis[];
  onRefresh: () => void;
  loading: boolean;
}

const Chapter1Screening = ({ analyses, onRefresh, loading }: Chapter1ScreeningProps) => {
  return <GenomicScreeningHub />;
};

export default Chapter1Screening;
