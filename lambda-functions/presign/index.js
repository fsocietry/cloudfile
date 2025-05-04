// lambda-functions/presign/index.js

// 1. Import dan konfigurasi S3 agar pakai Signature Version 4 & region sesuai Lambda env
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  signatureVersion: 'v4',
  region: process.env.AWS_REGION  // pastikan Lambda berjalan di ap-southeast-2
});

exports.handler = async (event) => {
  console.log('Received presign request:', JSON.stringify(event));
  
  // 2. Ambil parameter fileName & fileType
  const fileName = event.queryStringParameters.fileName;
  const fileType = event.queryStringParameters.fileType;
  
  console.log(`Generating presigned URL for file: ${fileName} (${fileType})`);

  // Validasi parameter
  if (!fileName || !fileType) {
    console.error('Missing required parameters');
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Missing required parameters (fileName or fileType)' })
    };
  }

  // 3. Siapkan opsi getSignedUrl
  const params = {
    Bucket: process.env.BUCKET,
    Key: `uploads/${fileName}`,
    Expires: 60,               // URL valid 60 detik
    ContentType: fileType      // harus sama dengan header Content-Type saat upload
  };

  try {
    // 4. Generate presigned URL dengan SigV4
    console.log('Generating presigned URL with params:', JSON.stringify(params));
    const uploadUrl = await s3.getSignedUrlPromise('putObject', params);
    
    console.log('Generated URL:', uploadUrl);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // atau origin frontend-mu
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uploadUrl })
    };
  } catch (err) {
    console.error('Error generating presigned URL:', err);
    return {
      statusCode: 500,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ error: 'Failed to generate presigned URL', message: err.message })
    };
  }
};