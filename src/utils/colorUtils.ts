import '../theme.css';

/**
 * Increases the contrast of a hex color by boosting the dominant channel.
 * Useful for creating "Neon" versions of theme colors (Navy, Red, etc.)
 */
export const increaseContrast = (hex: string, factor: number = 1.5): string => {
  // Ensure we have a valid hex string
  if (!hex || hex.length < 7) return hex;

  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  const max = Math.max(r, g, b);

  // Boost dominant channel, dim others to maintain "purity"
  if (r === max) { 
    r = Math.min(255, r * factor); 
    g *= 0.8; 
    b *= 0.8; 
  } else if (g === max) { 
    g = Math.min(255, g * factor); 
    r *= 0.8; 
    b *= 0.8; 
  } else { 
    b = Math.min(255, b * factor); 
    r *= 0.8; 
    g *= 0.8; 
  }

  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Reads a CSS variable from the document and ensures it is a Hex string.
 * @param varName The CSS variable name (e.g., '--color-primary')
 */
export const getHexFromCssVar = (name: string): string => {
  // Remove var(...) if present
  const cleanName = name
    .replace(/^var\(/, "")
    .replace(/\)$/, "")
    .trim();

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(cleanName)
    .trim();

  if (!value) return "#000000";

  // If already hex
  if (value.startsWith("#")) return value;

  // Convert rgb/rgba → hex
  const match = value.match(/\d+/g);
  if (!match) return "#000000";

  const [r, g, b] = match.map(Number);

  const toHex = (n: number) =>
    n.toString(16).padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};