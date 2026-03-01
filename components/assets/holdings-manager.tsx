'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw, Edit2, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { AssetHolding, AssetPrice, AssetType } from '@/lib/types'
import { AddHoldingDialog } from './add-holding-dialog'
import { toast } from 'sonner'

interface HoldingsManagerProps {
  accountId: string
  accountCurrency: string
  onBalanceUpdate?: () => void
}

export function HoldingsManager({ accountId, accountCurrency, onBalanceUpdate }: HoldingsManagerProps) {
  const [holdings, setHoldings] = useState<AssetHolding[]>([])
  const [prices, setPrices] = useState<Map<string, { primary: AssetPrice; secondary?: AssetPrice }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const fetchedRef = useRef(false)

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      fetchHoldings()
    }
  }, [accountId])

  const fetchHoldings = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/assets/holdings?accountId=${accountId}`)
      const result = await response.json()

      if (result.success) {
        const holdingsList = result.data || []
        setHoldings(holdingsList)
        
        // Try to load prices from DB first
        const cachedPricesCount = await fetchPricesFromDB(holdingsList)
        
        // If no prices were loaded (DB is empty), fetch from Alpha Vantage
        if (holdingsList.length > 0 && cachedPricesCount === 0) {
          console.log('No cached prices found, fetching from Alpha Vantage...')
          await fetchPricesFromAlphaVantage(holdingsList)
        }
      } else {
        toast.error(result.error || 'Failed to load holdings')
      }
    } catch (error) {
      console.error('Error fetching holdings:', error)
      toast.error('Failed to load holdings')
    } finally {
      setLoading(false)
    }
  }

  const fetchPricesFromDB = async (holdingsList: AssetHolding[]): Promise<number> => {
    const priceMap = new Map<string, { primary: AssetPrice; secondary?: AssetPrice }>()

    for (const holding of holdingsList) {
      try {
        // Fetch cached prices from DB
        const response = await fetch(`/api/assets/prices-cached/${holding.symbol}?assetType=${holding.assetType}`)
        const result = await response.json()

        if (result.success && result.data) {
          const primaryPrice: AssetPrice = {
            _id: holding._id,
            symbol: holding.symbol,
            assetType: holding.assetType,
            price: result.data.price,
            currency: result.data.currency,
            lastUpdated: new Date(result.data.lastUpdated),
            source: 'alpha_vantage'
          }

          let secondaryPrice: AssetPrice | undefined

          // Fetch secondary currency conversion if specified
          if (holding.secondaryCurrency && holding.secondaryCurrency !== holding.displayCurrency) {
            try {
              const conversionResponse = await fetch(
                `/api/assets/forex-cached/${holding.displayCurrency}/${holding.secondaryCurrency}`
              )
              const conversionResult = await conversionResponse.json()

              if (conversionResponse.ok && conversionResult.data) {
                const convertedPrice = primaryPrice.price * conversionResult.data.price
                secondaryPrice = {
                  _id: holding._id,
                  symbol: holding.symbol,
                  assetType: holding.assetType,
                  price: convertedPrice,
                  currency: holding.secondaryCurrency,
                  lastUpdated: new Date(conversionResult.data.lastUpdated),
                  source: 'alpha_vantage'
                }
              }
            } catch (error) {
              console.error(`Error fetching secondary currency for ${holding.symbol}:`, error)
            }
          }

          priceMap.set(holding.symbol, { primary: primaryPrice, secondary: secondaryPrice })
        }
      } catch (error) {
        console.error(`Error fetching cached price for ${holding.symbol}:`, error)
      }
    }

    setPrices(priceMap)
    return priceMap.size
  }

  const fetchPricesFromAlphaVantage = async (holdingsList: AssetHolding[]) => {
    const priceMap = new Map<string, { primary: AssetPrice; secondary?: AssetPrice }>()

    for (const holding of holdingsList) {
      try {
        // Fetch fresh price from Alpha Vantage
        const primaryResponse = await fetch(`/api/assets/prices/${holding.symbol}?assetType=${holding.assetType}`)
        const primaryResult = await primaryResponse.json()

        if (primaryResult.success) {
          const primaryPrice: AssetPrice = {
            _id: holding._id,
            symbol: holding.symbol,
            assetType: holding.assetType,
            price: primaryResult.data.price,
            currency: primaryResult.data.currency,
            lastUpdated: new Date(),
            source: 'alpha_vantage'
          }

          let secondaryPrice: AssetPrice | undefined

          // Fetch secondary currency price if specified
          if (holding.secondaryCurrency && holding.secondaryCurrency !== holding.displayCurrency) {
            try {
              const conversionResponse = await fetch(
                `/api/assets/forex/${holding.displayCurrency}/${holding.secondaryCurrency}`
              )
              const conversionResult = await conversionResponse.json()

              if (conversionResponse.ok && conversionResult.success && conversionResult.price) {
                const convertedPrice = primaryPrice.price * conversionResult.price
                secondaryPrice = {
                  _id: holding._id,
                  symbol: holding.symbol,
                  assetType: holding.assetType,
                  price: convertedPrice,
                  currency: holding.secondaryCurrency,
                  lastUpdated: new Date(),
                  source: 'alpha_vantage'
                }
              }
            } catch (error) {
              console.error(`Error fetching secondary currency for ${holding.symbol}:`, error)
            }
          }

          priceMap.set(holding.symbol, { primary: primaryPrice, secondary: secondaryPrice })
        }
      } catch (error) {
        console.error(`Error fetching price for ${holding.symbol}:`, error)
      }
    }

    setPrices(priceMap)
  }

  const handleRefreshPrices = async () => {
    if (holdings.length === 0) return

    setSyncing(true)
    toast.info('Fetching latest prices from Alpha Vantage...')

    try {
      // Fetch fresh prices from Alpha Vantage and save to DB
      await fetchPricesFromAlphaVantage(holdings)
      toast.success('Prices refreshed successfully')
    } catch (error) {
      console.error('Error refreshing prices:', error)
      toast.error('Failed to refresh prices')
    } finally {
      setSyncing(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch(`/api/assets/sync/${accountId}`, {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`Synced ${result.data.updatedPrices} prices. ${result.data.remainingApiCalls} API calls remaining today.`)
        await fetchHoldings()
        if (onBalanceUpdate) {
          onBalanceUpdate()
        }
      } else {
        toast.error(result.error || 'Failed to sync prices')
      }
    } catch (error) {
      console.error('Error syncing prices:', error)
      toast.error('Failed to sync prices')
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async (holdingId: string) => {
    if (!confirm('Are you sure you want to delete this holding?')) {
      return
    }

    try {
      const response = await fetch(`/api/assets/holdings/${holdingId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Holding deleted')
        fetchHoldings()
      } else {
        toast.error(result.error || 'Failed to delete holding')
      }
    } catch (error) {
      console.error('Error deleting holding:', error)
      toast.error('Failed to delete holding')
    }
  }

  const getAssetTypeLabel = (type: AssetType) => {
    const labels = {
      stock: 'Stock',
      metal: 'Metal',
      forex: 'Forex',
      crypto: 'Crypto'
    }
    return labels[type]
  }

  const getAssetTypeColor = (type: AssetType) => {
    const colors = {
      stock: 'from-cyan-600 to-blue-500',
      metal: 'from-amber-600 to-orange-500',
      forex: 'from-emerald-600 to-green-500',
      crypto: 'from-indigo-600 to-purple-500'
    }
    return colors[type]
  }

  const calculateTotalValue = (currency?: string) => {
    return holdings.reduce((total, holding) => {
      const priceData = prices.get(holding.symbol)
      if (priceData) {
        const price = currency && priceData.secondary?.currency === currency 
          ? priceData.secondary 
          : priceData.primary
        return total + (holding.quantity * price.price)
      }
      return total
    }, 0)
  }

  const calculateGainLoss = (holding: AssetHolding) => {
    const priceData = prices.get(holding.symbol)
    if (!priceData?.primary || !holding.purchasePrice) return null

    const currentValue = holding.quantity * priceData.primary.price
    const purchaseValue = holding.quantity * holding.purchasePrice
    const gainLoss = currentValue - purchaseValue
    const gainLossPercent = (gainLoss / purchaseValue) * 100

    return { gainLoss, gainLossPercent }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Investment Holdings</CardTitle>
          <CardDescription>Loading holdings...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Investment Holdings</CardTitle>
              <CardDescription>
                {holdings.length === 0 
                  ? 'Add your first holding to track its value'
                  : `${holdings.length} holding${holdings.length !== 1 ? 's' : ''}`
                }
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshPrices}
                disabled={syncing || holdings.length === 0}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Refresh Prices
              </Button>
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Holding
              </Button>
            </div>
          </div>
        </CardHeader>

        {holdings.length > 0 && (
          <CardContent>
            <div className="space-y-3">
              {holdings.map((holding) => {
                const priceData = prices.get(holding.symbol)
                const primaryPrice = priceData?.primary
                const secondaryPrice = priceData?.secondary
                const primaryValue = primaryPrice ? holding.quantity * primaryPrice.price : 0
                const secondaryValue = secondaryPrice ? holding.quantity * secondaryPrice.price : 0
                const gainLossData = calculateGainLoss(holding)

                return (
                  <div
                    key={holding._id.toString()}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className={`px-2 py-1 rounded text-xs font-medium text-white bg-gradient-to-r ${getAssetTypeColor(holding.assetType)}`}>
                          {getAssetTypeLabel(holding.assetType)}
                        </div>
                        <div>
                          <div className="font-semibold">
                            {holding.assetType === 'metal' ? (
                              <>
                                {holding.symbol === 'XAU' && 'Gold - XAU'}
                                {holding.symbol === 'XAG' && 'Silver - XAG'}
                                {holding.symbol === 'XPT' && 'Platinum - XPT'}
                                {holding.symbol === 'XPD' && 'Palladium - XPD'}
                                {!['XAU', 'XAG', 'XPT', 'XPD'].includes(holding.symbol) && holding.symbol}
                              </>
                            ) : (
                              holding.symbol
                            )}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {holding.assetType === 'metal' && holding.originalUnit && holding.originalQuantity ? (
                              <>
                                {holding.originalQuantity.toFixed(2)} {holding.originalUnit} ({holding.quantity.toFixed(4)} oz)
                                {primaryPrice && (
                                  <span className="ml-2">
                                    @ {formatCurrency(primaryPrice.price, primaryPrice.currency)}
                                    <span className="text-xs ml-1">
                                      ({new Date(primaryPrice.lastUpdated).toLocaleDateString()} {new Date(primaryPrice.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                    </span>
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                {holding.quantity.toFixed(holding.assetType === 'metal' ? 4 : 2)} {holding.assetType === 'stock' ? 'shares' : holding.assetType === 'metal' ? 'oz' : 'units'}
                                {primaryPrice && (
                                  <span className="ml-2">
                                    @ {formatCurrency(primaryPrice.price, primaryPrice.currency)}
                                    <span className="text-xs ml-1">
                                      ({new Date(primaryPrice.lastUpdated).toLocaleDateString()} {new Date(primaryPrice.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                    </span>
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {holding.notes && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {holding.notes}
                        </div>
                      )}

                      {gainLossData && (
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          {gainLossData.gainLoss >= 0 ? (
                            <div className="flex items-center text-green-600 dark:text-green-400">
                              <TrendingUp className="h-4 w-4 mr-1" />
                              +{formatCurrency(gainLossData.gainLoss, holding.displayCurrency)} ({gainLossData.gainLossPercent.toFixed(2)}%)
                            </div>
                          ) : (
                            <div className="flex items-center text-red-600 dark:text-red-400">
                              <TrendingDown className="h-4 w-4 mr-1" />
                              {formatCurrency(gainLossData.gainLoss, holding.displayCurrency)} ({gainLossData.gainLossPercent.toFixed(2)}%)
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {primaryPrice ? (
                          <>
                            <div className="font-semibold">
                              {formatCurrency(primaryValue, holding.displayCurrency)}
                            </div>
                            {secondaryPrice && (
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {formatCurrency(secondaryValue, holding.secondaryCurrency!)}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="font-semibold">—</div>
                        )}
                      </div>

                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(holding._id.toString())}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        )}
      </Card>

      <AddHoldingDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        accountId={accountId}
        onSuccess={fetchHoldings}
      />
    </>
  )
}
