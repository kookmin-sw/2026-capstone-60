import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const ALL_TYPES = ["학습력", "문제해결력", "협업능력", "기술역량", "주도성", "스트레스내성", "직무적합성"];
const DEFAULT_SCORE = 3;

export default function CompetencyRadarChart({ chartData }) {
  if (!chartData || Object.keys(chartData).length === 0) return null;

  const data = ALL_TYPES.map((subject) => {
    const raw = chartData[subject] != null ? Number(chartData[subject]) : DEFAULT_SCORE;
    return {
      subject,
      value: raw > 0 ? raw : DEFAULT_SCORE,
      fullMark: 10,
    };
  });

  return (
    <div>
      <h3>역량 분석</h3>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 13 }} />
          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 11 }} />
          <Radar
            name="역량"
            dataKey="value"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.35}
          />
          <Tooltip formatter={(v) => `${v}점`} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
