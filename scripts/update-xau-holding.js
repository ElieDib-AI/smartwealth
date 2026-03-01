const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://ops_admin:Engagence%402025@72.62.25.188:27017/smartwealth?authSource=admin';

async function updateXAUHolding() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('smartwealth');
    
    console.log('Updating XAU holding with original quantity and unit...');
    
    const result = await db.collection('asset_holdings').updateOne(
      { symbol: 'XAU', assetType: 'metal' },
      { 
        $set: { 
          originalQuantity: 1050,
          originalUnit: 'g'
        } 
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✓ Successfully updated XAU holding');
      
      // Verify the update
      const updated = await db.collection('asset_holdings').findOne({ symbol: 'XAU', assetType: 'metal' });
      console.log('\nUpdated holding:');
      console.log(JSON.stringify({
        symbol: updated.symbol,
        assetType: updated.assetType,
        quantity: updated.quantity,
        originalQuantity: updated.originalQuantity,
        originalUnit: updated.originalUnit,
        displayCurrency: updated.displayCurrency,
        secondaryCurrency: updated.secondaryCurrency
      }, null, 2));
      
      // Verify the conversion (1050g / 31.1035 = 33.758 oz)
      const expectedOz = 1050 / 31.1035;
      console.log(`\nVerification: 1050g / 31.1035 = ${expectedOz.toFixed(4)} oz`);
      console.log(`Database quantity: ${updated.quantity.toFixed(4)} oz`);
      console.log(`Match: ${Math.abs(expectedOz - updated.quantity) < 0.001 ? '✓' : '✗'}`);
    } else {
      console.log('✗ No holding was updated. XAU holding may not exist.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

updateXAUHolding();
