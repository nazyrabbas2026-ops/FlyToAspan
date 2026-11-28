import type {
  AdminMarkupConfig,
  AuditLogEntry,
  BoardingPassInfo,
  BookingRecord,
  CrmQuote,
  CrmTask,
  FinanceEntry,
  Organization,
  OrgLedgerEntry,
  PriceAlertRecord,
  SavedPassengerRecord,
  StaffPermission,
  UserProfile,
} from '../types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: Record<string, unknown>
  ) {
    super(message);
  }
}

async function request<T>(path: string, method = 'GET', body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    signal,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    throw new ApiError(503, 'FlyToAspan sunucusuna ulaşılamadı.');
  }
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data.message ?? 'İşlem tamamlanamadı.', data);
  return data as T;
}

export function apiMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.';
}

export interface Registration {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone: string;
  accountType: UserProfile['accountType'];
  companyName?: string;
  applicantType?: 'agency' | 'corporate' | 'sales';
  taxId?: string;
  requestedModules?: string[];
}

export type BookingLookup =
  | (BookingRecord & { restricted?: false })
  | { pnr: string; type: BookingRecord['type']; restricted: true };
export type CustomerServiceKind = 'cancel' | 'change' | 'refund';
export type OperationsServiceKind = 'ticketing_issue' | 'schedule_change' | 'payment_mismatch';
export type ServiceStatus = 'received' | 'in_review' | 'rejected' | 'completed';
export type ServiceScope = 'all' | 'outbound' | 'return';

export interface ServiceRequest {
  id: string;
  kind: CustomerServiceKind | OperationsServiceKind;
  scope: ServiceScope;
  passenger: number;
  requestedDate: string;
  status: ServiceStatus;
  feeKurus: number | null;
  refundKurus: number | null;
  updatedAt: number;
}

export interface StaffServiceRequest extends ServiceRequest {
  pnr: string;
  revision: number;
  reference: string;
  contactedAt: number | null;
}

type ServiceAccess = { pnr: string; surname: string; code: string };

export interface AdminCatalog {
  rules: { id: string; carrier: string; route: string; rule: string }[];
  coupons: { id: string; code: string; title: string; category: string; validUntil: string; active: boolean }[];
  agencies: { id: string; name: string; type: string; contact: string; creditLimitTRY: number; miles: number; status: string }[];
  hotels: { id: string; country?: string; city: string; name: string; stars: number; boardType: string; nights: number; price: number; image?: string; provider?: string; active: boolean }[];
  transfers: { id: string; city: string; vehicle: string; route: string; capacity: string; baggage: string; price: number; image?: string; active: boolean }[];
  tours: { id: string; country?: string; city: string; title: string; duration: string; includes?: string; quota: number; price: number; image?: string; provider?: string; active: boolean }[];
  deals: {
    id: string;
    fromCity: string;
    fromCode: string;
    toCity: string;
    toCode: string;
    region: 'YURT İÇİ' | 'AVRUPA' | 'ORTA ASYA' | 'ORTA DOĞU';
    date: string;
    price: number;
    image?: string;
    featured: boolean;
    active: boolean;
  }[];
  operators: { id: string; operator: string; product: string; markupType: 'NET' | 'EUR' | 'TRY' | 'PERCENT'; markupValue: number; active: boolean }[];
  flights: {
    id: string; airline: string; airlineCode: string; flightNumber: string; fromCode: string; toCode: string;
    departTime: string; arriveTime: string; duration: string; operator: string; baggage: string;
    flightDate?: string; priceTRY: number; quota: number; active: boolean;
  }[];
  providers: {
    id: string; name: string; protocol: string; category: string; apiUrl: string;
    xmlFeedUrl?: string; apiKey?: string; username?: string; password?: string;
    agentCode?: string; docsUrl?: string; whitelistIp?: string; mode: string; active: boolean;
  }[];
}

export type AdminCatalogState = {
  [Section in keyof AdminCatalog]?: { revision: number; items: AdminCatalog[Section] };
};

export const api = {
  salesInfo: () => request<{ seller: { name: string; address: string; email: string; phone: string } | null }>('/sales-info'),
  sendServiceCode: (pnr: string, surname: string) =>
    request<{ ok: boolean }>('/booking-service/access', 'POST', { pnr, surname }),
  serviceRequests: (access: ServiceAccess) =>
    request<{ requests: ServiceRequest[]; hasReturn: boolean; passengerCount: number }>('/booking-service/list', 'POST', access),
  createServiceRequest: (access: ServiceAccess & { kind: CustomerServiceKind; scope: ServiceScope; passenger: number; requestedDate: string }) =>
    request<{ request: ServiceRequest }>('/booking-service/requests', 'POST', access),
  operationsQueue: (page: number, closed: boolean) =>
    request<{ requests: StaffServiceRequest[]; hasNext: boolean }>(
      '/admin/booking-service?page=' + page + (closed ? '&closed=1' : ''),
    ),
  createOperationsCase: (pnr: string, kind: OperationsServiceKind) =>
    request<{ request: StaffServiceRequest }>('/admin/booking-service', 'POST', { pnr, kind }),
  updateOperationsCase: (id: string, update: {
    status: ServiceStatus; revision: number; feeKurus: number | null; refundKurus: number | null; reference: string; contacted: boolean;
  }) => request<{ request: StaffServiceRequest }>('/admin/booking-service/' + encodeURIComponent(id), 'PATCH', update),
  session: (signal?: AbortSignal) => request<{ user: UserProfile | null }>('/session', 'GET', undefined, signal),
  register: (details: Registration) =>
    request<{ user: UserProfile | null; pending?: boolean; message?: string }>('/auth/register', 'POST', details),
  login: (email: string, password: string, totpCode?: string) =>
    request<{ user: UserProfile }>('/auth/login', 'POST', totpCode ? { email, password, totpCode } : { email, password }),
  logout: () => request<{ ok: true }>('/auth/logout', 'POST'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true; user: UserProfile }>('/auth/change-password', 'POST', { currentPassword, newPassword }),
  setup2fa: (password: string, currentCode: string) =>
    request<{ secret: string; otpauthUri: string }>('/auth/2fa/setup', 'POST', { password, currentCode }),
  enable2fa: (code: string) =>
    request<{ ok: true; user: UserProfile }>('/auth/2fa/enable', 'POST', { code }),
  myOrganization: (signal?: AbortSignal) =>
    request<{
      organization: Organization | null;
      ledger: OrgLedgerEntry[];
      team: Array<{ id: string; email: string; name: string; status: string; roleLabel: string }>;
    }>('/organization/me', 'GET', undefined, signal),
  bookings: (admin: boolean, signal?: AbortSignal, query?: { q?: string; type?: string; status?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (query?.q) qs.set('q', query.q);
    if (query?.type && query.type !== 'ALL') qs.set('type', query.type);
    if (query?.status && query.status !== 'ALL') qs.set('status', query.status);
    if (query?.from) qs.set('from', query.from);
    if (query?.to) qs.set('to', query.to);
    if (query?.page) qs.set('page', String(query.page));
    if (query?.limit) qs.set('limit', String(query.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ bookings: BookingRecord[]; total?: number; page?: number; limit?: number; totalPages?: number }>(
      (admin ? '/admin/bookings' : '/bookings') + suffix, 'GET', undefined, signal
    );
  },
  bookingHistory: (id: string) =>
    request<{
      audits: AuditLogEntry[];
      notes: Array<{ id: string; author_email: string; note: string; created_at: number }>;
      ledger: OrgLedgerEntry[];
    }>(`/admin/bookings/${encodeURIComponent(id)}/history`, 'GET'),
  addBookingNote: (id: string, note: string) =>
    request<{ note: { id: string; author_email: string; note: string; created_at: number } }>(
      `/admin/bookings/${encodeURIComponent(id)}/notes`, 'POST', { note }
    ),
  pricingQuote: (payload: object) =>
    request<{ price: number; discountTRY: number; couponCode: string | null; appliedRule: string; expiresAt: number }>(
      '/pricing/quote', 'POST', payload
    ),
  createBooking: (record: BookingDraft, admin = false) => request<{ booking: BookingRecord }>(
    admin ? '/admin/bookings' : '/bookings', 'POST', record
  ),
  lookup: (pnr: string, surname: string, signal?: AbortSignal) => request<{ booking: BookingLookup }>(
    '/bookings/lookup', 'POST', { pnr, surname }, signal
  ),
  lookupCancel: (pnr: string, surname: string) => request<{ booking: BookingLookup }>(
    '/bookings/lookup-cancel', 'POST', { pnr, surname }
  ),
  cancel: (id: string) => request<{ booking: BookingRecord }>(`/bookings/${encodeURIComponent(id)}/cancel`, 'POST'),
  setStatus: (id: string, status: BookingRecord['status'], expectedStatus?: BookingRecord['status'], expectedRevision?: number) => request<{ booking: BookingRecord; refundedCariAmount?: number }>(
    `/admin/bookings/${encodeURIComponent(id)}`, 'PATCH', {
      status,
      ...(expectedStatus ? { expectedStatus } : {}),
      ...(expectedRevision !== undefined ? { expectedRevision } : {}),
    }
  ),
  updateBookingCheckin: (
    id: string,
    payload: {
      checkinStatus: 'pending' | 'completed';
      assignedSeat?: string;
      boardingPass?: Omit<BoardingPassInfo, 'emailSentAt' | 'emailDeliveryStatus'>;
      sendEmail?: boolean;
      recipientEmail?: string;
      lang?: 'TR' | 'EN' | 'RU' | 'KK';
    }
  ) =>
    request<{
      booking: BookingRecord;
      email?: {
        requested: boolean;
        sent: boolean;
        status?: 'sent' | 'queued_preview' | 'failed';
        to?: string;
        skipped?: string;
        subject?: string;
        previewHtml?: string;
      };
    }>(`/admin/bookings/${encodeURIComponent(id)}/checkin`, 'PATCH', payload),
  deleteBooking: (id: string) => request<{ ok: true }>(`/admin/bookings/${encodeURIComponent(id)}`, 'DELETE'),
  pricing: (signal?: AbortSignal) => request<{ markup: AdminMarkupConfig | null }>('/pricing', 'GET', undefined, signal),
  publicCatalog: (signal?: AbortSignal) => request<{ catalog: Partial<AdminCatalog> }>('/catalog', 'GET', undefined, signal),
  updatePricing: (markup: AdminMarkupConfig) => request<{ markup: AdminMarkupConfig }>('/admin/pricing', 'PATCH', markup),
  updateFx: (fx: { usdTry: number; eurTry: number; tryKzt: number; tryRub: number }) =>
    request<{ rates: Record<string, number>; updatedAt: string; manual: boolean }>('/admin/fx', 'PATCH', fx),
  resetFx: () => request<{ rates: Record<string, number>; updatedAt: string | null; manual: boolean }>('/admin/fx', 'DELETE'),
  adminUsers: (signal?: AbortSignal) => request<{ users: UserProfile[] }>('/admin/users', 'GET', undefined, signal),
  approveUser: (id: string, payload: { password: string; permissions: StaffPermission[]; organizationId?: string | null; organizationName?: string }) =>
    request<{ user: UserProfile }>(`/admin/users/${encodeURIComponent(id)}/approve`, 'POST', payload),
  setUserPermissions: (id: string, permissions: StaffPermission[], organizationId?: string | null) =>
    request<{ user: UserProfile }>(`/admin/users/${encodeURIComponent(id)}/permissions`, 'PATCH', { permissions, organizationId }),
  setUserStatus: (id: string, status: 'active' | 'suspended') =>
    request<{ user: UserProfile }>(`/admin/users/${encodeURIComponent(id)}/status`, 'PATCH', { status }),
  setUserRole: (id: string, role: 'member' | 'admin') =>
    request<{ user: UserProfile }>(`/admin/users/${encodeURIComponent(id)}/role`, 'PATCH', { role }),
  deleteUser: (id: string) => request<{ ok: true }>(`/admin/users/${encodeURIComponent(id)}`, 'DELETE'),
  adminOrganizations: (signal?: AbortSignal) => request<{ organizations: Organization[] }>('/admin/organizations', 'GET', undefined, signal),
  createOrganization: (payload: { name: string; type: string; creditLimitTRY: number; allowedModules: string[] }) =>
    request<{ organization: Organization }>('/admin/organizations', 'POST', payload),
  updateOrganization: (id: string, payload: { status?: 'active' | 'suspended'; creditLimitTRY?: number; discountPercent?: number; allowedModules?: string[] }) =>
    request<{ organization: Organization }>(`/admin/organizations/${encodeURIComponent(id)}`, 'PATCH', payload),
  orgLedger: (id: string, signal?: AbortSignal) =>
    request<{ entries: OrgLedgerEntry[] }>(`/admin/organizations/${encodeURIComponent(id)}/ledger`, 'GET', undefined, signal),
  orgPayment: (id: string, payload: { amount: number; description?: string }) =>
    request<{ organization: Organization; entry: OrgLedgerEntry }>(`/admin/organizations/${encodeURIComponent(id)}/payment`, 'POST', payload),
  deleteOrganization: (id: string) => request<{ ok: true }>(`/admin/organizations/${encodeURIComponent(id)}`, 'DELETE'),
  savedPassengers: (signal?: AbortSignal) => request<{ passengers: SavedPassengerRecord[] }>('/passengers', 'GET', undefined, signal),
  addSavedPassenger: (payload: { fullName: string; tcOrPassport?: string; birthDate?: string; gender?: 'M' | 'F'; phone?: string }) =>
    request<{ passenger: SavedPassengerRecord }>('/passengers', 'POST', payload),
  deleteSavedPassenger: (id: string) => request<{ ok: true }>(`/passengers/${encodeURIComponent(id)}`, 'DELETE'),
  priceAlerts: (signal?: AbortSignal) => request<{ alerts: PriceAlertRecord[] }>('/alerts', 'GET', undefined, signal),
  addPriceAlert: (payload: { route: string; target: number; current?: number }) =>
    request<{ alert: PriceAlertRecord }>('/alerts', 'POST', payload),
  deletePriceAlert: (id: string) => request<{ ok: true }>(`/alerts/${encodeURIComponent(id)}`, 'DELETE'),
  adminCatalog: (signal?: AbortSignal) => request<{ catalog: AdminCatalogState }>('/admin/catalog', 'GET', undefined, signal),
  updateAdminCatalog: <Section extends keyof AdminCatalog>(section: Section, revision: number, items: AdminCatalog[Section]) =>
    request<{ entry: { revision: number; items: AdminCatalog[Section] } }>('/admin/catalog/' + section, 'PUT', { revision, items }),
  adminFinance: (signal?: AbortSignal) => request<{ entries: FinanceEntry[] }>('/admin/finance', 'GET', undefined, signal),
  createFinanceEntry: (payload: { type: 'income' | 'expense'; category: string; title: string; amount: number; entryDate: string }) =>
    request<{ entry: FinanceEntry }>('/admin/finance', 'POST', payload),
  deleteFinanceEntry: (id: string) => request<{ ok: true }>(`/admin/finance/${encodeURIComponent(id)}`, 'DELETE'),
  adminCrmTasks: (signal?: AbortSignal) => request<{ tasks: CrmTask[] }>('/admin/crm/tasks', 'GET', undefined, signal),
  createCrmTask: (payload: { title: string; customerName?: string; pnr?: string; dueDate: string; priority?: 'high' | 'normal' | 'low'; assignedTo?: string }) =>
    request<{ task: CrmTask }>('/admin/crm/tasks', 'POST', payload),
  updateCrmTask: (id: string, status: 'open' | 'done') =>
    request<{ task: CrmTask }>(`/admin/crm/tasks/${encodeURIComponent(id)}`, 'PATCH', { status }),
  deleteCrmTask: (id: string) => request<{ ok: true }>(`/admin/crm/tasks/${encodeURIComponent(id)}`, 'DELETE'),
  adminCrmQuotes: (signal?: AbortSignal) => request<{ quotes: CrmQuote[] }>('/admin/crm/quotes', 'GET', undefined, signal),
  createCrmQuote: (payload: {
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
    customerPhone?: string;
    paxCount?: number;
    type: CrmQuote['type'];
    title: string;
    details?: string;
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
  }) =>
    request<{ quote: CrmQuote }>('/admin/crm/quotes', 'POST', payload),
  updateCrmQuoteStatus: (id: string, status: CrmQuote['status']) =>
    request<{ quote: CrmQuote }>(`/admin/crm/quotes/${encodeURIComponent(id)}`, 'PATCH', { status }),
  convertCrmQuote: (id: string) =>
    request<{ quote: CrmQuote; booking: BookingRecord }>(`/admin/crm/quotes/${encodeURIComponent(id)}/convert`, 'POST'),
  deleteCrmQuote: (id: string) => request<{ ok: true }>(`/admin/crm/quotes/${encodeURIComponent(id)}`, 'DELETE'),
  adminAuditLogs: (signal?: AbortSignal) => request<{ logs: AuditLogEntry[] }>('/admin/audit', 'GET', undefined, signal),
  adminAnalytics: (params: { range?: string; from?: string; to?: string; activity?: boolean } = {}, signal?: AbortSignal) => {
    const qs = new URLSearchParams();
    if (params.range) qs.set('range', params.range);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.activity) qs.set('activity', '1');
    return request<{
      range: string;
      since: string;
      until: string;
      members: { totalUsers: number; activeOrganizations: number; loginsInPeriod: number };
      funnel: { pageViews: number; searches: number; selections: number; passengerForms: number; checkoutSubmits: number; bookingsCreated: number };
      sales: {
        demoCount: number;
        demoVolumeTRY: number;
        verifiedLiveCount: number;
        verifiedLiveVolumeTRY: number;
        refundedCount: number;
        refundedVolumeTRY: number;
        byProduct: { Uçak: number; Otel: number; Transfer: number; Tur: number };
      };
      health: {
        clientErrors: number;
        serverErrors: number;
        authFailures: number;
        rateLimited: number;
        suspiciousAlerts: Array<{ level: 'high' | 'medium'; code: string; reason: string; count: number }>;
      };
      dailyTrend: Array<{ date: string; visits: number; bookings: number; errors: number }>;
      activity?: {
        accounts: Array<{ id: string; event: 'user_login' | 'user_register'; occurredAt: number; method: string | null; device: string | null; email: string }>;
        journeys: Array<{ session: string; occurredAt: number; step: string; product: string }>;
      };
      integrations: {
        posthog: { configured: boolean; host: string; piiBlocked: boolean };
        cloudflare: { configured: boolean; trustProxy: boolean };
        sentry: { configured: boolean; piiScrubbed: boolean };
      };
    }>(`/admin/analytics${qs.toString() ? `?${qs.toString()}` : ''}`, 'GET', undefined, signal);
  },
  revokeUserSessions: (id: string) => request<{ ok: true }>(`/admin/users/${encodeURIComponent(id)}/revoke-sessions`, 'POST', {}),
  adminServerInfo: (signal?: AbortSignal) => request<{ outboundIp: string; host: string; protocol: string }>('/admin/server-info', 'GET', undefined, signal),
  testProviderConnection: (url: string) => request<{ ok: boolean; reachable?: boolean; authVerified?: boolean; liveTransactionVerified?: boolean; stage?: string; status: number; latencyMs: number; message: string }>('/admin/providers/test', 'POST', { url }),
  xmlShowcaseStatus: (signal?: AbortSignal) =>
    request<{
      status: {
        lastSyncAt: string;
        nextSyncAt: string;
        lastSyncMs: number;
        trigger: string;
        autoEnabled: boolean;
        intervalHours: number;
        mode: string;
        hotelsCount: number;
        toursCount: number;
        hotelCountries: string[];
        tourCountries: string[];
        providerLogs: Array<{ provider: string; ok: boolean; hotelsFound: number; toursFound: number; note?: string }>;
      };
      hotels: AdminCatalog['hotels'];
      tours: AdminCatalog['tours'];
    }>('/admin/xml-showcase/status', 'GET', undefined, signal),
  syncXmlShowcase: () =>
    request<{
      status: {
        lastSyncAt: string;
        nextSyncAt: string;
        lastSyncMs: number;
        trigger: string;
        autoEnabled: boolean;
        intervalHours: number;
        mode: string;
        hotelsCount: number;
        toursCount: number;
        hotelCountries: string[];
        tourCountries: string[];
        providerLogs: Array<{ provider: string; ok: boolean; hotelsFound: number; toursFound: number; note?: string }>;
      };
      hotels: AdminCatalog['hotels'];
      tours: AdminCatalog['tours'];
    }>('/admin/xml-showcase/sync', 'POST', {}),
};

export type BookingDraft = Pick<BookingRecord, 'type' | 'title' | 'subtitle' | 'date' | 'returnDate' | 'passenger' | 'passengersDetail' | 'legs' | 'contactEmail' | 'contactPhone' | 'providerSource' | 'netCostTRY' | 'profitTRY' | 'price' | 'departTime' | 'arriveTime' | 'flightNumber' | 'airline' | 'baggage' | 'cabin' | 'duration' | 'autoCheckin' | 'autoCheckinFeeTRY' | 'couponCode'> & {
  lookupSurname: string;
  isCharter?: boolean;
  idempotencyKey?: string;
  pricingContext?: Record<string, unknown>;
  expectedPrice?: number;
  enforceExpectedPrice?: boolean;
};
