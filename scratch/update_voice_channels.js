const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studycord';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('studycord');
    const filter = { name: { $in: ['Lounge', 'Peer Lounge', 'lounge', 'peer lounge'] } };
    const update = { $set: { name: 'Study Room' } };
    const res = await db.collection('channels').updateMany(filter, update);
    console.log('Channels updated in MongoDB:', res.modifiedCount);
  } catch (err) {
    console.warn('MongoDB connection note:', err.message);
  } finally {
    await client.close();
  }
}

main();
