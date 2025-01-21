# Vectori 
[![npm](https://img.shields.io/npm/v/vectori)](https://www.npmjs.com/package/vectori) 
[![license](https://img.shields.io/npm/l/vectori)](https://github.com/JoniBach/vectori/blob/main/LICENSE) 

**Vectori** is a powerful Node.js library for converting standard image files (PNG, JPEG) into true SVGs. Built on top of [potrace](http://potrace.sourceforge.net/), it delivers highly scalable, fully manipulable vector art. Additionally, Vectori can extract color palettes (both popular and full-range), and even provide posterized PNG outputs in both color and grayscale.

---

## Table of Contents 

- [Key Features](#key-features)
- [Installation](#installation)
- [Usage](#usage)  
    - [1. Basic Conversion](#1-basic-conversion)
    - [2. Generate SVGs with Different Fills](#2-generate-svgs-with-different-fills)
    - [3. Extract Color Palettes](#3-extract-color-palettes)
    - [4. Posterized PNG Outputs](#4-posterized-png-outputs)
- [Examples](#examples)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

---

## Key Features 

1. **Image to SVG**: Convert your PNG or JPEG images into true vector SVGs.
2. **Multiple Fill Modes**: Choose from color, greyscale, color-outline, greyscale-outline, or outline for precise styling.
3. **Color Palettes**: Extract popular colors and full-range palettes in both color and greyscale.
4. **Posterized PNG Outputs**: Create posterized PNG images that mimic the look of vector art while retaining a raster format.
5. **Scalable Vector Graphics**: Resulting SVGs can be scaled without losing quality.
6. **Flexible Integration**: Perfect for design tools, image manipulation workflows, or generating assets on-the-fly in Node.js environments.

---

## Installation 
Install **Vectori** and [potrace](https://www.npmjs.com/package/potrace) via your favorite package manager:

```bash
npm install vectori potrace
```
> **Note**: **potrace** is a required dependency used under the hood by Vectori for image tracing.

---

## Usage 

Below is a quick start guide demonstrating how to convert images, generate various SVG fills, extract color palettes, and produce posterized PNGs.

### 1. Basic Conversion 

Converting an image (PNG or JPEG) into an SVG is straightforward:

```js
import { vectori } from 'vectori';

async function processFile(image) {
    // `image` can be a file path, a Blob (in browser), or a Buffer
    const result = await vectori(image);
    return result;
}
```
> **Pro Tip**: Larger or more complex images will take longer to process. Plan accordingly for runtime.

---

### 2. Generate SVGs with Different Fills 

Vectori supports different fill modes when generating SVGs:
 
- `color`
- `greyscale`
- `color-outline`
- `greyscale-outline`
- `outline`

Once you have your processed vector, you can call:

```js
const vector = await vectori(image);

// Generate a color-filled SVG
const colorSvg = vector.svg({ fill: 'color' });

// Generate an outlined color SVG
const colorOutlinedSvg = vector.svg({ fill: 'color-outline' });

// Generate a greyscale-filled SVG
const greyscaleSvg = vector.svg({ fill: 'greyscale' });

// Generate an outlined greyscale SVG
const greyscaleOutlinedSvg = vector.svg({ fill: 'greyscale-outline' });

// Generate an outline-only SVG
const outlineSvg = vector.svg({ fill: 'outline' });
```

Each method returns an SVG string, which you can embed directly in HTML or write to a file.

---

### 3. Extract Color Palettes 
Vectori not only vectorizes images, but also analyzes their color palettes. You can retrieve both a *popular* set of colors or *all* detected colors, in either color or greyscale format.

```js
const vector = await vectori(image);

// Popular palettes
const popularColorPalette = vector.palette.popular({ fill: 'color' });
const popularGreyscalePalette = vector.palette.popular({ fill: 'greyscale' });

// Complete palettes
const fullColorPalette = vector.palette.all({ fill: 'color' });
const fullGreyscalePalette = vector.palette.all({ fill: 'greyscale' });

console.log('Popular Color:', popularColorPalette);
console.log('Popular Greyscale:', popularGreyscalePalette);
console.log('Full Color:', fullColorPalette);
console.log('Full Greyscale:', fullGreyscalePalette);
```
 
- **Popular Palette**: Returns a reduced set of the most dominant colors.
- **All Palette**: Returns every color detected by the processing algorithm.

---

### 4. Posterized PNG Outputs 

Need a raster PNG version of your image but in a posterized (reduced color) style? Vectori can do that too:

```js
const vector = await vectori(image);

// Posterized color PNG (Base64-encoded string)
const colorPng = vector.image({ fill: 'color' });

// Posterized greyscale PNG (Base64-encoded string)
const greyscalePng = vector.image({ fill: 'greyscale' });

// You can directly set `src` in the browser or decode/save to file in Node.js
```

The output is a Base64-encoded string representing the posterized PNG, ready to be displayed or saved.

---

## Examples 

Here’s a quick snippet that demonstrates uploading a file in a browser context, converting it to an SVG, and extracting a color palette:

```html
<input
    type="file"
    accept="image/*"
    onchange="uploadImage(event)"
/>

<script type="module">
    import { vectori } from 'vectori';

    async function uploadImage(event) {
        const file = event.target.files[0];
        if (!file) return;

        const result = await vectori(file);

        // Get SVG
        const svgColor = result.svg({ fill: 'color' });

        // Get popular color palette
        const popularColorPalette = result.palette.popular({ fill: 'color' });

        // Display or do something with the results
        console.log(svgColor);
        console.log(popularColorPalette);
    }
</script>
```

---

## FAQ 
 
1. **Why do I need Potrace?** 
Potrace is the underlying library that performs the actual raster-to-vector tracing. Vectori is a high-level interface wrapping its functionality.
 
2. **Does Vectori run in the browser or Node.js?** 
Vectori can run in both. However, in a Node.js environment, you can pass file paths or Buffers. In the browser, you’ll pass Blobs, File objects, or Base64 strings.
 
3. **How accurate is the conversion?** 
Conversion quality depends on image size, clarity, and color complexity. Complex images may produce large SVGs or require additional processing time.
 
4. **Can I manipulate the resulting SVG further?** 
Absolutely! Once you have the SVG string, you can inject it into the DOM, style it with CSS, or parse it further with other libraries.
 
5. **Does Vectori preserve alpha/transparency?** 
Transparency is not retained in the final vector because Potrace traces opaque shapes. However, you can experiment with settings to approximate alpha layers.

---

## Contributing 
Contributions, issues, and feature requests are welcome!
Please open an issue or submit a pull request via [GitHub](https://github.com/JoniBach/vectori). 
1. **Fork** the repository.
2. Create a new **feature** branch (`git checkout -b feature/new-feature`).
3. **Commit** your changes (`git commit -m 'Add new feature'`).
4. **Push** to the branch (`git push origin feature/new-feature`).
5. Open a **Pull Request** on GitHub.

---

## License 
**Vectori** is released under the [MIT License](https://github.com/JoniBach/vectori/blob/main/LICENSE). Feel free to use and modify it in personal or commercial projects.

---

**Happy Vectorizing!** If you have any questions or run into any issues, check out [GitHub Issues](https://github.com/JoniBach/vectori/issues) or submit a pull request with your bug fix or feature suggestion.
