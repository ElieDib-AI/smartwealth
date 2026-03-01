'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AssetType } from '@/lib/types'
import { toast } from 'sonner'

interface AddHoldingDialogProps {
  isOpen: boolean
  onClose: () => void
  accountId: string
  onSuccess: () => void
}

export function AddHoldingDialog({ isOpen, onClose, accountId, onSuccess }: AddHoldingDialogProps) {
  const [loading, setLoading] = useState(false)
  const [symbol, setSymbol] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('stock')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState<'oz' | 'g'>('oz')
  const [displayCurrency, setDisplayCurrency] = useState('USD')
  const [secondaryCurrency, setSecondaryCurrency] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const originalQuantity = parseFloat(quantity)
      let finalQuantity = originalQuantity
      
      // Convert grams to troy ounces for metals (1 troy oz = 31.1035 grams)
      if (assetType === 'metal' && unit === 'g') {
        finalQuantity = finalQuantity / 31.1035
      }

      const response = await fetch('/api/assets/holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          symbol: symbol.toUpperCase(),
          assetType,
          quantity: finalQuantity,
          displayCurrency,
          secondaryCurrency: secondaryCurrency || undefined,
          purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
          purchaseDate: purchaseDate || undefined,
          notes: notes || undefined,
          // Store original quantity and unit for metals
          originalQuantity: assetType === 'metal' ? originalQuantity : undefined,
          originalUnit: assetType === 'metal' ? unit : undefined
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Holding added successfully')
        handleClose()
        onSuccess()
      } else {
        toast.error(result.error || 'Failed to add holding')
      }
    } catch (error) {
      console.error('Error adding holding:', error)
      toast.error('Failed to add holding')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSymbol('')
    setAssetType('stock')
    setQuantity('')
    setUnit('oz')
    setDisplayCurrency('USD')
    setSecondaryCurrency('')
    setPurchasePrice('')
    setPurchaseDate('')
    setNotes('')
    onClose()
  }

  const getSymbolPlaceholder = () => {
    switch (assetType) {
      case 'stock':
        return 'e.g., AAPL, GOOGL, MSFT'
      case 'metal':
        return 'XAU (Gold), XAG (Silver), XPT (Platinum), XPD (Palladium)'
      case 'forex':
        return 'e.g., USD/AED, EUR/USD'
      case 'crypto':
        return 'e.g., BTC/USD, ETH/USD'
    }
  }

  const getSymbolHelp = () => {
    switch (assetType) {
      case 'stock':
        return 'Enter the stock ticker symbol'
      case 'metal':
        return 'Use XAU for Gold, XAG for Silver, XPT for Platinum, XPD for Palladium'
      case 'forex':
        return 'Format: FROM/TO currency codes'
      case 'crypto':
        return 'Format: CRYPTO/MARKET (e.g., BTC/USD)'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Investment Holding</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assetType">Asset Type</Label>
            <Select 
              id="assetType"
              value={assetType} 
              onChange={(e) => setAssetType(e.target.value as AssetType)}
            >
              <option value="stock">Stock / ETF</option>
              <option value="metal">Precious Metal</option>
              <option value="forex">Currency (Forex)</option>
              <option value="crypto">Cryptocurrency</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="symbol">Symbol *</Label>
            {assetType === 'metal' ? (
              <>
                <Select 
                  id="symbol"
                  value={symbol} 
                  onChange={(e) => setSymbol(e.target.value)}
                  required
                >
                  <option value="">Select a metal...</option>
                  <option value="XAU">XAU - Gold</option>
                  <option value="XAG">XAG - Silver</option>
                  <option value="XPT">XPT - Platinum</option>
                  <option value="XPD">XPD - Palladium</option>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">Select the precious metal to track</p>
              </>
            ) : (
              <>
                <Input
                  id="symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder={getSymbolPlaceholder()}
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">{getSymbolHelp()}</p>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity *</Label>
            {assetType === 'metal' ? (
              <div className="flex gap-2">
                <Input
                  id="quantity"
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g., 10, 0.5, 100"
                  className="flex-1"
                  required
                />
                <Select 
                  value={unit} 
                  onChange={(e) => setUnit(e.target.value as 'oz' | 'g')}
                  className="w-32"
                >
                  <option value="oz">Troy Oz</option>
                  <option value="g">Grams</option>
                </Select>
              </div>
            ) : (
              <Input
                id="quantity"
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g., 10, 0.5, 100"
                required
              />
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {assetType === 'metal' 
                ? 'Weight in troy ounces or grams (will be converted to troy oz)'
                : 'Number of shares, units, or coins'
              }
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayCurrency">Display Currency *</Label>
            <Select 
              id="displayCurrency"
              value={displayCurrency} 
              onChange={(e) => setDisplayCurrency(e.target.value)}
              required
            >
              <option value="USD">USD - US Dollar</option>
              <option value="AED">AED - UAE Dirham</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400">Primary currency for displaying value</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondaryCurrency">Secondary Currency (Optional)</Label>
            <Select 
              id="secondaryCurrency"
              value={secondaryCurrency} 
              onChange={(e) => setSecondaryCurrency(e.target.value)}
            >
              <option value="">None</option>
              <option value="USD">USD - US Dollar</option>
              <option value="AED">AED - UAE Dirham</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400">Show value in a second currency</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchasePrice">Purchase Price (Optional)</Label>
              <Input
                id="purchasePrice"
                type="number"
                step="any"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase Date (Optional)</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this holding..."
              rows={3}
            />
          </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Holding'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
