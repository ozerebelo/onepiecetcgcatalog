import { useTranslation } from 'react-i18next';

/** "3rd place of 512" / "Winner" / "64 players": where a list finished. */
export function usePlacementLabel() {
  const { t } = useTranslation();
  return (placement: number | null, players: number | null) => {
    if (placement == null) return players ? t('meta.players', { count: players }) : null;
    const place = placement === 1 ? t('meta.winner') : t('meta.place', { ordinal: ordinal(placement) });
    return players ? t('meta.placeOf', { place, players }) : place;
  };
}

function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}
