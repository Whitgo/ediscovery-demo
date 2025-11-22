/**
 * PDF Thumbnail Generator
 * Creates preview thumbnails from PDF documents
 */

const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Generate a thumbnail from the first page of a PDF
 * @param {string} pdfPath - Path to the PDF file
 * @param {object} options - Thumbnail options
 * @param {number} options.width - Target width (default: 200)
 * @param {number} options.height - Target height (default: 260)
 * @returns {Promise<Buffer>} - PNG image buffer
 */
async function generatePdfThumbnail(pdfPath, options = {}) {
  const { width = 200, height = 260 } = options;

  try {
    // Read the PDF file
    const existingPdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      throw new Error('PDF has no pages');
    }

    // Get first page
    const firstPage = pages[0];
    const { width: pageWidth, height: pageHeight } = firstPage.getSize();

    // Create a new PDF with just the first page
    const newPdfDoc = await PDFDocument.create();
    const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [0]);
    newPdfDoc.addPage(copiedPage);

    // Save as bytes
    const pdfBytes = await newPdfDoc.save();

    // For simplicity, we'll return the PDF bytes of the first page
    // In production, you'd convert this to an actual image using pdf-to-image libraries
    // For now, we'll return a data structure that the frontend can use
    return {
      pdfBytes,
      pageWidth,
      pageHeight,
      pageCount: pages.length
    };

  } catch (error) {
    console.error('Error generating PDF thumbnail:', error);
    throw error;
  }
}

/**
 * Generate a simple SVG preview placeholder for PDFs
 * @param {string} fileName - Name of the PDF file
 * @param {number} pageCount - Number of pages in the PDF
 * @returns {string} - SVG string
 */
function generatePdfPreviewSvg(fileName, pageCount = 1) {
  const shortName = fileName.length > 30 ? fileName.substring(0, 27) + '...' : fileName;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="260" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="200" height="260" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  
  <!-- PDF Icon -->
  <g transform="translate(60, 40)">
    <rect width="80" height="100" fill="#e53e3e" rx="4"/>
    <text x="40" y="60" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff" text-anchor="middle">PDF</text>
  </g>
  
  <!-- File Name -->
  <text x="100" y="170" font-family="Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle">${shortName}</text>
  
  <!-- Page Count -->
  <text x="100" y="190" font-family="Arial, sans-serif" font-size="10" fill="#718096" text-anchor="middle">${pageCount} page${pageCount !== 1 ? 's' : ''}</text>
  
  <!-- Preview Label -->
  <text x="100" y="240" font-family="Arial, sans-serif" font-size="11" fill="#4a5568" text-anchor="middle" font-weight="600">PREVIEW</text>
</svg>`;
}

/**
 * Get cached thumbnail or generate new one
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} cacheDir - Directory for cached thumbnails
 * @param {object} options - Thumbnail options
 * @returns {Promise<object>} - Thumbnail data
 */
async function getCachedThumbnail(pdfPath, cacheDir, options = {}) {
  try {
    // Create cache directory if it doesn't exist
    await fs.mkdir(cacheDir, { recursive: true });

    // Generate cache key from file path and options
    const cacheKey = crypto
      .createHash('md5')
      .update(`${pdfPath}-${JSON.stringify(options)}`)
      .digest('hex');
    
    const cachePath = path.join(cacheDir, `${cacheKey}.json`);

    // Check if cached version exists and is recent
    try {
      const cacheData = await fs.readFile(cachePath, 'utf-8');
      const cached = JSON.parse(cacheData);
      
      // Check if source file hasn't been modified since cache
      const pdfStats = await fs.stat(pdfPath);
      if (pdfStats.mtime.getTime() <= cached.generatedAt) {
        return cached;
      }
    } catch (err) {
      // Cache doesn't exist or is invalid, generate new one
    }

    // Read PDF to get metadata
    const existingPdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pageCount = pdfDoc.getPages().length;
    const fileName = path.basename(pdfPath);

    // Generate SVG preview
    const svgPreview = generatePdfPreviewSvg(fileName, pageCount);

    // Cache the result
    const thumbnailData = {
      fileName,
      pageCount,
      svgPreview,
      generatedAt: Date.now(),
      cacheKey
    };

    await fs.writeFile(cachePath, JSON.stringify(thumbnailData), 'utf-8');

    return thumbnailData;

  } catch (error) {
    console.error('Error getting cached thumbnail:', error);
    throw error;
  }
}

module.exports = {
  generatePdfThumbnail,
  generatePdfPreviewSvg,
  getCachedThumbnail
};
