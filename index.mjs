// src/lib/vectori.js
import { Jimp } from "jimp";
import { trace } from "potrace";
import quantize from "quantize";

/**
 * Convert an RGB array ([R, G, B]) to a hex string (#rrggbb).
 * @param {number[]} rgb - An array of RGB values.
 * @returns {string} A hex string.
 */
const rgbToHex = (rgb) =>
  "#" + rgb.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");

/**
 * Compute the Euclidean distance between two RGB arrays.
 * @param {number[]} a - First color ([R, G, B]).
 * @param {number[]} b - Second color ([R, G, B]).
 * @returns {number} The distance.
 */
const computeEuclideanDistance = (a, b) =>
  Math.sqrt(a.reduce((acc, val, i) => acc + Math.pow(val - b[i], 2), 0));

/**
 * Find the closest color in a given palette to the specified color.
 * If the palette is empty, returns the original color.
 * @param {number[]} color - A color ([R, G, B]) to match.
 * @param {number[][]} palette - An array of colors.
 * @returns {number[]} The closest palette color.
 */
const findClosestColor = (color, palette) => {
  if (!palette || palette.length === 0) {
    return color;
  }
  return palette.reduce((prev, curr) =>
    computeEuclideanDistance(curr, color) <
    computeEuclideanDistance(prev, color)
      ? curr
      : prev
  );
};

/**
 * Update the given Jimp image by mapping each pixel to the nearest color in `colorPalette`.
 * @param {Jimp} image - The Jimp image to modify.
 * @param {number[][]} colorPalette - An array of [R, G, B] palette colors.
 * @returns {Jimp} The recolored image.
 */
const processImage = (image, colorPalette) => {
  image.scan(
    0,
    0,
    image.bitmap.width,
    image.bitmap.height,
    function (x, y, idx) {
      const red = this.bitmap.data[idx];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];
      const closestColor = findClosestColor([red, green, blue], colorPalette);
      this.bitmap.data[idx] = closestColor[0];
      this.bitmap.data[idx + 1] = closestColor[1];
      this.bitmap.data[idx + 2] = closestColor[2];
    }
  );
  return image;
};

/**
 * Create a greyscale (PNG) version of a Jimp image, returned as a base64 data URI.
 * @param {Jimp} image - The original Jimp image.
 * @returns {Promise<string>} A base64 data URI.
 */
const createGreyscaleImage = async (image) => {
  const greyscaleImage = image.clone().greyscale();
  const buffer = await greyscaleImage.getBufferAsync(Jimp.MIME_PNG);
  return `data:image/png;base64,${buffer.toString("base64")}`;
};

/**
 * Scan a Jimp image and extract unique greyscale colors as hex.
 * @param {Jimp} image - The Jimp image to scan.
 * @returns {string[]} An array of greyscale hex strings.
 */
const extractGreyscalePalette = (image) => {
  const palette = new Set();
  image.scan(
    0,
    0,
    image.bitmap.width,
    image.bitmap.height,
    function (x, y, idx) {
      const r = this.bitmap.data[idx];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      const grey = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
      palette.add(rgbToHex([grey, grey, grey]));
    }
  );
  return Array.from(palette);
};

/**
 * For each color in `colorPalette`, create a PNG (base64) where only that color remains.
 * @param {Jimp} image - The Jimp image to separate.
 * @param {number[][]} colorPalette - Array of [R, G, B] palette colors.
 * @returns {Promise<string[]>} Array of base64 PNG data URIs.
 */
const separateColors = async (image, colorPalette) => {
  return Promise.all(
    colorPalette.map(async (color) => {
      const newImage = image
        .clone()
        .scan(
          0,
          0,
          image.bitmap.width,
          image.bitmap.height,
          function (x, y, idx) {
            const r = this.bitmap.data[idx];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            if (r !== color[0] || g !== color[1] || b !== color[2]) {
              // Set non-matching colors to white
              this.bitmap.data[idx] = 255;
              this.bitmap.data[idx + 1] = 255;
              this.bitmap.data[idx + 2] = 255;
            }
          }
        );
      const buffer = await newImage.getBufferAsync(Jimp.MIME_PNG);
      return `data:image/png;base64,${buffer.toString("base64")}`;
    })
  );
};

const TOLERANCE = 5;

/**
 * Convert a greyscale hex (#rrggbb) to a 0–255 integer.
 * @param {string} hexString - A color hex.
 * @returns {number} The grayscale intensity.
 */
const greyHexToNumber = (hexString) => {
  const r = parseInt(hexString.slice(1, 3), 16);
  const g = parseInt(hexString.slice(3, 5), 16);
  const b = parseInt(hexString.slice(5, 7), 16);
  return Math.round(0.3 * r + 0.59 * g + 0.11 * b);
};

/**
 * For each grayscale hex color in `greyscalePalette`, create a PNG (base64) where
 * only that approximate grayscale is kept.
 * @param {Jimp} image - The Jimp image to separate.
 * @param {string[]} greyscalePalette - Array of greyscale hex colors.
 * @returns {Promise<string[]>} Array of base64 PNG data URIs.
 */
const separateGreyscaleColors = async (image, greyscalePalette) => {
  return Promise.all(
    greyscalePalette.map(async (greyHex) => {
      const targetGrey = greyHexToNumber(greyHex);
      const newImage = image
        .clone()
        .scan(
          0,
          0,
          image.bitmap.width,
          image.bitmap.height,
          function (x, y, idx) {
            const r = this.bitmap.data[idx];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            const grey = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
            if (Math.abs(grey - targetGrey) <= TOLERANCE) {
              this.bitmap.data[idx] = targetGrey;
              this.bitmap.data[idx + 1] = targetGrey;
              this.bitmap.data[idx + 2] = targetGrey;
            } else {
              this.bitmap.data[idx] = 255;
              this.bitmap.data[idx + 1] = 255;
              this.bitmap.data[idx + 2] = 255;
            }
          }
        );
      const buffer = await newImage.getBufferAsync(Jimp.MIME_PNG);
      return `data:image/png;base64,${buffer.toString("base64")}`;
    })
  );
};

/**
 * Convert an array of base64 PNG images into SVG strings using Potrace.
 * @param {string[]} separatedColorImages - Array of base64 PNG data URIs.
 * @param {string[]} colorPallet - Array of hex colors.
 * @returns {Promise<string[]>} Array of traced SVG strings.
 */
const traceImagesToSvgs = async (separatedColorImages, colorPallet) => {
  return Promise.all(
    separatedColorImages.map((base64Image, i) => {
      return new Promise((resolve, reject) => {
        const imageBuffer = Buffer.from(base64Image.split(",")[1], "base64");
        trace(imageBuffer, { color: colorPallet[i] }, (error, svg) => {
          if (error) {
            reject(error);
          } else {
            resolve(svg);
          }
        });
      });
    })
  );
};

/**
 * Merges multiple SVGs into a single <svg> element.
 * @param {string[]} svgs - Array of SVG strings.
 * @returns {string} A single merged SVG string.
 */
const mergeSvgs = (svgs) => {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const mergedContent = svgs
    .map((svg) => {
      const viewBoxMatch = svg.match(/viewBox="([\d\s.-]+)"/);
      const widthMatch = svg.match(/width="([\d.]+)"/);
      const heightMatch = svg.match(/height="([\d.]+)"/);
      let contentMinX = 0,
        contentMinY = 0,
        contentWidth = 0,
        contentHeight = 0;
      if (viewBoxMatch) {
        [contentMinX, contentMinY, contentWidth, contentHeight] =
          viewBoxMatch[1].split(" ").map(parseFloat);
      } else if (widthMatch && heightMatch) {
        contentWidth = parseFloat(widthMatch[1]);
        contentHeight = parseFloat(heightMatch[1]);
      }
      minX = Math.min(minX, contentMinX);
      minY = Math.min(minY, contentMinY);
      maxX = Math.max(maxX, contentMinX + contentWidth);
      maxY = Math.max(maxY, contentMinY + contentHeight);
      const contentMatch = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
      return contentMatch ? contentMatch[1] : "";
    })
    .join("\n");
  const finalWidth = maxX - minX;
  const finalHeight = maxY - minY;
  const header = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${finalWidth} ${finalHeight}" width="${finalWidth}" height="${finalHeight}">`;
  const footer = "</svg>";
  return `${header}\n${mergedContent}\n${footer}`;
};

/**
 * Convert a File (from FormData) into a Node Buffer.
 * @param {File} file - The uploaded image file.
 * @returns {Promise<Buffer>} A Buffer representing the file.
 */
const createBuffer = async (file) => Buffer.from(await file.arrayBuffer());

/**
 * Create a Jimp image from a Buffer.
 * @param {Buffer} buffer - Raw image data.
 * @returns {Promise<Jimp>} A Jimp image instance.
 */
const createImage = async (buffer) => Jimp.read(buffer);

/**
 * Create a custom color palette from an image buffer by sampling pixels
 * and clustering them with `quantize`.
 * @param {Buffer} buffer - The raw image data.
 * @param {number} colorCount - Number of colors to extract.
 * @returns {Promise<number[][]>} An array of [R, G, B] colors.
 */
async function createPallet(buffer, colorCount = 6) {
  const image = await Jimp.read(buffer);
  const { width, height } = image.bitmap;
  const pixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const r = image.bitmap.data[idx];
      const g = image.bitmap.data[idx + 1];
      const b = image.bitmap.data[idx + 2];
      pixels.push([r, g, b]);
    }
  }
  const paletteObject = quantize(pixels, colorCount);
  return paletteObject.palette();
}

/**
 * Convert each [R, G, B] color in a palette to a hex string.
 * @param {number[][]} palette - An array of [R, G, B] colors.
 * @returns {string[]} An array of hex color strings.
 */
const mapColorPaletteToHex = (palette) => palette.map(rgbToHex);

/**
 * Convert a PNG buffer to a base64 data URI.
 * @param {Buffer} buffer - The PNG buffer.
 * @returns {string} A base64 data URI.
 */
const createImagePath = async (buffer) =>
  `data:image/png;base64,${buffer.toString("base64")}`;

/**
 * Convert a base64 data URI (PNG) into a Jimp image.
 * @param {string} uri - The base64 data URI.
 * @returns {Promise<Jimp>} A Jimp image.
 */
const createJimpImageFromBase64 = async (uri) =>
  Jimp.read(Buffer.from(uri.split(",")[1], "base64"));

/**
 * Create an outlined version (no fill, black stroke) of each SVG.
 * @param {string[]} svgArray - Array of SVG strings.
 * @returns {string[]} Array of outlined SVG strings.
 */
const createSvgOutline = async (svgArray) =>
  svgArray.map((svg) =>
    svg
      .replace(/fill="[^"]*"/g, 'fill="none"')
      .replace(/stroke="[^"]*"/g, 'stroke="black" stroke-width="1"')
  );

/**
 * Main function to convert an image file into various processed results.
 * @param {File} file - The uploaded image file (from a form).
 * @returns {Promise<Object>} A structured object containing image data, palettes, and SVGs.
 */
export const vectori = async (file) => {
  // Create a Buffer and Jimp image from the file.
  const buffer = await createBuffer(file);
  const image = await createImage(buffer);

  // Generate a color palette from the image.
  const colorPaletteValues = await createPallet(buffer);
  const colorPallet = mapColorPaletteToHex(colorPaletteValues);

  // Extract all colors directly from the image.
  const allColorsPalette = [];
  image.scan(
    0,
    0,
    image.bitmap.width,
    image.bitmap.height,
    function (x, y, idx) {
      const r = this.bitmap.data[idx];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      allColorsPalette.push(rgbToHex([r, g, b]));
    }
  );
  // Remove duplicates.
  const uniqueAllColorsPalette = Array.from(new Set(allColorsPalette));

  // Process the image using our color palette.
  const processedImage = await processImage(image.clone(), colorPaletteValues);
  const processedBuffer = await processedImage.getBufferAsync(Jimp.MIME_PNG);
  const colorImage = await createImagePath(processedBuffer);

  // Create a greyscale version.
  const greyscaleImage = await createGreyscaleImage(image);

  // Create a Jimp image from the greyscale image for palette extraction.
  const greyscaleJimpImage = await createJimpImageFromBase64(greyscaleImage);
  const greyscalePalette = extractGreyscalePalette(greyscaleJimpImage);

  // Separate the image by colors.
  const separatedColorImages = await separateColors(image, colorPaletteValues);
  const separatedGreyscaleImages = await separateGreyscaleColors(
    image,
    greyscalePalette
  );

  // Convert separated images to SVGs.
  const separatedColorSvgs = await traceImagesToSvgs(
    separatedColorImages,
    colorPallet
  );
  const separatedGreyscaleSvgs = await traceImagesToSvgs(
    separatedGreyscaleImages,
    greyscalePalette
  );

  // Create outlined SVG versions.
  const separatedOutlinedSvgs = await createSvgOutline(separatedColorSvgs);

  // Merge SVG layers in various combinations.
  const mergedColorSvg = mergeSvgs(separatedColorSvgs);
  const mergedGreyscaleSvg = mergeSvgs(separatedGreyscaleSvgs);
  const mergedOutlinedSvg = mergeSvgs(separatedOutlinedSvgs);
  const mergedGreyscaleOutlinedSvg = mergeSvgs([
    ...separatedGreyscaleSvgs,
    ...separatedOutlinedSvgs,
  ]);
  const mergedColorOutlinedSvg = mergeSvgs([
    ...separatedColorSvgs,
    ...separatedOutlinedSvgs,
  ]);

  return {
    image: ({ fill = "color" }) =>
      fill === "greyscale" ? greyscaleImage : colorImage,
    palette: {
      vibrant: ({ fill = "color" }) =>
        fill === "greyscale" ? greyscalePalette : colorPallet,
      all: ({ fill = "color" } = {}) =>
        fill === "greyscale" ? greyscalePalette : uniqueAllColorsPalette,
    },
    components: {
      image: ({ fill = "color" }) =>
        fill === "color" ? separatedColorImages : separatedGreyscaleImages,
      svg: ({ fill = "color" }) => {
        if (fill === "color") return separatedColorSvgs;
        if (fill === "greyscale") return separatedGreyscaleSvgs;
        if (fill === "outline") return separatedOutlinedSvgs;
      },
    },
    svg: ({ fill = "color" }) => {
      if (fill === "color") return mergedColorSvg;
      if (fill === "greyscale") return mergedGreyscaleSvg;
      if (fill === "outline") return mergedOutlinedSvg;
      if (fill === "color-outline") return mergedColorOutlinedSvg;
      if (fill === "greyscale-outline") return mergedGreyscaleOutlinedSvg;
    },
  };
};
