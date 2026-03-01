const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://ops_admin:Engagence%402025@72.62.25.188:27017/smartwealth?authSource=admin';

async function checkAssets() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('smartwealth');
    
    console.log('=== Asset Holdings ===');
    const holdings = await db.collection('asset_holdings').find().toArray();
    holdings.forEach(h => {
      console.log(JSON.stringify({
        symbol: h.symbol,
        assetType: h.assetType,
        quantity: h.quantity,
        originalQuantity: h.originalQuantity,
        originalUnit: h.originalUnit,
        displayCurrency: h.displayCurrency,
        secondaryCurrency: h.secondaryCurrency
      }, null, 2));
    });
    
    console.log('\n=== Asset Prices (Cached) ===');
    const prices = await db.collection('asset_prices').find().toArray();
    if (prices.length === 0) {
      console.log('No cached prices found in database.');
    } else {
      prices.forEach(p => {
        console.log(JSON.stringify({
          symbol: p.symbol,
          assetType: p.assetType,
          price: p.price,
          currency: p.currency,
          lastUpdated: p.lastUpdated
        }, null, 2));
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkAssets();
