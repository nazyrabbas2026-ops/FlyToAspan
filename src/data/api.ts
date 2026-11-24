import type {
  AdminMarkupConfig,
  BookingRecord,
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
  constructor(public readonly status: number, message: string) {
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
  if (!response.ok) throw new ApiError(response.status, data.message ?? 'İşlem tamamlanamadı.');
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

export type BookingLookup = Pick<BookingRecord, 'pnr' | 'title' | 'date' | 'returnDate' | 'type' | 'status' | 'demo'>;

export interface AdminCatalog {
  rules: { id: string; carrier: string; route: string; rule: string }[];
  coupons: { id: string; code: string; title: string; category: string; validUntil: string; active: boolean }[];
  agencies: { id: string; name: string; type: string; contact: string; creditLimitTRY: number; miles: number; status: string }[];
  hotels: { id: string; city: string; name: string; stars: number; boardType: string; nights: number; price: number; active: boolean }[];
  transfers: { id: string; city: string; vehicle: string; route: string; capacity: string; baggage: string; price: number; active: boolean }[];
  tours: { id: string; city: string; title: string; duration: string; quota: number; price: number; active: boolean }[];
}

export type AdminCatalogState = {
  [Section in keyof AdminCatalog]?: { revision: number; items: AdminCatalog[Section] };
};

export const api = {
  session: (signal?: AbortSignal) => request<{ user: UserProfile | null }>('/session', 'GET', undefined, signal),
  register: (details: Registration) =>
    request<{ user: UserProfile | null; pending?: boolean; message?: string }>('/auth/register', 'POST', details),
  login: (email: string, password: string) => request<{ user: UserProfile }>('/auth/login', 'POST', { email, password }),
  logout: () => request<{ ok: true }>('/auth/logout', 'POST'),
  bookings: (admin: boolean, signal?: AbortSignal) => request<{ bookings: BookingRecord[] }>(
    admin ? '/admin/bookings' : '/bookings', 'GET', undefined, signal
  ),
  createBooking: (record: BookingDraft, admin = false) => request<{ booking: BookingRecord }>(
    admin ? '/admin/bookings' : '/bookings', 'POST', record
  ),
  lookup: (pnr: string, surname: string, signal?: AbortSignal) => request<{ booking: BookingLookup }>(
    '/bookings/lookup', 'POST', { pnr, surname }, signal
  ),
  cancel: (id: string) => request<{ booking: BookingRecord }>(`/bookings/${encodeURIComponent(id)}/cancel`, 'POST'),
  setStatus: (id: string, status: BookingRecord['status']) => request<{ booking: BookingRecord }>(
    `/admin/bookings/${encodeURIComponent(id)}`, 'PATCH', { status }
  ),
  deleteBooking: (id: string) => request<{ ok: true }>(`/admin/bookings/${encodeURIComponent(id)}`, 'DELETE'),
  pricing: (signal?: AbortSignal) => request<{ markup: AdminMarkupConfig | null }>('/pricing', 'GET', undefined, signal),
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
};

export type BookingDraft = Pick<BookingRecord, 'type' | 'title' | 'subtitle' | 'date' | 'returnDate' | 'passenger' | 'price'> & {
  lookupSurname: string;
  idempotencyKey?: string;
};
