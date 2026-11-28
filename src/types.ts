export type PageView =
  | 'home'
  | 'flight-results'
  | 'hotel-results'
  | 'transfer-results'
  | 'tour-results'
  | 'campaigns'
  | 'checkin'
  | 'help'
  | 'booking-ops'
  | 'panel'
  | 'admin'
  | 'developer'
  | 'legal'
  | 'not-found';

export type SearchTab = 'flight' | 'hotel' | 'transfer' | 'tour';
export type TripType = 'oneway' | 'roundtrip' | 'multicity';
export type LangCode = 'TR' | 'EN' | 'RU' | 'KK';
export type CurrencyCode = 'TRY' | 'USD' | 'EUR' | 'KZT' | 'RUB';
export type LegalDocKey = 'terms' | 'kvkk' | 'refund' | 'commercial' | 'cookies';

export interface AdminMarkupConfig {
  domesticAddTRY: number;
  centralAsiaPercent: number;
  intlPercent: number;
  hotelPercent: number;
  transferAddTRY: number;
  revision?: number;
}

export interface FlightSearchQuery {
  tripType: TripType;
  fromCode: string;
  toCode: string;
  departDate: string;
  returnDate: string;
  leg2FromCode?: string;
  leg2ToCode?: string;
  leg2Date?: string;
  adults: number;
  children: number;
  infants: number;
  cabin: 'Ekonomi' | 'Business';
}

export interface HotelSearchQuery {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}

export interface TransferSearchQuery {
  from: string;
  to: string;
  date: string;
  time: string;
  adults: number;
  children: number;
}

export type StaffPermission =
  | 'flights.sell'
  | 'hotels.sell'
  | 'transfers.sell'
  | 'tours.sell'
  | 'bookings.view_own'
  | 'bookings.view_org'
  | 'bookings.view_all'
  | 'bookings.cancel_request'
  | 'bookings.manage'
  | 'refunds.process'
  | 'finance.view'
  | 'finance.manage'
  | 'analytics.view'
  | 'inventory.manage'
  | 'flights.manual'
  | 'pricing.edit'
  | 'fx.manage'
  | 'coupons.manage'
  | 'apis.manage'
  | 'team.manage';

export interface Organization {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'suspended';
  creditLimitTRY: number;
  usedCreditTRY: number;
  remainingCreditTRY: number;
  discountPercent: number;
  allowedModules: Array<'flights' | 'hotels' | 'transfers' | 'tours'>;
  createdAt: number;
}

export interface OrgLedgerEntry {
  id: string;
  organizationId: string;
  type: 'debit' | 'credit';
  amount: number;
  description: string;
  pnr: string;
  createdBy: string;
  createdAt: number;
}

export interface SavedPassengerRecord {
  id: string;
  fullName: string;
  tcOrPassport: string;
  birthDate: string;
  gender: 'M' | 'F';
  phone: string;
  createdAt: number;
}

export interface PriceAlertRecord {
  id: string;
  route: string;
  target: number;
  current: number;
  createdAt: number;
}

export interface UserProfile {
  id: string;
  role: 'member' | 'admin';
  roleLabel?: string;
  totpEnabled?: boolean;
  status?: 'active' | 'pending' | 'suspended';
  organizationId?: string | null;
  organizationDiscountPercent?: number;
  permissions?: StaffPermission[];
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accountType: 'individual' | 'corporate';
  companyName?: string;
  applicantType?: 'agency' | 'corporate' | 'sales';
  taxId?: string;
  requestedModules?: string[];
  miles: number;
  createdAt: string;
  registeredAt?: number;
}

export interface BookingPassengerDetail {
  fullName: string;
  documentType?: 'kimlik' | 'pasaport';
  tcOrPassport?: string;
  nationality?: string;
  passportCountry?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  passportIssuer?: string;
  birthDate?: string;
  gender?: string;
  paxType?: string;
}

export interface BookingLegDetail {
  direction: 'Gidiş' | 'Dönüş';
  fromCode: string;
  toCode: string;
  date: string;
  departTime: string;
  arriveTime: string;
  flightNumber: string;
  airline: string;
  baggage?: string;
  cabin?: string;
  duration?: string;
}

export interface BoardingPassSeatItem {
  fullName: string;
  seat: string;
  seqNo?: string;
}

export interface BoardingPassInfo {
  seat: string;
  passengerSeats?: BoardingPassSeatItem[];
  airlinePnr?: string;
  eticketNo?: string;
  terminal?: string;
  gate?: string;
  boardingTime?: string;
  gateCloseTime?: string;
  boardingGroup?: string;
  sequenceNo?: string;
  baggageDropNote?: string;
  mobilePassUrl?: string;
  officialQrDataUrl?: string;
  officialPassDataUrl?: string;
  officialPassFileName?: string;
  officialPassMime?: string;
  bcbpString?: string;
  sentToEmail?: string;
  emailSentAt?: number;
  emailDeliveryStatus?: 'sent' | 'queued_preview' | 'failed';
}

export interface BookingRecord {
  id: string;
  pnr: string;
  revision?: number;
  eticketNumber?: string;
  demo?: boolean;
  paymentStatus?: 'demo_unpaid' | 'demo_refunded' | 'pending' | 'verified' | 'failed' | 'refunded';
  ticketingStatus?: 'demo_not_ticketed' | 'pending' | 'ticketed' | 'voided' | 'failed';
  refundStatus?: 'none' | 'requested' | 'completed';
  appliedPricingRule?: string;
  type: 'Uçak' | 'Otel' | 'Transfer' | 'Tur';
  title: string;
  subtitle: string;
  date: string;
  returnDate?: string;
  passenger: string;
  passengersList?: SavedPassenger[];
  passengersDetail?: BookingPassengerDetail[];
  legs?: BookingLegDetail[];
  contactEmail?: string;
  contactPhone?: string;
  providerSource?: string;
  netCostTRY?: number;
  profitTRY?: number;
  couponCode?: string;
  discountTRY?: number;
  invoiceCompany?: string;
  invoiceTaxNo?: string;
  price: number;
  departTime?: string;
  arriveTime?: string;
  flightNumber?: string;
  airline?: string;
  baggage?: string;
  cabin?: string;
  duration?: string;
  autoCheckin?: boolean;
  autoCheckinFeeTRY?: number;
  checkinStatus?: 'pending' | 'completed';
  assignedSeat?: string;
  boardingPass?: BoardingPassInfo;
  createdAt?: number;
  sellerName?: string | null;
  sellerEmail?: string | null;
  organizationName?: string | null;
  status:
    | 'Onaylandı'
    | 'Tamamlandı'
    | 'İptal Talebi'
    | 'İptal Edildi'
    | 'İade Edildi';
}

export interface FinanceEntry {
  id: string;
  type: 'income' | 'expense';
  category: string;
  title: string;
  amount: number;
  entryDate: string;
  createdBy: string;
  createdAt: number;
}

export interface CrmTask {
  id: string;
  title: string;
  customerName: string;
  pnr: string;
  dueDate: string;
  priority: 'high' | 'normal' | 'low';
  status: 'open' | 'done';
  assignedTo: string;
  createdAt: number;
}

export interface CrmQuote {
  id: string;
  quoteNo: string;
  customerName: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  documentType?: 'kimlik' | 'pasaport';
  tcOrPassport?: string;
  nationality?: string;
  passportCountry?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  passportIssuer?: string;
  gender?: 'M' | 'F';
  customerEmail?: string;
  customerPhone: string;
  paxCount?: number;
  type: 'Uçak' | 'Otel' | 'Transfer' | 'Tur';
  title: string;
  details: string;
  travelDate: string;
  price: number;
  airline?: string;
  flightNumber?: string;
  departTime?: string;
  arriveTime?: string;
  duration?: string;
  baggage?: string;
  cabin?: string;
  fromCode?: string;
  toCode?: string;
  providerSource?: string;
  netCostTRY?: number;
  status: 'Taslak' | 'Gönderildi' | 'Onaylandı' | 'Kaybedildi';
  convertedPnr: string;
  createdBy: string;
  createdAt: number;
}

export interface AuditLogEntry {
  id: string;
  actor_email: string;
  action: string;
  target: string;
  ip: string;
  created_at: number;
}

export interface SavedPassenger {
  id: string;
  fullName: string;
  docNumber: string;
  birthDate: string;
  nationality: string;
}

export interface PriceAlert {
  id: string;
  route: string;
  targetPrice: number;
  currentPrice: number;
  active: boolean;
}

export interface CorpApproval {
  id: string;
  employee: string;
  department: string;
  route: string;
  date: string;
  amount: number;
  status: 'Bekliyor' | 'Onaylandı' | 'Reddedildi';
}
