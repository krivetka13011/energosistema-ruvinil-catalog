/**
 * Координаты офиса на карте (Москва, ул. Иловайская, д. 10, стр. 1).
 * При необходимости уточните точку в Яндекс.Картах и подставьте ll/pt.
 */
export const OFFICE_MAP = {
  lon: 37.76635,
  lat: 55.68285,
  zoom: 17,
} as const;

export function yandexWidgetSrc(): string {
  const { lon, lat, zoom } = OFFICE_MAP;
  const ll = `${lon},${lat}`;
  return `https://yandex.ru/map-widget/v1/?ll=${encodeURIComponent(ll)}&z=${zoom}&pt=${encodeURIComponent(ll)},pm2rdm`;
}

export function yandexMapsExternalUrl(): string {
  const { lon, lat, zoom } = OFFICE_MAP;
  return `https://yandex.ru/maps/?ll=${lon}%2C${lat}&z=${zoom}&pt=${lon}%2C${lat}&l=map`;
}
