import { ObjectId } from 'mongodb'
import { getCollection } from '@/lib/database'
import { AssetType, AssetPrice } from '@/lib/types'

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY
const BASE_URL = 'https://www.alphavantage.co/query'
const CACHE_TTL_HOURS = 24

interface AlphaVantageQuote {
  'Global Quote': {
    '01. symbol': string
    '05. price': string
    '07. latest trading day': string
  }
}

interface AlphaVantageForex {
  'Realtime Currency Exchange Rate'?: {
    '1. From_Currency Code': string
    '3. To_Currency Code': string
    '5. Exchange Rate': string
    '6. Last Refreshed': string
  }
  'Note'?: string
  'Error Message'?: string
}

export class AlphaVantageService {
  private static apiCallCount = 0
  private static lastResetDate = new Date().toDateString()
  private static lastApiCallTime = 0

  private static checkRateLimit(): void {
    const today = new Date().toDateString()
    if (today !== this.lastResetDate) {
      this.apiCallCount = 0
      this.lastResetDate = today
    }

    if (this.apiCallCount >= 25) {
      throw new Error('Alpha Vantage API rate limit reached (25 calls/day). Please try again tomorrow.')
    }
  }

  private static incrementApiCall(): void {
    this.apiCallCount++
  }

  private static async fetchFromAPI(params: Record<string, string>): Promise<Response> {
    this.checkRateLimit()

    // Enforce 1 second delay between API calls
    const now = Date.now()
    const timeSinceLastCall = now - this.lastApiCallTime
    if (timeSinceLastCall < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastCall))
    }
    this.lastApiCallTime = Date.now()

    const url = new URL(BASE_URL)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
    url.searchParams.append('apikey', ALPHA_VANTAGE_API_KEY || 'demo')

    const response = await fetch(url.toString())
    this.incrementApiCall()

    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.statusText}`)
    }

    return response
  }

  private static async getCachedPrice(symbol: string, assetType: AssetType): Promise<AssetPrice | null> {
    try {
      const pricesCollection = await getCollection<AssetPrice>('asset_prices')
      const cached = await pricesCollection.findOne({ symbol, assetType })

      if (!cached) return null

      const hoursSinceUpdate = (Date.now() - cached.lastUpdated.getTime()) / (1000 * 60 * 60)
      if (hoursSinceUpdate < CACHE_TTL_HOURS) {
        return cached
      }

      return null
    } catch (error) {
      console.error('Error fetching cached price:', error)
      return null
    }
  }

  private static async cachePrice(
    symbol: string,
    assetType: AssetType,
    price: number,
    currency: string
  ): Promise<void> {
    try {
      const pricesCollection = await getCollection<AssetPrice>('asset_prices')
      await pricesCollection.updateOne(
        { symbol, assetType },
        {
          $set: {
            price,
            currency,
            lastUpdated: new Date(),
            source: 'alpha_vantage'
          }
        },
        { upsert: true }
      )
    } catch (error) {
      console.error('Error caching price:', error)
    }
  }

  static async fetchStockPrice(symbol: string): Promise<{ price: number; currency: string }> {
    const cached = await this.getCachedPrice(symbol, 'stock')
    if (cached) {
      return { price: cached.price, currency: cached.currency }
    }

    const response = await this.fetchFromAPI({
      function: 'GLOBAL_QUOTE',
      symbol
    })

    const data: AlphaVantageQuote = await response.json()

    if (!data['Global Quote'] || !data['Global Quote']['05. price']) {
      throw new Error(`Invalid stock symbol or no data available: ${symbol}`)
    }

    const price = parseFloat(data['Global Quote']['05. price'])
    const currency = 'USD'

    await this.cachePrice(symbol, 'stock', price, currency)

    return { price, currency }
  }

  static async fetchMetalPrice(metal: 'XAU' | 'XAG' | 'XPT' | 'XPD'): Promise<{ price: number; currency: string }> {
    const cached = await this.getCachedPrice(metal, 'metal')
    if (cached) {
      return { price: cached.price, currency: cached.currency }
    }

    // For gold and silver, use the dedicated GOLD_SILVER_SPOT endpoint
    // For platinum and palladium, use CURRENCY_EXCHANGE_RATE
    if (metal === 'XAU' || metal === 'XAG') {
      const symbolMap = { XAU: 'GOLD', XAG: 'SILVER' }
      const response = await this.fetchFromAPI({
        function: 'GOLD_SILVER_SPOT',
        symbol: symbolMap[metal]
      })

      const data = await response.json()

      console.log('Alpha Vantage metal spot price response:', JSON.stringify(data, null, 2))

      if (!data['price']) {
        if (data['Note']) {
          throw new Error(`Alpha Vantage API limit: ${data['Note']}`)
        }
        if (data['Error Message']) {
          throw new Error(`Alpha Vantage error: ${data['Error Message']}`)
        }
        throw new Error(`No data available for metal: ${metal}. Response: ${JSON.stringify(data)}`)
      }

      const price = parseFloat(data['price'])
      const currency = 'USD'

      await this.cachePrice(metal, 'metal', price, currency)

      return { price, currency }
    } else {
      // For platinum and palladium, use forex endpoint
      const response = await this.fetchFromAPI({
        function: 'CURRENCY_EXCHANGE_RATE',
        from_currency: metal,
        to_currency: 'USD'
      })

      const data: AlphaVantageForex = await response.json()

      console.log('Alpha Vantage metal forex response:', JSON.stringify(data, null, 2))

      if (!data['Realtime Currency Exchange Rate'] || !data['Realtime Currency Exchange Rate']['5. Exchange Rate']) {
        if (data['Note']) {
          throw new Error(`Alpha Vantage API limit: ${data['Note']}`)
        }
        if (data['Error Message']) {
          throw new Error(`Alpha Vantage error: ${data['Error Message']}`)
        }
        throw new Error(`No data available for metal: ${metal}. Response: ${JSON.stringify(data)}`)
      }

      const price = parseFloat(data['Realtime Currency Exchange Rate']['5. Exchange Rate'])
      const currency = 'USD'

      await this.cachePrice(metal, 'metal', price, currency)

      return { price, currency }
    }
  }

  static async fetchForexRate(fromCurrency: string, toCurrency: string): Promise<{ price: number; currency: string }> {
    const symbol = `${fromCurrency}/${toCurrency}`
    const cached = await this.getCachedPrice(symbol, 'forex')
    if (cached) {
      return { price: cached.price, currency: toCurrency }
    }

    const response = await this.fetchFromAPI({
      function: 'CURRENCY_EXCHANGE_RATE',
      from_currency: fromCurrency,
      to_currency: toCurrency
    })

    const data: AlphaVantageForex = await response.json()

    console.log('Alpha Vantage forex rate response:', JSON.stringify(data, null, 2))

    if (!data['Realtime Currency Exchange Rate'] || !data['Realtime Currency Exchange Rate']['5. Exchange Rate']) {
      if (data['Note']) {
        throw new Error(`Alpha Vantage API limit: ${data['Note']}`)
      }
      if (data['Error Message']) {
        throw new Error(`Alpha Vantage error: ${data['Error Message']}`)
      }
      throw new Error(`Invalid currency pair: ${fromCurrency}/${toCurrency}. Response: ${JSON.stringify(data)}`)
    }

    const price = parseFloat(data['Realtime Currency Exchange Rate']['5. Exchange Rate'])

    await this.cachePrice(symbol, 'forex', price, toCurrency)

    return { price, currency: toCurrency }
  }

  static async fetchCryptoPrice(cryptoSymbol: string, market: string = 'USD'): Promise<{ price: number; currency: string }> {
    const symbol = `${cryptoSymbol}/${market}`
    const cached = await this.getCachedPrice(symbol, 'crypto')
    if (cached) {
      return { price: cached.price, currency: cached.currency }
    }

    const response = await this.fetchFromAPI({
      function: 'CURRENCY_EXCHANGE_RATE',
      from_currency: cryptoSymbol,
      to_currency: market
    })

    const data: AlphaVantageForex = await response.json()

    if (!data['Realtime Currency Exchange Rate'] || !data['Realtime Currency Exchange Rate']['5. Exchange Rate']) {
      throw new Error(`Invalid crypto symbol: ${cryptoSymbol}`)
    }

    const price = parseFloat(data['Realtime Currency Exchange Rate']['5. Exchange Rate'])

    await this.cachePrice(symbol, 'crypto', price, market)

    return { price, currency: market }
  }

  static async syncAccountHoldings(userId: ObjectId, accountId: ObjectId): Promise<{
    totalValue: number
    currency: string
    holdingsCount: number
    updatedPrices: number
  }> {
    const holdingsCollection = await getCollection('asset_holdings')
    const accountsCollection = await getCollection('accounts')

    const holdings = await holdingsCollection.find({ userId, accountId }).toArray()

    if (holdings.length === 0) {
      return { totalValue: 0, currency: 'USD', holdingsCount: 0, updatedPrices: 0 }
    }

    let totalValue = 0
    let updatedPrices = 0
    const primaryCurrency = 'USD'

    for (const holding of holdings) {
      try {
        let priceData: { price: number; currency: string }

        switch (holding.assetType) {
          case 'stock':
            priceData = await this.fetchStockPrice(holding.symbol)
            break
          case 'metal':
            priceData = await this.fetchMetalPrice(holding.symbol as 'XAU' | 'XAG' | 'XPT' | 'XPD')
            break
          case 'forex':
            const [from, to] = holding.symbol.split('/')
            priceData = await this.fetchForexRate(from, to)
            break
          case 'crypto':
            const [crypto, market] = holding.symbol.split('/')
            priceData = await this.fetchCryptoPrice(crypto, market || 'USD')
            break
          default:
            continue
        }

        const holdingValue = holding.quantity * priceData.price
        totalValue += holdingValue
        updatedPrices++
      } catch (error) {
        console.error(`Error fetching price for ${holding.symbol}:`, error)
      }
    }

    await accountsCollection.updateOne(
      { _id: accountId, userId },
      {
        $set: {
          balance: totalValue,
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        }
      }
    )

    return {
      totalValue,
      currency: primaryCurrency,
      holdingsCount: holdings.length,
      updatedPrices
    }
  }

  static getApiCallCount(): number {
    return this.apiCallCount
  }

  static getRemainingCalls(): number {
    return Math.max(0, 25 - this.apiCallCount)
  }
}
