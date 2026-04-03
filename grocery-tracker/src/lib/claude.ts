import Anthropic from '@anthropic-ai/sdk'
import { ParsedReceipt } from '@/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SYSTEM_PROMPT = `You are a receipt parser. When given an image of a grocery receipt, extract all the information and return it as JSON.

Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:
{
  "store": "store name",
  "purchase_date": "YYYY-MM-DD",
  "total_amount": 0.00,
  "items": [
    {
      "name": "item name",
      "quantity": 1,
      "unit": "kg" or null,
      "unit_price": 0.00,
      "total_price": 0.00,
      "category": "one of: fresh-produce, dairy, meat-fish, bakery, frozen, drinks, snacks, cleaning, personal-care, baby, other"
    }
  ]
}

Rules:
- Prices should be numbers (not strings), in pounds (£)
- If you cannot read a price clearly, make your best estimate
- Categorise each item sensibly
- If quantity is not shown, assume 1
- Skip any lines that are not actual products (e.g. subtotals, loyalty points, bag charges — unless the bag charge is relevant)
- For Tesco receipts, the date is usually near the top or bottom
- "unit" should be the unit of measurement if shown (kg, l, g, ml) otherwise null`

export async function parseReceiptImage(
  base64Image: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<ParsedReceipt> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: 'Please parse this grocery receipt and return the structured JSON.',
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    return JSON.parse(text) as ParsedReceipt
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${text.slice(0, 200)}`)
  }
}
