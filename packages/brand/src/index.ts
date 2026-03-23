// @kunacademy/brand — Design tokens
// Source of truth for Kun Academy visual identity.
// Usage ratios: Primary 40%, Accent 20%, Text/Secondary/Background/Neutral 10% each.

export const colors = {
  primary: {
    DEFAULT: '#474099',
    50: '#EEEDFA',
    100: '#D5D3F2',
    200: '#ABA7E5',
    300: '#817BD8',
    400: '#5F58BD',
    500: '#474099',
    600: '#39337A',
    700: '#2B265C',
    800: '#1D1A3D',
    900: '#0E0D1F',
  },
  accent: {
    DEFAULT: '#F47E42',
    50: '#FEF0E8',
    100: '#FDE1D1',
    200: '#FBC3A3',
    300: '#F8A575',
    400: '#F47E42',
    500: '#E4601E',
    600: '#B54C18',
    700: '#873912',
    800: '#5A260C',
    900: '#2D1306',
  },
  text: '#2C2C2D',
  secondary: {
    DEFAULT: '#82C4E8',
    50: '#EDF6FC',
    100: '#DBEEF9',
    200: '#B7DDF3',
    300: '#82C4E8',
    400: '#55AEDC',
    500: '#2E96CC',
    600: '#2478A3',
    700: '#1B5A7A',
    800: '#123C52',
    900: '#091E29',
  },
  background: '#FFF5E9',
  neutral: {
    DEFAULT: '#E6E7E8',
    50: '#F7F7F8',
    100: '#F0F0F1',
    200: '#E6E7E8',
    300: '#CDCED0',
    400: '#B4B5B8',
    500: '#9B9DA0',
    600: '#7C7E82',
    700: '#5D5F62',
    800: '#3E4042',
    900: '#1F2021',
  },
} as const;

export const typography = {
  fonts: {
    arabicHeading: "'Noor', 'Tajawal', sans-serif",
    arabicBody: "'Tajawal', 'Cairo', 'Noto Naskh Arabic', sans-serif",
    englishHeading: "'STIX Two Text', serif",
    englishBody: "'Inter', sans-serif",
  },
  sizes: {
    body: '18px',
    h1: '48px',
    h2: '40px',
    h3: '36px',
    h4: '30px',
    h5: '24px',
    h6: '20px',
  },
} as const;

export const spacing = {
  sectionPadding: '80px',
  sectionPaddingMobile: '48px',
  maxContentWidth: '1200px',
  componentGap: '24px',
  cardRadius: '12px',
} as const;

export const tokens = {
  colors,
  typography,
  spacing,
} as const;

export default tokens;
