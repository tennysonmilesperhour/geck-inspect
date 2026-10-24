// Same season boundary as Season Timeline: eggs laid in the selected year.
export function homeSeasonCounts(eggs, year) {
  const season = eggs.filter((egg) => String(egg.lay_date || '').slice(0, 4) === String(year));
  return {
    hatched: season.filter((egg) => egg.status === 'Hatched').length,
    incubating: season.filter((egg) => egg.status === 'Incubating' && !egg.archived).length,
  };
}

export function homeSeasonValue({ hatched, incubating, plannedEggs, hatchRate, averageValue }) {
  if (![hatched, incubating, plannedEggs, hatchRate, averageValue].every(Number.isFinite)) return null;
  if (hatched < 0 || incubating < 0 || plannedEggs < 0 || hatchRate < 0 || hatchRate > 100 || averageValue <= 0) return null;
  return (hatched + (incubating + plannedEggs) * hatchRate / 100) * averageValue;
}
