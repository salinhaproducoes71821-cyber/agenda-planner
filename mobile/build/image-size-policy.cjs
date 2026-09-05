// image-size has no upstream fix for the ICNS/JXL/HEIF infinite loops.
// Apply in both Metro's main process and its transform workers before parsing.
const imageSize = require('image-size');
imageSize.disableTypes(['icns', 'jxl', 'jxl-stream', 'heif']);
