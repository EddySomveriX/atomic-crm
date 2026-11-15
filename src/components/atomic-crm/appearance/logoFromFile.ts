/** Largest side of a stored logo, in pixels (sharp at twice the menu size) */
const MAX_SIDE = 320;
/** Files bigger than this are refused before reading */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Turns a picture file (a photo of a logo, a PNG, an SVG) into a small PNG
 * data URL kept in the configuration of the business: scaled down so that
 * its longest side is at most 320 px, transparency kept.
 */
export const logoFromFile = async (file: File): Promise<string> => {
  if (!file.type.startsWith("image/") || file.size > MAX_FILE_BYTES) {
    throw new Error("Not a picture, or larger than 5 MB");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(
      1,
      MAX_SIDE /
        Math.max(
          image.naturalWidth || MAX_SIDE,
          image.naturalHeight || MAX_SIDE,
        ),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(
      1,
      Math.round((image.naturalWidth || MAX_SIDE) * scale),
    );
    canvas.height = Math.max(
      1,
      Math.round((image.naturalHeight || MAX_SIDE) * scale),
    );
    canvas
      .getContext("2d")
      ?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
};
