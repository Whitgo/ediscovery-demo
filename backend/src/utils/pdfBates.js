/**
 * PDF Bates Stamping Utility
 * Applies sequential Bates numbers to PDF documents for legal compliance
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

/**
 * Apply Bates stamp to a single PDF file
 * @param {string} inputPath - Path to the input PDF file
 * @param {string} outputPath - Path to save the stamped PDF
 * @param {object} options - Bates stamping options
 * @param {string} options.batesNumber - The Bates number to apply (e.g., "CASE001-0001")
 * @param {boolean} options.includeDateTime - Include date/time in stamp
 * @param {boolean} options.includeUserId - Include user ID in stamp
 * @param {string} options.userId - User ID to include
 * @param {Date} options.timestamp - Timestamp to include
 * @returns {Promise<object>} - Result with page count and Bates range
 */
async function applyBatesStamp(inputPath, outputPath, options) {
  const {
    batesNumber,
    includeDateTime = false,
    includeUserId = false,
    userId = null,
    timestamp = new Date()
  } = options;

  try {
    // Read the PDF file
    const existingPdfBytes = await fs.readFile(inputPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Extract base Bates number and starting sequence
    const batesMatch = batesNumber.match(/^(.+?)-(\d+)$/);
    if (!batesMatch) {
      throw new Error(`Invalid Bates number format: ${batesNumber}. Expected format: PREFIX-NUMBER`);
    }

    const batesPrefix = batesMatch[1];
    let batesSequence = parseInt(batesMatch[2], 10);

    const stampedPages = [];

    // Apply stamp to each page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();

      // Format current Bates number with leading zeros
      const currentBates = `${batesPrefix}-${String(batesSequence).padStart(4, '0')}`;
      stampedPages.push(currentBates);

      // Build stamp text
      let stampText = currentBates;
      
      if (includeDateTime) {
        const dateStr = timestamp.toISOString().split('T')[0];
        const timeStr = timestamp.toTimeString().split(' ')[0];
        stampText += ` | ${dateStr} ${timeStr}`;
      }
      
      if (includeUserId && userId) {
        stampText += ` | User: ${userId}`;
      }

      // Calculate text dimensions
      const fontSize = 9;
      const textWidth = font.widthOfTextAtSize(stampText, fontSize);
      const textHeight = fontSize;

      // Position: bottom right corner with margin
      const margin = 15;
      const x = width - textWidth - margin;
      const y = margin;

      // Draw the stamp in black
      page.drawText(stampText, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0), // Black color
      });

      batesSequence++;
    }

    // Save the stamped PDF
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);

    return {
      success: true,
      pageCount: pages.length,
      batesRange: {
        start: stampedPages[0],
        end: stampedPages[stampedPages.length - 1]
      },
      stampedPages
    };
  } catch (error) {
    console.error('Error applying Bates stamp:', error);
    throw error;
  }
}

/**
 * Process multiple PDF documents with sequential Bates numbering
 * @param {Array} documents - Array of document objects with id, name, file_path
 * @param {string} outputDir - Directory to save stamped PDFs
 * @param {object} options - Stamping options
 * @returns {Promise<object>} - Processing results with manifest
 */
async function batchStampDocuments(documents, outputDir, options) {
  const {
    batesPrefix = 'DOC',
    startingNumber = 1,
    includeDateTime = false,
    includeUserId = false,
    userId = null,
    timestamp = new Date()
  } = options;

  const results = [];
  let currentSequence = startingNumber;

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  for (const doc of documents) {
    try {
      // Only process PDF files
      if (!doc.file_name || !doc.file_name.toLowerCase().endsWith('.pdf')) {
        results.push({
          documentId: doc.id,
          fileName: doc.file_name,
          success: false,
          error: 'Not a PDF file',
          skipped: true
        });
        continue;
      }

      const inputPath = path.join(__dirname, '../../uploads', doc.file_name);
      const outputFileName = `BATES_${doc.file_name}`;
      const outputPath = path.join(outputDir, outputFileName);

      // Check if source file exists
      try {
        await fs.access(inputPath);
      } catch {
        results.push({
          documentId: doc.id,
          fileName: doc.file_name,
          success: false,
          error: 'Source file not found',
          skipped: true
        });
        continue;
      }

      const batesNumber = `${batesPrefix}-${String(currentSequence).padStart(4, '0')}`;

      const result = await applyBatesStamp(inputPath, outputPath, {
        batesNumber,
        includeDateTime,
        includeUserId,
        userId,
        timestamp
      });

      results.push({
        documentId: doc.id,
        fileName: doc.file_name,
        outputFileName,
        outputPath,
        success: true,
        pageCount: result.pageCount,
        batesRange: result.batesRange,
        stampedPages: result.stampedPages
      });

      // Update sequence for next document
      currentSequence += result.pageCount;

    } catch (error) {
      results.push({
        documentId: doc.id,
        fileName: doc.file_name,
        success: false,
        error: error.message
      });
    }
  }

  // Create manifest
  const manifest = {
    timestamp: timestamp.toISOString(),
    userId,
    batesPrefix,
    startingNumber,
    totalDocuments: documents.length,
    processedDocuments: results.filter(r => r.success).length,
    skippedDocuments: results.filter(r => r.skipped).length,
    failedDocuments: results.filter(r => !r.success && !r.skipped).length,
    totalPages: results.reduce((sum, r) => sum + (r.pageCount || 0), 0),
    batesRange: {
      start: results.find(r => r.success)?.batesRange?.start || null,
      end: results.reverse().find(r => r.success)?.batesRange?.end || null
    },
    documents: results.reverse()
  };

  return manifest;
}

/**
 * Generate Bates number for a case
 * @param {string} caseNumber - Case number to use as prefix
 * @param {number} startingNumber - Starting sequence number
 * @returns {string} - Formatted Bates number
 */
function generateBatesNumber(caseNumber, startingNumber = 1) {
  // Sanitize case number for use in Bates prefix
  const sanitizedPrefix = caseNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return `${sanitizedPrefix}-${String(startingNumber).padStart(4, '0')}`;
}

module.exports = {
  applyBatesStamp,
  batchStampDocuments,
  generateBatesNumber
};
