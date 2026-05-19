import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export default function CompetencyRadarChart({ chartData }) {
  if (!chartData || Object.keys(chartData).length === 0) return null;

  const data = Object.entries(chartData).map(([subject, value]) => ({
    subject,
    value: Number(value),
    fullMark: 100,
  }));

  return (
    <div>
      <h3>역량 분석</h3>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 13 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 11 }} />
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
