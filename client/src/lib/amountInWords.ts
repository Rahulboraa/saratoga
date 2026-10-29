const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

/** Under a hundred, which is the only part that needs the irregular names. */
function underHundred(n: number): string {
  if (n < 20) return ONES[n]
  const tens = TENS[Math.floor(n / 10)]
  const ones = ONES[n % 10]
  return ones ? `${tens} ${ones}` : tens
}

function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const head = hundreds ? `${ONES[hundreds]} Hundred` : ''
  if (!rest) return head
  return head ? `${head} ${underHundred(rest)}` : underHundred(rest)
}

/**
 * A rupee figure written out, the way an invoice in India states it.
 *
 * Grouped in the Indian system — crore, lakh, thousand — rather than millions, and
 * rounded to the rupee, since paise never appear on these bills.
 */
export function amountInWords(amount: number): string {
  const rupees = Math.round(Math.abs(amount))
  if (rupees === 0) return 'Rupees Zero Only'

  const crore = Math.floor(rupees / 10_000_000)
  const lakh = Math.floor((rupees % 10_000_000) / 100_000)
  const thousand = Math.floor((rupees % 100_000) / 1000)
  const rest = rupees % 1000

  const parts = [
    crore && `${underThousand(crore)} Crore`,
    lakh && `${underThousand(lakh)} Lakh`,
    thousand && `${underThousand(thousand)} Thousand`,
    rest && underThousand(rest),
  ].filter(Boolean)

  const sign = amount < 0 ? 'Minus ' : ''
  return `${sign}Rupees ${parts.join(' ')} Only`
}
