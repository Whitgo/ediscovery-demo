/**
 * PDF Watermark Utility
 * Applies watermarks to PDF documents for confidentiality and legal protection
 */

const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const fs = require('fs').promises;

/**
 * Apply watermark to a PDF file
 * @param {string} inputPath - Path to the input PDF file
 * @param {string} outputPath - Path to save the watermarked PDF
 * @param {object} options - Watermark options
 * @param {string} options.text - Watermark text
 * @param {string} options.position - 'diagonal' or 'bottom-center'
 * @param {number} options.opacity - Opacity value (0-1)
 * @param {object} options.color - RGB color object
 * @param {number} options.fontSize - Font size for watermark
 * @returns {Promise<object>} - Result with page count
 */
async function applyWatermark(inputPath, outputPath, options) {
  const {
    text,
    position = 'diagonal',
    opacity = 0.3,
    color = { r: 1, g: 0, b: 0 }, // Red by default
    fontSize = 48
  } = options;

  try {
    // Read the PDF file
    const existingPdfBytes = await fs.readFile(inputPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Apply watermark to each page
    for (const page of pages) {
      const { width, height } = page.getSize();
      
      // Calculate text dimensions
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = fontSize;

      if (position === 'diagonal') {
        // Center of page
        const x = (width - textWidth) / 2;
        const y = height / 2;

        // Draw diagonal watermark (45 degrees)
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(color.r, color.g, color.b),
          opacity,
          rotate: degrees(45),
        });
      } else if (position === 'bottom-center') {
        // Bottom center with margin
        const margin = 30;
        const x = (width - textWidth) / 2;
        const y = margin;

        page.drawText(text, {
          x,
          y,
          size: fontSize * 0.6, // Smaller for bottom position
          font,
          color: rgb(color.r, color.g, color.b),
          opacity,
        });
      }
    }

    // Save the watermarked PDF
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);

    return {
      success: true,
      pageCount: pages.length,
      watermarkText: text,
      watermarkPosition: position
    };
  } catch (error) {
    throw new Error(`Failed to apply watermark: ${error.message}`);
  }
}

/**
 * Apply both Bates numbering and watermark to a PDF
 * @param {string} inputPath - Path to the input PDF file
 * @param {string} outputPath - Path to save the processed PDF
 * @param {object} batesOptions - Bates numbering options
 * @param {object} watermarkOptions - Watermark options
 * @returns {Promise<object>} - Result with page count and Bates range
 */
async function applyBatesAndWatermark(inputPath, outputPath, batesOptions, watermarkOptions) {
  const {
    batesNumber,
    includeDateTime = false,
    includeUserId = false,
    userId = null,
    timestamp = new Date()
  } = batesOptions;

  const {
    text: watermarkText,
    position = 'diagonal',
    opacity = 0.3,
    color = { r: 1, g: 0, b: 0 }
  } = watermarkOptions;

  try {
    // Read the PDF file
    const existingPdfBytes = await fs.readFile(inputPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Extract base Bates number and starting sequence
    const batesMatch = batesNumber.match(/^(.+?)-(\d+)$/);
    if (!batesMatch) {
      throw new Error(`Invalid Bates number format: ${batesNumber}. Expected format: PREFIX-NUMBER`);
    }

    const batesPrefix = batesMatch[1];
    let batesSequence = parseInt(batesMatch[2], 10);
    const stampedPages = [];

    // Apply both watermark and Bates stamp to each page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();

      // 1. Apply watermark
      const watermarkFontSize = 48;
      const textWidth = boldFont.widthOfTextAtSize(watermarkText, watermarkFontSize);

      if (position === 'diagonal') {
        const x = (width - textWidth) / 2;
        const y = height / 2;

        page.drawText(watermarkText, {
          x,
          y,
          size: watermarkFontSize,
          font: boldFont,
          color: rgb(color.r, color.g, color.b),
          opacity,
          rotate: degrees(45),
        });
      } else if (position === 'bottom-center') {
        const x = (width - textWidth) / 2;
        const y = 30;

        page.drawText(watermarkText, {
          x,
          y,
          size: watermarkFontSize * 0.6,
          font: boldFont,
          color: rgb(color.r, color.g, color.b),
          opacity,
        });
      }

      // 2. Apply Bates stamp
      const currentBates = `${batesPrefix}-${String(batesSequence).padStart(6, '0')}`;
      stampedPages.push(currentBates);

      let stampText = currentBates;
      
      if (includeDateTime) {
        const dateStr = timestamp.toISOString().split('T')[0];
        const timeStr = timestamp.toTimeString().split(' ')[0];
        stampText += ` | ${dateStr} ${timeStr}`;
      }
      
      if (includeUserId && userId) {
        stampText += ` | User: ${userId}`;
      }

      // Bates stamp position: bottom right corner
      const batesFontSize = 9;
      const batesTextWidth = font.widthOfTextAtSize(stampText, batesFontSize);
      const margin = 15;
      const x = width - batesTextWidth - margin;
      const y = margin;

      page.drawText(stampText, {
        x,
        y,
        size: batesFontSize,
        font,
        color: rgb(0, 0, 0),
      });

      batesSequence++;
    }

    // Save the processed PDF
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);

    return {
      success: true,
      pageCount: pages.length,
      batesRange: {
        start: stampedPages[0],
        end: stampedPages[stampedPages.length - 1]
      },
      watermarkText,
      watermarkPosition: position
    };
  } catch (error) {
    throw new Error(`Failed to apply Bates and watermark: ${error.message}`);
  }
}

module.exports = {
  applyWatermark,
  applyBatesAndWatermark
};
