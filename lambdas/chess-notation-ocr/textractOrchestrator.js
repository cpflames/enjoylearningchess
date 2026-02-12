const AWS = require("aws-sdk");
const { 
  logTextractError, 
  logInfo,
  logDebug 
} = require("./errorLogger");

const textract = new AWS.Textract();

/**
 * Start an asynchronous Textract job to extract text from an image
 * Uses StartDocumentTextDetection API for simple text extraction
 * @param {string} bucket - S3 bucket name
 * @param {string} key - S3 object key
 * @returns {Promise<string>} Textract job ID
 * @throws {Error} If Textract job fails to start
 */
async function startTextractJob(bucket, key) {
  const params = {
    DocumentLocation: {
      S3Object: {
        Bucket: bucket,
        Name: key
      }
    }
  };
  
  try {
    logDebug('Starting Textract job', 'startTextractJob', { bucket, key });
    const result = await textract.startDocumentTextDetection(params).promise();
    const jobId = result.JobId;
    
    logInfo('Textract job started successfully', 'startTextractJob', {
      jobId,
      bucket,
      key
    });
    
    return jobId;
  } catch (err) {
    logTextractError(err, 'startTextractJob', {
      bucket,
      key
    });
    throw new Error(`Failed to start Textract job: ${err.message}`);
  }
}

/**
 * Check the status of a Textract job and retrieve results if complete
 * Uses GetDocumentTextDetection API to retrieve simple text extraction results
 * @param {string} jobId - Textract job ID
 * @returns {Promise<Object>} Object containing status, text, confidence, and geometry data
 * @throws {Error} If Textract operation fails
 */
async function getTextractResults(jobId) {
  const params = {
    JobId: jobId
  };
  
  try {
    logDebug('Checking Textract job status', 'getTextractResults', { jobId });
    const result = await textract.getDocumentTextDetection(params).promise();
    
    const status = result.JobStatus;
    logDebug('Textract job status retrieved', 'getTextractResults', { jobId, status });
    
    if (status === 'IN_PROGRESS') {
      return {
        status: 'IN_PROGRESS',
        text: null,
        confidence: null,
        blocks: null
      };
    }
    
    if (status === 'FAILED') {
      const errorMessage = result.StatusMessage || 'Unknown error';
      const error = new Error(`Textract job failed: ${errorMessage}`);
      logTextractError(error, 'getTextractResults', {
        jobId,
        statusMessage: errorMessage
      });
      throw error;
    }
    
    if (status === 'SUCCEEDED') {
      // Parse the Textract response
      const parsed = parseTextractResponse(result);
      
      logInfo('Textract job completed successfully', 'getTextractResults', {
        jobId,
        textLength: parsed.text.length,
        confidence: parsed.confidence,
        blockCount: parsed.blocks.length
      });
      
      return {
        status: 'SUCCEEDED',
        ...parsed
      };
    }
    
    // Handle unexpected status
    const error = new Error(`Unexpected Textract job status: ${status}`);
    logTextractError(error, 'getTextractResults', { jobId, status });
    throw error;
  } catch (err) {
    logTextractError(err, 'getTextractResults', { jobId });
    throw err;
  }
}

/**
 * Parse Textract response to extract text, confidence scores, and geometry data
 * Uses spatial coordinates to preserve table structure
 * @param {Object} textractResponse - Raw Textract API response
 * @returns {Object} Parsed data with text, confidence, and blocks
 */
function parseTextractResponse(textractResponse) {
  const blocks = textractResponse.Blocks || [];
  
  // Extract LINE blocks for text content
  const lineBlocks = blocks.filter(block => block.BlockType === 'LINE');
  
  // Extract text and calculate average confidence
  let totalConfidence = 0;
  let confidenceCount = 0;
  const geometryData = [];
  const textOnlyBlocks = [];
  
  for (const block of lineBlocks) {
    if (block.Confidence !== undefined) {
      totalConfidence += block.Confidence;
      confidenceCount++;
    }
    
    // Preserve spatial layout information
    if (block.Geometry && block.Geometry.BoundingBox) {
      geometryData.push({
        text: block.Text || '',
        confidence: block.Confidence || 0,
        geometry: {
          boundingBox: {
            width: block.Geometry.BoundingBox.Width,
            height: block.Geometry.BoundingBox.Height,
            left: block.Geometry.BoundingBox.Left,
            top: block.Geometry.BoundingBox.Top
          }
        }
      });
    } else if (block.Text) {
      // Fallback for blocks without geometry
      textOnlyBlocks.push(block.Text);
    }
  }
  
  // Sort blocks spatially to preserve table structure if we have geometry data
  // Otherwise fall back to simple concatenation
  const extractedText = geometryData.length > 0 
    ? reconstructSpatialLayout(geometryData)
    : textOnlyBlocks.join('\n');
  
  // Calculate average confidence
  const averageConfidence = confidenceCount > 0 
    ? totalConfidence / confidenceCount 
    : 0;
  
  return {
    text: extractedText,
    confidence: averageConfidence,
    blocks: geometryData
  };
}

/**
 * Reconstruct text layout using spatial coordinates
 * Groups text blocks by row (Y-coordinate) and sorts within rows by column (X-coordinate)
 * @param {Array} blocks - Array of blocks with geometry data
 * @returns {string} Spatially reconstructed text
 */
function reconstructSpatialLayout(blocks) {
  if (blocks.length === 0) {
    return '';
  }
  
  // Sort blocks by vertical position (top coordinate)
  const sortedByY = [...blocks].sort((a, b) => {
    return a.geometry.boundingBox.top - b.geometry.boundingBox.top;
  });
  
  // Group blocks into rows based on vertical proximity
  const rows = [];
  let currentRow = [sortedByY[0]];
  
  for (let i = 1; i < sortedByY.length; i++) {
    const currentBlock = sortedByY[i];
    const previousBlock = sortedByY[i - 1];
    
    // Calculate vertical distance between blocks
    const verticalDistance = Math.abs(
      currentBlock.geometry.boundingBox.top - previousBlock.geometry.boundingBox.top
    );
    
    // Use average height as threshold for same row
    const avgHeight = (currentBlock.geometry.boundingBox.height + 
                      previousBlock.geometry.boundingBox.height) / 2;
    const rowThreshold = avgHeight * 0.5; // Blocks within 50% of height are same row
    
    if (verticalDistance < rowThreshold) {
      // Same row
      currentRow.push(currentBlock);
    } else {
      // New row
      rows.push(currentRow);
      currentRow = [currentBlock];
    }
  }
  
  // Don't forget the last row
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }
  
  // Sort each row by horizontal position (left coordinate)
  const sortedRows = rows.map(row => {
    return row.sort((a, b) => {
      return a.geometry.boundingBox.left - b.geometry.boundingBox.left;
    });
  });
  
  // Join text within rows with spaces, and rows with newlines
  const textLines = sortedRows.map(row => {
    return row.map(block => block.text).join(' ');
  });
  
  return textLines.join('\n');
}

module.exports = {
  startTextractJob,
  getTextractResults,
  parseTextractResponse,
  reconstructSpatialLayout
};
