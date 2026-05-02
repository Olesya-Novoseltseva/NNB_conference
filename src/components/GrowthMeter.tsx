interface GrowthMeterProps {
  label: string;
  value: number;
  max?: number;
}

export function GrowthMeter({ label, value, max = 1_000_000 }: GrowthMeterProps) {
  const width = Math.min(100, Math.log10(value + 1) / Math.log10(max + 1) * 100);

  return (
    <div className="growthMeter">
      <div className="growthHeader">
        <span>{label}</span>
        <strong>{value.toLocaleString("ru-RU")}</strong>
      </div>
      <div className="bar">
        <div className="barFill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
