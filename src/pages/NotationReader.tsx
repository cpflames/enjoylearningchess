import React, { useState, FormEvent } from 'react';

interface FormElements extends HTMLFormControlsCollection {
  imageUpload: HTMLInputElement;
}

interface NotationFormElement extends HTMLFormElement {
  readonly elements: FormElements;
}

const LAMBDA_ENDPOINT = 'https://bry1jd6sz0.execute-api.us-west-1.amazonaws.com/etymize';

export default function NotationReader(): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [extractedText, setExtractedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setUploadProgress('');
      
      // Create preview URL for image
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent<NotationFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError("Please select an image file");
      return;
    }

    setIsLoading(true);
    setError(null);
    setExtractedText('');
    setUploadProgress('Getting upload URL...');

    try {
      // Step 1: Get S3 pre-signed URL from Lambda
      const presignedUrlResponse = await fetch(LAMBDA_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 's3-presigned-url',
          fileName: selectedFile.name,
          fileType: selectedFile.type
        }),
      });

      if (!presignedUrlResponse.ok) {
        throw new Error(`Failed to get upload URL: ${presignedUrlResponse.status}`);
      }

      const presignedUrlData = await presignedUrlResponse.json();
      
      if (presignedUrlData.error) {
        throw new Error(presignedUrlData.error);
      }

      setUploadProgress('Uploading image to S3...');

      // Step 2: Upload image to S3 using pre-signed URL
      const uploadResponse = await fetch(presignedUrlData.presignedUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload image: ${uploadResponse.status}`);
      }

      setUploadProgress('Processing image with OCR...');

      // Step 3: Call Lambda to process the uploaded image
      // For now, we'll simulate OCR processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setExtractedText(`Image uploaded successfully to S3!\n\nFile: ${selectedFile.name}\nS3 Key: ${presignedUrlData.key}\n\nOCR processing will be implemented next. This will extract chess notation from the uploaded image.`);
      setUploadProgress('');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred processing the image');
      setUploadProgress('');
    } finally {
      setIsLoading(false);
    }
  };

  const clearImage = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setExtractedText('');
    setError(null);
    setUploadProgress('');
    
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  return (
    <div className="App" style={{ textAlign: 'left', margin: '20px' }}>
      <h2>♟️ Notation Reader: Chess Score Sheet Scanner</h2>
      <h4>Upload an image of a chess notation sheet to extract the moves</h4>

      <form style={{ marginBottom: '20px' }} onSubmit={handleSubmit}>
        <p>Select image file:</p>
        <input 
          type="file"
          name="imageUpload"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ 
            margin: '10px',
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
        
        {selectedFile && (
          <div style={{ margin: '10px 0' }}>
            <button 
              type="button" 
              onClick={clearImage}
              style={{ 
                margin: '0 10px 10px 0',
                padding: '5px 10px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear Image
            </button>
          </div>
        )}

        <br/>
        <button 
          type="submit" 
          style={{ 
            margin: '10px',
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          disabled={!selectedFile || isLoading}
        >
          {isLoading ? 'Processing...' : 'Upload & Process'}
        </button>
      </form>

      {/* Upload Progress */}
      {uploadProgress && (
        <div style={{ 
          backgroundColor: '#e8f5e8',
          padding: '10px',
          marginBottom: '10px',
          borderRadius: '4px',
          border: '1px solid #4CAF50'
        }}>
          <strong>Status:</strong> {uploadProgress}
        </div>
      )}

      {/* Image Preview */}
      {previewUrl && (
        <div style={{ 
          backgroundColor: '#f5f5f5',
          padding: '20px',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <h3>Selected Image:</h3>
          <img 
            src={previewUrl} 
            alt="Selected notation sheet"
            style={{ 
              maxWidth: '100%',
              maxHeight: '400px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
          <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
            File: {selectedFile?.name} ({Math.round((selectedFile?.size || 0) / 1024)} KB)
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{ 
          color: 'red',
          backgroundColor: '#ffebee',
          padding: '10px',
          marginBottom: '10px',
          borderRadius: '4px'
        }}>
          Error: {error}
        </div>
      )}

      {/* Extracted Text Display */}
      {extractedText && (
        <div style={{ 
          backgroundColor: '#f5f5f5',
          padding: '20px',
          borderRadius: '4px',
          marginTop: '20px'
        }}>
          <h3>Processing Results:</h3>
          <textarea
            value={extractedText}
            onChange={(e) => setExtractedText(e.target.value)}
            style={{ 
              width: '100%',
              minHeight: '200px',
              resize: 'vertical',
              padding: '10px',
              fontFamily: 'monospace',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
            placeholder="Processing results will appear here..."
          />
          <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
            You can edit the extracted text above if needed.
          </p>
        </div>
      )}

      {/* Instructions */}
      <div style={{ 
        backgroundColor: '#e3f2fd',
        padding: '15px',
        borderRadius: '4px',
        marginTop: '20px',
        fontSize: '14px'
      }}>
        <h4>Instructions:</h4>
        <ul>
          <li>Select a clear image of a chess notation sheet</li>
          <li>Supported formats: JPG, PNG, GIF, etc.</li>
          <li>For best results, ensure the image is well-lit and text is clearly visible</li>
          <li>The image will be uploaded to S3 and processed for OCR</li>
          <li>Extracted text can be edited manually if needed</li>
        </ul>
      </div>
    </div>
  );
}
