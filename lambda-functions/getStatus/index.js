const AWS = require('aws-sdk');
const db  = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  // Ambil fileId dari query string
  let fileId = event.queryStringParameters.fileId;
  
  // Hapus prefix 'uploads/' jika ada (normalisasi fileId)
  if (fileId.startsWith('uploads/')) {
    fileId = fileId.substring(8); // panjang 'uploads/'
  }
  
  // Ekstrak nama file saja jika masih memiliki path
  if (fileId.includes('/')) {
    fileId = fileId.split('/').pop();
  }

  console.log(`Querying status for fileId: ${fileId}`);

  try {
    const resp = await db.query({
      TableName: process.env.TABLE,
      KeyConditionExpression: 'fileId = :f',
      ExpressionAttributeValues: { ':f': fileId },
      ScanIndexForward: false,
      Limit: 1
    }).promise();

    const item = resp.Items[0] || { status: 'UNKNOWN' };
    
    console.log(`Found status: ${JSON.stringify(item)}`);
    
    return {
      statusCode: 200,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(item)
    };
  } catch (err) {
    console.error(`Error querying status: ${err.message}`);
    return { 
      statusCode: 500, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error querying status', message: err.message })
    };
  }
};