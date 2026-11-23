export type PageView =
  | 'home'
  | 'flight-results'
  | 'hotel-results'
  | 'transfer-results'
  | 'campaigns'
  | 'checkin'
  | 'help'
  | 'booking-ops'
  | 'panel'
  | 'admin'
  | 'legal';

export type SearchTab = 'flight' | 'hotel' | 'transfer';
export type TripType = 'oneway' | 'roundtrip';
export type LangCode = 'TR' | 'EN' | 'RU' | 'KK';
export type CurrencyCode = 'TRY' | 'USD' | 'EUR' | 'KZT' | 'RUB';
export type LegalDocKey = 'terms' | 'kvkk' | 'refund' | 'commercial' | 'cookies';

export interface AdminMarkupConfig {
  domesticAddTRY: number;
  centralAsiaPercent: number;
  intlPercent: number;
  hotelPercent: number;
  transferAddTRY: number;
}

export interface FlightSearchQuery {
  tripType: TripType;
  fromCode: string;
  toCode: string;
  departDate: string;
  returnDate: string;
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

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accountType: 'individual' | 'corporate';
  companyName?: string;
  miles: number;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export interface BookingRecord {
  id: string;
  pnr: string;
  eticketNumber?: string;
  type: 'Uçak' | 'Otel' | 'Transfer';
  title: string;
  subtitle: string;
  date: string;
  returnDate?: string;
  passenger: string;
  passengersList?: SavedPassenger[];
  couponCode?: string;
  discountTRY?: number;
  invoiceCompany?: string;
  invoiceTaxNo?: string;
  price: number;
  status:
    | 'Onaylandı'
    | 'Tamamlandı'
    | 'İptal Talebi'
    | 'İptal Edildi'
    | 'İade Edildi';
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
