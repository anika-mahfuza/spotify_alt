/**
 * Check if a color is too dark
 */
const isTooDark = (r: number, g: number, b: number): boolean => {
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  const threshold = 40; // Lowered from 100 to allow deep vibrant colors
  return brightness < threshold;
};

/**
 * Check if a color is too close to white
 */
const isTooCloseToWhite = (r: number, g: number, b: number): boolean => {
  const threshold = 220; // Increased to allow lighter vibrant colors
  return r > threshold && g > threshold && b > threshold;
};

/**
 * Get saturation of a color (0-1)
 */
const getSaturation = (r: number, g: number, b: number): number => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (max === 0) return 0;
  return d / max;
};

/**
 * Convert RGB to Hex
 */
const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
};

/**
 * Find the most prominent color from a list of RGB values (inspired by Hazy theme)
 * Now prioritizes saturation over raw frequency
 */
const findColor = (rgbList: { r: number; g: number; b: number }[], skipFilters = false): string | null => {
  const colorStats: Record<string, { count: number; saturation: number }> = {};
  let maxScore = 0;
  let bestColor = "";

  for (let i = 0; i < rgbList.length; i++) {
    const { r, g, b } = rgbList[i];
    
    if (!skipFilters) {
      if (isTooDark(r, g, b) || isTooCloseToWhite(r, g, b)) continue;
      
      // Skip very unsaturated colors (greys) unless we are desperate
      if (getSaturation(r, g, b) < 0.15) continue;
    }

    // Quantize color to reduce noise (group similar colors)
    // Round to nearest 10
    const qr = Math.round(r / 10) * 10;
    const qg = Math.round(g / 10) * 10;
    const qb = Math.round(b / 10) * 10;
    
    const key = `${qr},${qg},${qb}`;
    
    if (!colorStats[key]) {
      colorStats[key] = { count: 0, saturation: getSaturation(qr, qg, qb) };
    }
    colorStats[key].count++;
  }

  // Find winner based on score = frequency * (1 + saturation * 5)
  // This heavily favors saturated colors even if they are less frequent
  for (const [key, stats] of Object.entries(colorStats)) {
    // Score formula: balance between prevalence and vibrancy
    // We boost the score significantly for saturated colors
    const score = stats.count * (1 + stats.saturation * 3);
    
    if (score > maxScore) {
      maxScore = score;
      bestColor = key;
    }
  }

  if (!bestColor) return null;

  const [r, g, b] = bestColor.split(",").map(Number);
  return rgbToHex(r, g, b);
};

/**
 * Extract dominant color from an image URL using canvas (Hazy-style approach)
 */
export const extractDominantColor = async (imageUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve('#ffffff'); // White as fallback
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        
        const rgbList: { r: number; g: number; b: number }[] = [];
        
        // Loop every 4 pixels (r, g, b, a)
        for (let i = 0; i < imageData.length; i += 4) {
          rgbList.push({
            r: imageData[i],
            g: imageData[i + 1],
            b: imageData[i + 2],
          });
        }
        
        // Attempt with filters
        let hexColor = findColor(rgbList);
        
        // Retry without filters if no color is found
        if (!hexColor) hexColor = findColor(rgbList, true);
        
        resolve(hexColor || '#ffffff');
      } catch (error) {
        console.error('Error extracting color:', error);
        resolve('#ffffff');
      }
    };
    
    img.onerror = () => resolve('#ffffff');
    img.src = imageUrl;
  });
};

/**
 * Apply accent color to CSS variables (like Hazy theme does)
 */
export const setAccentColor = (color: string) => {
  const root = document.querySelector(":root") as HTMLElement;
  if (root) {
    root.style.setProperty("--spice-button", color);
    root.style.setProperty("--spice-button-active", color);
    root.style.setProperty("--spice-accent", color);
    root.style.setProperty("--accent-color", color);
    root.style.setProperty("--primary-color", color);

    // Set RGB variable for alpha transparency
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      root.style.setProperty("--accent-color-rgb", `${r}, ${g}, ${b}`);
    }
  }
};

/**
 * Calculate luminance of a color to determine if text should be light or dark
 */
export const getTextColor = (rgb: string): string => {
  const match = rgb.match(/\d+/g);
  if (!match) return '#FFFFFF';
  
  const [r, g, b] = match.map(Number);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

/**
 * Generate a complementary gradient from a base color
 */
export const generateGradient = (baseColor: string): string => {
  const match = baseColor.match(/\d+/g);
  if (!match) return 'linear-gradient(135deg, #121212 0%, #1a1a1a 100%)';
  
  const [r, g, b] = match.map(Number);
  
  // Create darker variant
  const darkerR = Math.max(0, Math.floor(r * 0.3));
  const darkerG = Math.max(0, Math.floor(g * 0.3));
  const darkerB = Math.max(0, Math.floor(b * 0.3));
  
  // Create lighter variant (but still muted)
  const lighterR = Math.min(255, Math.floor(r * 1.2));
  const lighterG = Math.min(255, Math.floor(g * 1.2));
  const lighterB = Math.min(255, Math.floor(b * 1.2));
  
  return `linear-gradient(135deg, rgb(${darkerR}, ${darkerG}, ${darkerB}) 0%, rgb(${r}, ${g}, ${b}) 50%, rgb(${lighterR}, ${lighterG}, ${lighterB}) 100%)`;
};

/**
 * Convert hex color to RGB string
 */
export const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 'rgb(18, 18, 18)';
  
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  
  return `rgb(${r}, ${g}, ${b})`;
};
