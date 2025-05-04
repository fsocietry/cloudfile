const AWS = require('aws-sdk');
const sharp = require('sharp');
const s3 = new AWS.S3();
const db = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

exports.handler = async (event) => {
  console.log('Process Lambda triggered with event:', JSON.stringify(event));
  
  // Validasi event structure
  if (!event.Records || !event.Records[0] || !event.Records[0].s3) {
    console.error('Invalid event structure:', JSON.stringify(event));
    return { status: 'ERROR', message: 'Invalid event structure' };
  }
  
  const rec = event.Records[0].s3;
  const bucket = rec.bucket.name;
  const key = decodeURIComponent(rec.object.key.replace(/\+/g, ' '));
  const fileId = key.split('/').pop();
  
  console.log(`Processing file: Bucket=${bucket}, Key=${key}, FileId=${fileId}`);

  try {
    // 1. Download original
    console.log('Downloading original file from S3');
    const { Body } = await s3.getObject({ Bucket: bucket, Key: key }).promise();
    console.log('File downloaded successfully, size:', Body.length);

    // 2. Resize dengan Sharp
    console.log('Resizing image with Sharp');
    const resized = await sharp(Body).resize(800, 600).toBuffer();
    console.log('Image resized successfully, new size:', resized.length);
    
    const outKey = `resized/${fileId}`;

    // 3. Upload hasil
    console.log(`Uploading resized image to S3: ${outKey}`);
    await s3.putObject({
      Bucket: bucket,
      Key: outKey,
      Body: resized,
      ContentType: 'image/jpeg'
    }).promise();
    console.log('Resized image uploaded successfully');

    // 4. Update DynamoDB
    console.log(`Updating DynamoDB status for fileId: ${fileId}`);
    const dbItem = {
      fileId,
      timestamp: Date.now(),
      status: 'COMPLETED',
      outputKey: outKey,
      expiry: Math.floor(Date.now() / 1000) + 3600 * 24
    };
    
    console.log('DynamoDB item:', JSON.stringify(dbItem));
    
    await db.put({
      TableName: process.env.TABLE_NAME,
      Item: dbItem
    }).promise();
    console.log('DynamoDB updated successfully');

    // 5. Publish SNS
    console.log(`Publishing to SNS topic: ${process.env.TOPIC_ARN}`);
    await sns.publish({
      TopicArn: process.env.TOPIC_ARN,
      Subject: 'File Processing Completed',
      Message: JSON.stringify({ fileId, status: 'COMPLETED', outputKey: outKey })
    }).promise();
    console.log('SNS notification published successfully');

    return { status: 'OK', fileId, outputKey: outKey };
  } catch (err) {
    console.error('Error processing file:', err);
    
    // Coba update DynamoDB dengan status ERROR
    try {
      await db.put({
        TableName: process.env.TABLE_NAME,
        Item: {
          fileId,
          timestamp: Date.now(),
          status: 'ERROR',
          error: err.message,
          expiry: Math.floor(Date.now() / 1000) + 3600 * 24
        }
      }).promise();
      console.log('Updated DynamoDB with ERROR status');
    } catch (dbErr) {
      console.error('Failed to update DynamoDB with error status:', dbErr);
    }
    
    return { status: 'ERROR', message: err.message };
  }
};