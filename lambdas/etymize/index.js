const OpenAI = require("openai");
const AWS = require("aws-sdk");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const s3 = new AWS.S3();

// Handle OpenAI requests
async function handleOpenAI(body) {
  const messages = body.messages;
  
  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages,
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reply: chatCompletion.choices[0].message.content
    }),
  };
}

// Handle S3 pre-signed URL generation
async function handleS3PresignedUrl(body) {
  const fileName = body.fileName;
  const fileType = body.fileType;
  
  if (!fileName || !fileType) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: 'fileName and fileType are required' 
      }),
    };
  }

  const bucketName = process.env.S3_BUCKET_NAME;
  if (!bucketName) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: 'S3_BUCKET_NAME environment variable not configured' 
      }),
    };
  }

  const params = {
    Bucket: bucketName,
    Key: `uploads/${Date.now()}-${fileName}`,
    ContentType: fileType,
    Expires: 300, // URL expires in 5 minutes
  };

  try {
    const presignedUrl = await s3.getSignedUrlPromise('putObject', params);
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        presignedUrl,
        key: params.Key,
        bucket: bucketName
      }),
    };
  } catch (err) {
    console.error("S3 presigned URL error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: 'Failed to generate presigned URL' 
      }),
    };
  }
}

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const type = body.type;

    if (type === 'openai') {
      return await handleOpenAI(body);
    } else if (type === 's3-presigned-url') {
      return await handleS3PresignedUrl(body);
    } else {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          error: 'Invalid type specified. Use "openai" or "s3-presigned-url"' 
        }),
      };
    }
  } catch (err) {
    console.error("Lambda error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: err.message || 'Internal server error' 
      }),
    };
  }
};
