import { Radar, RadarChart as RC, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

export default function RadarChart({ aspectScores = {} }) {
  const data = Object.entries(aspectScores).map(([aspect, value]) => ({ aspect, value }));
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RC data={data}>
        <PolarGrid stroke="#374151" />
        <PolarAngleAxis dataKey="aspect" tick={{ fill: "#9CA3AF", fontSize: 11 }} />
        <Radar name="Score" dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.2} />
      </RC>
    </ResponsiveContainer>
  );
}
