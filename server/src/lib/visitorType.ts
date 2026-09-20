import { VISITOR_TYPES } from '../models/Visitor.js'

type VisitorType = (typeof VISITOR_TYPES)[number]

// Read in order: the first list whose word appears in the purpose wins. Ordered so the
// more specific readings ("courier") are tried before the broader ones ("visit").
const KEYWORDS: [VisitorType, string[]][] = [
  ['Delivery', ['delivery', 'courier', 'parcel', 'amazon', 'flipkart', 'blinkit', 'zepto', 'swiggy', 'zomato', 'dunzo']],
  ['Vendor', ['vendor', 'plumber', 'electrician', 'carpenter', 'technician', 'mechanic', 'repair', 'servicing', 'tent', 'decor', 'caterer', 'catering', 'supplier', 'contractor', 'painter']],
  ['Staff', ['staff', 'gardener', 'mali', 'housekeeping', 'housekeeper', 'cleaner', 'cleaning', 'guard', 'security', 'driver', 'employee', 'caretaker', 'maid', 'cook', 'chef']],
  ['Guest', ['guest', 'visit', 'tour', 'recce', 'enquiry', 'inquiry', 'client', 'site', 'booking', 'party', 'event']],
]

/**
 * Best reading of a free-text purpose. Visitors were logged as free text long before the
 * type field existed, so this is what turns "Visit 19 september" into a Guest.
 */
export function visitorTypeFromPurpose(purpose: string | null | undefined): VisitorType {
  const text = (purpose ?? '').toLowerCase().trim()
  // A visitor logged with no purpose at all is almost always someone coming to see the place.
  if (!text) return 'Guest'
  for (const [type, words] of KEYWORDS) {
    if (words.some((w) => text.includes(w))) return type
  }
  return 'Other'
}
