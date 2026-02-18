const AWS = require("aws-sdk");

const polly = new AWS.Polly();

/**
 * Lambda handler for text-to-speech using AWS Polly
 * Accepts a word parameter and returns base64-encoded audio data
 */
exports.handler = async (event) => {
  try {
    // Parse request body - handle both Function URL and API Gateway formats
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event;
    }
    const word = body.word;

    // Validate input
    if (!word || typeof word !== 'string' || word.trim().length === 0) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS"
        },
        body: JSON.stringify({
          error: 'Invalid input: word parameter is required and must be a non-empty string'
        }),
      };
    }

    // Configure Polly parameters
    const params = {
      Text: word.trim(),
      OutputFormat: 'mp3',
      VoiceId: 'Joanna',
      Engine: 'neural'
    };

    // Call Polly synthesizeSpeech API
    const pollyResponse = await polly.synthesizeSpeech(params).promise();

    // Convert audio stream to base64
    const audioBase64 = pollyResponse.AudioStream.toString('base64');

    // Return successful response
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify({
        audioContent: audioBase64,
        contentType: pollyResponse.ContentType
      }),
    };

  } catch (err) {
    console.error("TTS Lambda error:", err);

    // Handle Polly-specific errors
    if (err.code === 'InvalidSsmlException' || err.code === 'TextLengthExceededException') {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS"
        },
        body: JSON.stringify({
          error: `Polly API error: ${err.message}`
        }),
      };
    }

    // Handle throttling errors
    if (err.code === 'ThrottlingException') {
      return {
        statusCode: 429,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS"
        },
        body: JSON.stringify({
          error: 'Too many requests. Please try again later.'
        }),
      };
    }

    // Generic error response
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify({
        error: err.message || 'Internal server error'
      }),
    };
  }
};
