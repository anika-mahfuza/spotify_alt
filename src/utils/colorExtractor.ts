interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface HslColor {
  h: number;
  s: number;
  l: number;
}

interface QuantizedColor extends RgbColor {
  count: number;
  saturation: number;
  lightness: number;
  luminance: number;
}

export interface AlbumTheme {
  accent: string;
  accentHover: string;
  accentForeground: string;
  surfaceTint: string;
  supportDark: string;
  heroGradient: string;
  accentRgb: string;
  accentHoverRgb: string;
  accentForegroundRgb: string;
  surfaceTintRgb: string;
  supportDarkRgb: string;
}

const FALLBACK_RGB: RgbColor = { r: 112, g: 168, b: 255 };
const FALLBACK_DARK: RgbColor = { r: 17, g: 25, b: 40 };
const FALLBACK_TINT: RgbColor = { r: 92, g: 116, b: 150 };
const BASE_BACKGROUND: RgbColor = { r: 6, g: 10, b: 16 };
const BASE_TEXT: RgbColor = { r: 246, g: 248, b: 252 };

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const rgbToHex = ({ r, g, b }: RgbColor): string => {
  return `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
};

const hexToRgbObject = (hex: string): RgbColor | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
};

const toRgbVar = ({ r, g, b }: RgbColor): string => `${r} ${g} ${b}`;

const toRgbaString = ({ r, g, b }: RgbColor, alpha: number): string => `rgba(${r}, ${g}, ${b}, ${alpha})`;

const mixRgb = (a: RgbColor, b: RgbColor, amount: number): RgbColor => {
  const ratio = clamp(amount, 0, 1);
  return {
    r: Math.round(a.r + (b.r - a.r) * ratio),
    g: Math.round(a.g + (b.g - a.g) * ratio),
    b: Math.round(a.b + (b.b - a.b) * ratio),
  };
};

const getPerceptualLuminance = ({ r, g, b }: RgbColor): number => {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

const rgbToHsl = ({ r, g, b }: RgbColor): HslColor => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness };
  }

  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  switch (max) {
    case rn:
      hue = (gn - bn) / delta + (gn < bn ? 6 : 0);
      break;
    case gn:
      hue = (bn - rn) / delta + 2;
      break;
    default:
      hue = (rn - gn) / delta + 4;
      break;
  }

  return { h: hue / 6, s: saturation, l: lightness };
};

const hslToRgb = ({ h, s, l }: HslColor): RgbColor => {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray };
  }

  const hueToRgb = (p: number, q: number, t: number): number => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
};

const normalizeColor = (
  color: RgbColor,
  options: { minLightness: number; maxLightness: number; minSaturation: number; maxSaturation: number }
): RgbColor => {
  const hsl = rgbToHsl(color);

  return hslToRgb({
    h: hsl.h,
    s: clamp(hsl.s, options.minSaturation, options.maxSaturation),
    l: clamp(hsl.l, options.minLightness, options.maxLightness),
  });
};

const getQuantizedColors = (imageData: Uint8ClampedArray): QuantizedColor[] => {
  const totalPixels = Math.floor(imageData.length / 4);
  const sampleStride = Math.max(1, Math.floor(totalPixels / 7000));
  const stats = new Map<string, { count: number; color: RgbColor }>();

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += sampleStride) {
    const i = pixelIndex * 4;
    const alpha = imageData[i + 3];

    if (alpha < 160) continue;

    const color = {
      r: Math.round(imageData[i] / 16) * 16,
      g: Math.round(imageData[i + 1] / 16) * 16,
      b: Math.round(imageData[i + 2] / 16) * 16,
    };

    const key = `${color.r},${color.g},${color.b}`;
    const existing = stats.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      stats.set(key, { count: 1, color });
    }
  }

  return Array.from(stats.values()).map(({ count, color }) => {
    const hsl = rgbToHsl(color);
    return {
      ...color,
      count,
      saturation: hsl.s,
      lightness: hsl.l,
      luminance: getPerceptualLuminance(color),
    };
  });
};

const getColorDistance = (a: RgbColor, b: RgbColor): number => {
  return Math.sqrt(
    (a.r - b.r) ** 2 +
      (a.g - b.g) ** 2 +
      (a.b - b.b) ** 2
  );
};

const findBestColor = (
  colors: QuantizedColor[],
  scorer: (color: QuantizedColor) => number,
  options?: { avoid?: RgbColor[]; minDistance?: number }
): RgbColor | null => {
  const { avoid = [], minDistance = 70 } = options ?? {};
  let bestScore = 0;
  let bestColor: RgbColor | null = null;

  for (const color of colors) {
    if (avoid.some(candidate => getColorDistance(candidate, color) < minDistance)) {
      continue;
    }

    const score = scorer(color);
    if (score > bestScore) {
      bestScore = score;
      bestColor = color;
    }
  }

  return bestColor;
};

const buildThemeFromColors = (accentSource: RgbColor, supportSource?: RgbColor | null, tintSource?: RgbColor | null): AlbumTheme => {
  const accent = normalizeColor(accentSource, {
    minLightness: 0.44,
    maxLightness: 0.64,
    minSaturation: 0.42,
    maxSaturation: 0.82,
  });

  const supportDark = normalizeColor(
    supportSource ?? mixRgb(accent, FALLBACK_DARK, 0.72),
    {
      minLightness: 0.14,
      maxLightness: 0.24,
      minSaturation: 0.18,
      maxSaturation: 0.52,
    }
  );

  const surfaceTint = normalizeColor(
    tintSource ?? mixRgb(accent, FALLBACK_TINT, 0.55),
    {
      minLightness: 0.46,
      maxLightness: 0.68,
      minSaturation: 0.12,
      maxSaturation: 0.4,
    }
  );

  const accentHover = normalizeColor(mixRgb(accent, BASE_TEXT, 0.14), {
    minLightness: 0.5,
    maxLightness: 0.74,
    minSaturation: 0.38,
    maxSaturation: 0.82,
  });

  const accentForeground = getPerceptualLuminance(accent) > 0.52 ? BASE_BACKGROUND : BASE_TEXT;

  const heroTop = mixRgb(supportDark, accent, 0.36);
  const heroMid = mixRgb(supportDark, surfaceTint, 0.42);

  return {
    accent: rgbToHex(accent),
    accentHover: rgbToHex(accentHover),
    accentForeground: rgbToHex(accentForeground),
    surfaceTint: rgbToHex(surfaceTint),
    supportDark: rgbToHex(supportDark),
    heroGradient: `linear-gradient(180deg, ${toRgbaString(heroTop, 0.92)} 0%, ${toRgbaString(heroMid, 0.54)} 48%, ${toRgbaString(supportDark, 0)} 100%)`,
    accentRgb: toRgbVar(accent),
    accentHoverRgb: toRgbVar(accentHover),
    accentForegroundRgb: toRgbVar(accentForeground),
    surfaceTintRgb: toRgbVar(surfaceTint),
    supportDarkRgb: toRgbVar(supportDark),
  };
};

export const DEFAULT_ALBUM_THEME: AlbumTheme = buildThemeFromColors(FALLBACK_RGB, FALLBACK_DARK, FALLBACK_TINT);

export const extractAlbumTheme = async (imageUrl: string): Promise<AlbumTheme> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        resolve(DEFAULT_ALBUM_THEME);
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      try {
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const colors = getQuantizedColors(data);

        if (colors.length === 0) {
          resolve(DEFAULT_ALBUM_THEME);
          return;
        }

        const accent = findBestColor(colors, color => {
          if (color.saturation < 0.14) return 0;
          if (color.luminance < 0.12 || color.luminance > 0.88) return 0;
          const balance = 1.2 - Math.min(Math.abs(color.lightness - 0.52), 0.52);
          return color.count * (1 + color.saturation * 3.2) * balance;
        }) ?? FALLBACK_RGB;

        const supportDark = findBestColor(
          colors,
          color => {
            if (color.luminance > 0.45) return 0;
            const depth = 1.15 - Math.min(Math.abs(color.lightness - 0.22), 0.45);
            return color.count * (1 + color.saturation * 1.8) * depth;
          },
          { avoid: [accent], minDistance: 50 }
        );

        const surfaceTint = findBestColor(
          colors,
          color => {
            if (color.luminance < 0.28) return 0;
            const softness = 1.1 - Math.min(Math.abs(color.lightness - 0.64), 0.5);
            return color.count * (1 + color.saturation * 1.3) * softness;
          },
          { avoid: [accent, supportDark ?? FALLBACK_DARK], minDistance: 56 }
        );

        resolve(buildThemeFromColors(accent, supportDark, surfaceTint));
      } catch (error) {
        console.error('Error extracting album theme:', error);
        resolve(DEFAULT_ALBUM_THEME);
      }
    };

    img.onerror = () => resolve(DEFAULT_ALBUM_THEME);
    img.src = imageUrl;
  });
};

export const applyAlbumTheme = (theme: AlbumTheme = DEFAULT_ALBUM_THEME) => {
  const root = document.documentElement;

  const accent = hexToRgbObject(theme.accent) ?? FALLBACK_RGB;
  const surfaceTint = hexToRgbObject(theme.surfaceTint) ?? FALLBACK_TINT;
  const supportDark = hexToRgbObject(theme.supportDark) ?? FALLBACK_DARK;

  const appBg = mixRgb(BASE_BACKGROUND, supportDark, 0.64);
  const surface1 = mixRgb(appBg, surfaceTint, 0.18);
  const surface2 = mixRgb(appBg, surfaceTint, 0.28);
  const surface3 = mixRgb(surface2, accent, 0.12);
  const surfaceHover = mixRgb(surface3, accent, 0.16);
  const borderSoft = mixRgb(surfaceTint, BASE_TEXT, 0.22);
  const borderStrong = mixRgb(surfaceTint, BASE_TEXT, 0.38);
  const textPrimary = mixRgb(BASE_TEXT, surfaceTint, 0.05);
  const textSecondary = mixRgb({ r: 186, g: 194, b: 208 }, surfaceTint, 0.12);
  const textMuted = mixRgb({ r: 134, g: 146, b: 164 }, surfaceTint, 0.1);
  const textDisabled = mixRgb({ r: 96, g: 108, b: 124 }, supportDark, 0.08);
  const danger = { r: 245, g: 96, b: 96 };

  const variables: Record<string, string> = {
    '--app-bg': `rgb(${toRgbVar(appBg)})`,
    '--surface-1': `rgb(${toRgbVar(surface1)} / 0.82)`,
    '--surface-2': `rgb(${toRgbVar(surface2)} / 0.88)`,
    '--surface-3': `rgb(${toRgbVar(surface3)} / 0.92)`,
    '--surface-hover': `rgb(${toRgbVar(surfaceHover)} / 0.96)`,
    '--border-soft': `rgb(${toRgbVar(borderSoft)} / 0.34)`,
    '--border-strong': `rgb(${toRgbVar(borderStrong)} / 0.64)`,
    '--text-primary': `rgb(${toRgbVar(textPrimary)})`,
    '--text-secondary': `rgb(${toRgbVar(textSecondary)})`,
    '--text-muted': `rgb(${toRgbVar(textMuted)})`,
    '--accent-color': `rgb(${theme.accentRgb})`,
    '--accent-color-hover': `rgb(${theme.accentHoverRgb})`,
    '--accent-foreground': `rgb(${theme.accentForegroundRgb})`,
    '--hero-gradient': theme.heroGradient,
    '--app-bg-rgb': toRgbVar(appBg),
    '--surface-1-rgb': toRgbVar(surface1),
    '--surface-2-rgb': toRgbVar(surface2),
    '--surface-3-rgb': toRgbVar(surface3),
    '--surface-hover-rgb': toRgbVar(surfaceHover),
    '--surface-tint-rgb': theme.surfaceTintRgb,
    '--support-dark-rgb': theme.supportDarkRgb,
    '--border-soft-rgb': toRgbVar(borderSoft),
    '--border-strong-rgb': toRgbVar(borderStrong),
    '--text-primary-rgb': toRgbVar(textPrimary),
    '--text-secondary-rgb': toRgbVar(textSecondary),
    '--text-muted-rgb': toRgbVar(textMuted),
    '--text-disabled-rgb': toRgbVar(textDisabled),
    '--accent-color-rgb': theme.accentRgb,
    '--accent-hover-rgb': theme.accentHoverRgb,
    '--accent-foreground-rgb': theme.accentForegroundRgb,
    '--danger-rgb': toRgbVar(danger),
    '--spice-button': `rgb(${theme.accentRgb})`,
    '--spice-button-active': `rgb(${theme.accentHoverRgb})`,
    '--spice-accent': `rgb(${theme.accentRgb})`,
    '--primary-color': `rgb(${theme.accentRgb})`,
  };

  Object.entries(variables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
};
