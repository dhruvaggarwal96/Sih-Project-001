export type CrowdLevel = 'Low' | 'Moderate' | 'High';

export type Bus = {
  id: string;
  number: string;
  name: string;
  direction: string;
  arrival: string;
  distance: string;
  crowd: CrowdLevel;
  color: string;
  stops: number;
};

export const colors = {
  ink: '#102A43',
  muted: '#627D98',
  canvas: '#F4F7FB',
  surface: '#FFFFFF',
  border: '#D9E2EC',
  blue: '#146C94',
  blueDark: '#0B3C5D',
  bluePale: '#E7F3F8',
  green: '#16826C',
  greenPale: '#E4F6F0',
  orange: '#D97706',
  orangePale: '#FFF1D6',
  red: '#C2413A',
  redPale: '#FCE9E7',
  purple: '#6D5BD0',
  purplePale: '#EFEDFF',
} as const;

// Replace this demo array with the future fleet GPS endpoint response.
export const nearbyBuses: Bus[] = [
  {
    id: '41',
    number: '41',
    name: 'Central Station',
    direction: 'towards City Market',
    arrival: '3 min',
    distance: '0.8 km away',
    crowd: 'Moderate',
    color: colors.blue,
    stops: 4,
  },
  {
    id: '22A',
    number: '22A',
    name: 'University Loop',
    direction: 'towards Lake Road',
    arrival: '7 min',
    distance: '1.2 km away',
    crowd: 'Low',
    color: colors.green,
    stops: 6,
  },
  {
    id: '18',
    number: '18',
    name: 'Tech Park Express',
    direction: 'towards Civil Lines',
    arrival: '12 min',
    distance: '1.7 km away',
    crowd: 'High',
    color: colors.purple,
    stops: 8,
  },
];

export const journeyOptions = [
  {
    id: 'fastest',
    duration: '28 min',
    label: 'Fastest route',
    detail: 'Walk 4 min · Bus 41 · Walk 3 min',
    arrival: 'Arrives at 09:32',
    crowd: 'Moderate' as CrowdLevel,
    accent: colors.blue,
  },
  {
    id: 'comfortable',
    duration: '35 min',
    label: 'Less crowded',
    detail: 'Walk 6 min · Bus 22A · Walk 4 min',
    arrival: 'Arrives at 09:39',
    crowd: 'Low' as CrowdLevel,
    accent: colors.green,
  },
];

// Replace this demo array with public transport authority service alerts from the backend.
export const serviceAlerts = [
  {
    id: 'market-road',
    type: 'Route change',
    title: 'Route 41 is using Park Street today',
    detail: 'Market Road is closed for repair. Expect a 5-minute delay.',
    time: 'Updated 12 min ago',
    tone: 'warning' as const,
  },
  {
    id: 'station',
    type: 'Service update',
    title: 'Central Station stop is open',
    detail: 'All city buses are stopping at Platform B as usual.',
    time: 'Updated 42 min ago',
    tone: 'success' as const,
  },
  {
    id: 'rain',
    type: 'Weather notice',
    title: 'Allow extra travel time this evening',
    detail: 'Light rain may slow buses on Lake Road and Ring Road.',
    time: 'Updated 1 hr ago',
    tone: 'info' as const,
  },
];

export function crowdColors(crowd: CrowdLevel) {
  if (crowd === 'Low') return { background: colors.greenPale, text: colors.green };
  if (crowd === 'High') return { background: colors.redPale, text: colors.red };
  return { background: colors.orangePale, text: colors.orange };
}
