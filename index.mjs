// vectori
import { Jimp } from "jimp";
import { trace } from "potrace";
import quantize from "quantize";

/**
 * Convert an RGB array ([R, G, B]) to a hex string (#rrggbb).
 * @param {number[]} rgb - An array of RGB values, e.g. [255, 128, 64].
 * @returns {string} A hex string, e.g. "#ff8040".
 */
const rgbToHex = (rgb) =>
  "#" + rgb.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");

/**
 * Compute the Euclidean distance between two RGB arrays.
 * @param {number[]} a - First color ([R, G, B]).
 * @param {number[]} b - Second color ([R, G, B]).
 * @returns {number} The distance (0 → identical, higher → more different).
 */
const computeEuclideanDistance = (a, b) =>
  Math.sqrt(a.reduce((acc, val, i) => acc + Math.pow(val - b[i], 2), 0));

/**
 * Find the closest color in a given palette to the specified color.
 * If the palette is empty, returns the original color.
 *
 * @param {number[]} color - A color ([R, G, B]) to match.
 * @param {number[][]} palette - An array of colors (each [R, G, B]).
 * @returns {number[]} The closest palette color ([R, G, B]).
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
 * @param {import('jimp').default} image - The Jimp image to modify.
 * @param {number[][]} colorPalette - An array of [R, G, B] palette colors.
 * @returns {import('jimp').default} The same Jimp image after recoloring.
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
 * Scans the provided Jimp image and extracts all unique colors as hex strings.
 * @param {import('jimp').default} image - The Jimp image to process.
 * @returns {string[]} An array of unique hex color strings.
 */
function getAllColors(image) {
  const colorSet = new Set();
  image.scan(
    0,
    0,
    image.bitmap.width,
    image.bitmap.height,
    function (x, y, idx) {
      const r = this.bitmap.data[idx];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      colorSet.add(rgbToHex([r, g, b]));
    }
  );
  return Array.from(colorSet);
}

/**
 * Create a greyscale (PNG) version of a Jimp image, returned as a base64 data URI.
 * @param {import('jimp').default} image - The original Jimp image.
 * @returns {Promise<string>} Base64 data URI for the greyscale image.
 */
const createGreyscaleImage = async (image) => {
  const greyscaleImage = image.clone().greyscale();
  const greyscaleBuffer = await greyscaleImage.getBuffer("image/png");
  return `data:image/png;base64,${greyscaleBuffer.toString("base64")}`;
};

/**
 * Scan a Jimp image and extract unique greyscale colors as hex (#rrggbb).
 * @param {import('jimp').default} image - The Jimp image to scan.
 * @returns {string[]} An array of unique greyscale hex strings.
 */
const extractGreyscalePalette = (image) => {
  const greyscalePalette = new Set();
  image.scan(
    0,
    0,
    image.bitmap.width,
    image.bitmap.height,
    function (x, y, idx) {
      const red = this.bitmap.data[idx];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];
      const grey = Math.round(0.3 * red + 0.59 * green + 0.11 * blue);
      const greyHex = rgbToHex([grey, grey, grey]);
      greyscalePalette.add(greyHex);
    }
  );
  return Array.from(greyscalePalette);
};

/**
 * For each color in `colorPalette`, create a PNG (base64) where only that color remains.
 * @param {import('jimp').default} image - The Jimp image to separate.
 * @param {number[][]} colorPalette - Array of [R, G, B] palette colors to isolate.
 * @returns {Promise<string[]>} An array of base64 PNG data URIs, one per color.
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
            const red = this.bitmap.data[idx];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];
            if (red !== color[0] || green !== color[1] || blue !== color[2]) {
              // Set non-matching colors to white
              this.bitmap.data[idx] = 255;
              this.bitmap.data[idx + 1] = 255;
              this.bitmap.data[idx + 2] = 255;
            }
          }
        );

      const newProcessedBuffer = await newImage.getBuffer("image/png");
      return `data:image/png;base64,${newProcessedBuffer.toString("base64")}`;
    })
  );
};

const TOLERANCE = 5;

/**
 * Convert a greyscale hex (#rrggbb) to a single 0–255 integer.
 * @param {string} hexString - A color hex (e.g. "#808080").
 * @returns {number} The grayscale intensity (0–255).
 */
function greyHexToNumber(hexString) {
  const r = parseInt(hexString.slice(1, 3), 16);
  const g = parseInt(hexString.slice(3, 5), 16);
  const b = parseInt(hexString.slice(5, 7), 16);
  return Math.round(0.3 * r + 0.59 * g + 0.11 * b);
}

/**
 * For each grayscale hex color in `greyscalePalette`, create a PNG (base64) where only
 * that approximate grayscale is kept, and all other pixels are turned white.
 * @param {import('jimp').default} image - The Jimp image to separate.
 * @param {string[]} greyscalePalette - Array of greyscale hex colors (e.g. "#808080").
 * @returns {Promise<string[]>} Array of base64 PNG data URIs, one per grayscale color.
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
            const red = this.bitmap.data[idx];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];
            const grey = Math.round(0.3 * red + 0.59 * green + 0.11 * blue);

            if (Math.abs(grey - targetGrey) <= TOLERANCE) {
              // Force the pixel to the exact grayscale
              this.bitmap.data[idx] = targetGrey;
              this.bitmap.data[idx + 1] = targetGrey;
              this.bitmap.data[idx + 2] = targetGrey;
            } else {
              // Otherwise, turn pixel white
              this.bitmap.data[idx] = 255;
              this.bitmap.data[idx + 1] = 255;
              this.bitmap.data[idx + 2] = 255;
            }
          }
        );

      const newBuffer = await newImage.getBuffer("image/png");
      return `data:image/png;base64,${newBuffer.toString("base64")}`;
    })
  );
};

/**
 * Convert an array of base64 PNG images into SVG strings via Potrace.
 * The i-th image is traced using the color at `colorPallet[i]`.
 * @param {string[]} separatedColorImages - Array of base64 PNG data URIs.
 * @param {string[]} colorPallet - Array of hex colors (e.g. ["#ff0000", "#00ff00"]).
 * @returns {Promise<string[]>} An array of traced SVG strings.
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
 * Merges multiple SVGs into a single <svg> by combining their internal paths,
 * adjusting the viewBox to contain them all.
 * @param {string[]} svgs - An array of SVG strings to combine.
 * @returns {string} A single merged SVG string.
 */
const mergeSvgs = (svgs) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const mergedSvgContent = svgs
    .map((svg) => {
      const viewBoxMatch = svg.match(/viewBox="([\d\s.-]+)"/);
      const widthMatch = svg.match(/width="([\d.]+)"/);
      const heightMatch = svg.match(/height="([\d.]+)"/);

      let contentMinX = 0,
        contentMinY = 0,
        contentWidth = 0,
        contentHeight = 0;

      if (viewBoxMatch) {
        const [x, y, width, height] = viewBoxMatch[1]
          .split(" ")
          .map(parseFloat);
        contentMinX = x;
        contentMinY = y;
        contentWidth = width;
        contentHeight = height;
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
  const mergedSvgHeader = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${finalWidth} ${finalHeight}" width="${finalWidth}" height="${finalHeight}">`;
  const mergedSvgFooter = `</svg>`;
  return `${mergedSvgHeader}\n${mergedSvgContent}\n${mergedSvgFooter}`;
};

/**
 * Convert a File object (from FormData) into a Node.js Buffer.
 * @param {File} file - An image file from a form submission.
 * @returns {Promise<Buffer>} The file as a Buffer.
 */
const createBuffer = async (file) => Buffer.from(await file.arrayBuffer());

/**
 * Create a Jimp image from a Buffer.
 * @param {Buffer} buffer - Raw image data.
 * @returns {Promise<import('jimp').default>} A Jimp image instance.
 */
const createImage = async (buffer) => Jimp.read(buffer);

/**
 * Create a custom color palette by extracting and clustering all (or sampled) colors
 * from an image buffer into a specified number of common colors.
 *
 * @param {Buffer} buffer - The raw image data.
 * @param {number} colorCount - Desired number of colors in the palette (default: 6).
 * @returns {Promise<number[][]>} An array of [R, G, B] arrays, one for each cluster color.
 */
async function createPallet(buffer, colorCount = 6) {
  // Read the image via Jimp
  const image = await Jimp.read(buffer);
  const { width, height } = image.bitmap;
  const pixels = [];

  // Collect pixel data from every pixel (or sample if needed)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const r = image.bitmap.data[idx];
      const g = image.bitmap.data[idx + 1];
      const b = image.bitmap.data[idx + 2];
      pixels.push([r, g, b]);
    }
  }

  // Use quantize to cluster the pixel data
  const paletteObject = quantize(pixels, colorCount);
  const clusteredColors = paletteObject.palette();
  return clusteredColors;
}

/**
 * Convert each [R, G, B] array in a palette to a hex string.
 * @param {number[][]} palette - An array of [R, G, B].
 * @returns {string[]} Array of hex strings.
 */
const mapColorPaletteToHex = (palette) => palette.map(rgbToHex);

/**
 * Convert a PNG buffer to a base64 data URI (image/png).
 * @param {Buffer} processedBuffer - The PNG buffer.
 * @returns {Promise<string>} Base64 data URI string.
 */
const createImagePath = async (processedBuffer) =>
  `data:image/png;base64,${processedBuffer.toString("base64")}`;

/**
 * Convert a base64 data URI (PNG) into a Jimp image instance.
 * @param {string} greyscaleImage - The base64 data URI.
 * @returns {Promise<import('jimp').default>} A Jimp image.
 */
const createJimpImageFromBase64 = async (greyscaleImage) =>
  await Jimp.read(Buffer.from(greyscaleImage.split(",")[1], "base64"));

/**
 * Convert each SVG in `separatedColorSvgs` into an outlined version (fill=none, black stroke).
 * @param {string[]} separatedColorSvgs - Array of SVG strings.
 * @returns {Promise<string[]>} Array of outlined SVG strings.
 */
const createSvgOutline = async (separatedColorSvgs) =>
  separatedColorSvgs.map((svg) => {
    const outlineSvg = svg
      .replace(/fill="[^"]*"/g, 'fill="none"')
      .replace(/stroke="[^"]*"/g, 'stroke="black" stroke-width="1"');
    return outlineSvg;
  });

/**
 * Extract all unique colors from a Jimp image.
 * @param {import('jimp').default} jimpImage - The Jimp image object.
 * @returns {string[]} An array of unique hex colors.
 */
const extractAllColors = (jimpImage) => {
  const allColors = new Set();
  jimpImage.scan(
    0,
    0,
    jimpImage.bitmap.width,
    jimpImage.bitmap.height,
    function (x, y, idx) {
      const r = this.bitmap.data[idx];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      allColors.add(rgbToHex([r, g, b]));
    }
  );
  return Array.from(allColors);
};

/**
 * Extract all unique greyscale colors from a Jimp image.
 * @param {import('jimp').default} jimpImage - The Jimp image object.
 * @returns {string[]} An array of unique greyscale hex colors.
 */
const extractAllGreyscale = (jimpImage) => {
  const allColors = new Set();
  jimpImage
    .clone()
    .greyscale()
    .scan(
      0,
      0,
      jimpImage.bitmap.width,
      jimpImage.bitmap.height,
      function (x, y, idx) {
        const r = this.bitmap.data[idx];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        allColors.add(rgbToHex([r, g, b]));
      }
    );
  return Array.from(allColors);
};

/**
 * Main function to convert an image File into various color-processed results.
 *
 * @param {File} file - The uploaded image file.
 * @returns {Promise<{
 *  image: (opts: { fill?: 'color'|'greyscale' }) => string,
 *  palette: { vibrant: (opts: { fill?: 'color'|'greyscale' }) => string[],
 *              all: (opts?: { fill?: 'color'|'greyscale' }) => string[] },
 *  components: {
 *    image: (opts: { fill?: 'color'|'greyscale' }) => string[],
 *    svg: (opts: { fill?: 'color'|'greyscale'|'outline' }) => string[]
 *  },
 *  svg: (opts: { fill?: 'color'|'greyscale'|'outline'|'color-outline'|'greyscale-outline' }) => string
 * }>} A structured object with image data, palettes, and SVG variations.
 */
export const vectori = async (file) => {
  // 1) Create a Buffer and Jimp image from the File
  const buffer = await createBuffer(file);
  const image = await createImage(buffer);

  // Use our custom palette function (which already returns an array of [R, G, B])
  const colorPaletteValues = await createPallet(buffer);
  const colorPallet = mapColorPaletteToHex(colorPaletteValues);

  // Also extract full color and greyscale sets directly from the image
  const allColorsPalette = extractAllColors(image);
  const greyscaleAllColorsPalette = extractAllGreyscale(image);

  // 3) Process the image with the color palette
  const processedImage = await processImage(image, colorPaletteValues);
  const processedBuffer = await processedImage.getBuffer("image/png");
  const colorImage = await createImagePath(processedBuffer);

  // 4) Create a greyscale version
  const greyscaleImage = await createGreyscaleImage(image);

  // 5) Extract a greyscale palette from the greyscale image
  const greyscaleJimpImage = await createJimpImageFromBase64(greyscaleImage);
  const greyscalePalette = extractGreyscalePalette(greyscaleJimpImage);

  // 6) Separate the original image by color and by greyscale
  const separatedColorImages = await separateColors(image, colorPaletteValues);
  const separatedGreyscaleImages = await separateGreyscaleColors(
    image,
    greyscalePalette
  );

  // 7) Convert each separated image into an SVG, using the appropriate palette
  const separatedColorSvgs = await traceImagesToSvgs(
    separatedColorImages,
    colorPallet
  );
  const separatedGreyscaleSvgs = await traceImagesToSvgs(
    separatedGreyscaleImages,
    greyscalePalette
  );

  // 8) Create outlined versions (from color SVGs)
  const separatedOutlinedSvgs = await createSvgOutline(separatedColorSvgs);

  // 9) Merge different sets of SVG layers
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

  // 10) Return the final structured object
  return {
    /** Return the main color or greyscale image (base64). */
    image: ({ fill = "color" }) => {
      if (fill === "greyscale") return greyscaleImage;
      if (fill === "color") return colorImage;
    },
    /** Return the color or greyscale palette. */
    palette: {
      popular: ({ fill = "color" }) => {
        if (fill === "greyscale") return greyscalePalette;
        if (fill === "color") return colorPallet;
      },
      all: ({ fill = "color" } = {}) => {
        if (fill === "greyscale") return greyscaleAllColorsPalette;
        if (fill === "color") return allColorsPalette;
      },
    },
    /** Return separated images or SVGs. */
    components: {
      image: ({ fill = "color" }) => {
        if (fill === "color") return separatedColorImages;
        if (fill === "greyscale") return separatedGreyscaleImages;
      },
      svg: ({ fill = "color" }) => {
        if (fill === "color") return separatedColorSvgs;
        if (fill === "greyscale") return separatedGreyscaleSvgs;
        if (fill === "outline") return separatedOutlinedSvgs;
      },
    },
    /** Return merged SVG variations. */
    svg: ({ fill = "color" }) => {
      if (fill === "color") return mergedColorSvg;
      if (fill === "greyscale") return mergedGreyscaleSvg;
      if (fill === "outline") return mergedOutlinedSvg;
      if (fill === "color-outline") return mergedColorOutlinedSvg;
      if (fill === "greyscale-outline") return mergedGreyscaleOutlinedSvg;
    },
  };
};
