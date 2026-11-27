import React, { useState } from 'react';
import { X, Briefcase, CheckCircle2, ShieldCheck } from 'lucide-react';
import { LangCode, UserProfile } from '../types';
import { api, apiMessage } from '../data/api';

interface AuthModalsProps {
  lang?: LangCode;
  mode: 'login' | 'register' | null;
  onClose: () => void;
  onSwitchMode: (mode: 'login' | 'register') => void;
  onAuthSuccess: (user: UserProfile) => void;
}

const AUTH_I18N: Record<
  LangCode,
  {
    close: string;
    individualTab: string;
    corporateTab: string;
    corpLoginTitle: string;
    loginTitle: string;
    emailLbl: string;
    passwordLbl: string;
    passwordPh: string;
    corpLoginBtn: string;
    loginBtn: string;
    noAccount: string;
    registerLink: string;
    corpRegTitle: string;
    regTitle: string;
    companyPh: string;
    firstNamePh: string;
    lastNamePh: string;
    phonePh: string;
    emailPh: string;
    passMinPh: string;
    termsText: string;
    createAccBtn: string;
    corpRegBtn: string;
    corpRegInfo: string;
    pendingDoneTitle: string;
    pendingDoneClose: string;
    haveAccount: string;
  }
> = {
  TR: {
    close: 'Kapat',
    individualTab: 'Bireysel Üye',
    corporateTab: 'Kurumsal Portal',
    corpLoginTitle: 'Kurumsal Panel Girişi',
    loginTitle: 'Giriş Yap',
    emailLbl: 'E-Posta Adresi',
    passwordLbl: 'Şifre',
    passwordPh: 'Şifrenizi girin',
    corpLoginBtn: 'Kurumsal Panele Gir',
    loginBtn: 'Giriş Yap',
    noAccount: 'Henüz hesabınız yok mu?',
    registerLink: 'Kayıt Ol',
    corpRegTitle: 'Kurumsal / Ekip Başvurusu',
    regTitle: 'Üye Ol · 2.500 Mil Kazan',
    companyPh: 'Şirket / Firma Ünvanı *',
    firstNamePh: 'Adı *',
    lastNamePh: 'Soyadı *',
    phonePh: 'Telefon (+90 5xx xxx xx xx) *',
    emailPh: 'E-Posta *',
    passMinPh: 'Şifre (En az 12 karakter) *',
    termsText: 'Kullanım Koşulları ve KVKK Aydınlatma Metni’ni okudum, onaylıyorum.',
    createAccBtn: 'Hesabı Oluştur ve Panele Git',
    corpRegBtn: 'Kurumsal Başvuru Gönder',
    corpRegInfo: 'Şifre belirlemenize gerek yoktur. Başvurunuz FlyToAspan yönetici paneline düşecek; onay sonrası yetkileriniz ve giriş şifreniz tanımlanıp size iletilecektir.',
    pendingDoneTitle: 'Kurumsal Başvurunuz Alındı!',
    pendingDoneClose: 'Tamam, Kapat',
    haveAccount: 'Zaten üye misiniz?',
  },
  EN: {
    close: 'Close',
    individualTab: 'Individual Member',
    corporateTab: 'Corporate Portal',
    corpLoginTitle: 'Corporate Portal Sign In',
    loginTitle: 'Sign In',
    emailLbl: 'E-Mail Address',
    passwordLbl: 'Password',
    passwordPh: 'Enter your password',
    corpLoginBtn: 'Enter Corporate Portal',
    loginBtn: 'Sign In',
    noAccount: 'Don’t have an account yet?',
    registerLink: 'Sign Up',
    corpRegTitle: 'Corporate / Team Application',
    regTitle: 'Sign Up · Earn 2,500 Miles',
    companyPh: 'Company / Legal Entity Name *',
    firstNamePh: 'First Name *',
    lastNamePh: 'Last Name *',
    phonePh: 'Phone (+90 5xx xxx xx xx) *',
    emailPh: 'E-Mail *',
    passMinPh: 'Password (Min 12 characters) *',
    termsText: 'I have read and agree to the Terms of Use and Privacy Notice.',
    createAccBtn: 'Create Account & Open Dashboard',
    corpRegBtn: 'Submit Corporate Application',
    corpRegInfo: 'No password needed now. Your application will be reviewed in the FlyToAspan Admin panel; once approved, your permissions and login password will be set and shared with you.',
    pendingDoneTitle: 'Corporate Application Received!',
    pendingDoneClose: 'Done, Close',
    haveAccount: 'Already a member?',
  },
  RU: {
    close: 'Закрыть',
    individualTab: 'Частный клиент',
    corporateTab: 'Корпоративный портал',
    corpLoginTitle: 'Вход в корпоративный портал',
    loginTitle: 'Войти',
    emailLbl: 'Электронная почта',
    passwordLbl: 'Пароль',
    passwordPh: 'Введите пароль',
    corpLoginBtn: 'Войти в бизнес-портал',
    loginBtn: 'Войти',
    noAccount: 'Ещё нет аккаунта?',
    registerLink: 'Регистрация',
    corpRegTitle: 'Корпоративная заявка / Команда',
    regTitle: 'Регистрация · +2 500 миль',
    companyPh: 'Название компании / организации *',
    firstNamePh: 'Имя *',
    lastNamePh: 'Фамилия *',
    phonePh: 'Телефон (+90 5xx xxx xx xx) *',
    emailPh: 'Эл. почта *',
    passMinPh: 'Пароль (мин. 12 символов) *',
    termsText: 'Я принимаю Условия использования и Политику конфиденциальности.',
    createAccBtn: 'Создать аккаунт и перейти в панель',
    corpRegBtn: 'Отправить корпоративную заявку',
    corpRegInfo: 'Пароль сейчас не требуется. Заявка поступит администратору FlyToAspan; после одобрения вам назначат права и пароль для входа.',
    pendingDoneTitle: 'Заявка успешно отправлена!',
    pendingDoneClose: 'Закрыть',
    haveAccount: 'Уже зарегистрированы?',
  },
  KK: {
    close: 'Жабу',
    individualTab: 'Жеке мүше',
    corporateTab: 'Корпоративтік портал',
    corpLoginTitle: 'Корпоративтік панельге кіру',
    loginTitle: 'Кіру',
    emailLbl: 'Электрондық пошта',
    passwordLbl: 'Құпиясөз',
    passwordPh: 'Құпиясөзді енгізіңіз',
    corpLoginBtn: 'Корпоративтік панельге кіру',
    loginBtn: 'Кіру',
    noAccount: 'Әлі тіркелмедіңіз бе?',
    registerLink: 'Тіркелу',
    corpRegTitle: 'Корпоративтік өтінім / Команда',
    regTitle: 'Тіркелу · 2 500 миль сыйлық',
    companyPh: 'Компания / Мекеме атауы *',
    firstNamePh: 'Аты *',
    lastNamePh: 'Тегі *',
    phonePh: 'Телефон (+90 5xx xxx xx xx) *',
    emailPh: 'Эл. пошта *',
    passMinPh: 'Құпиясөз (кемінде 12 таңба) *',
    termsText: 'Пайдалану шарттары мен Құпиялылық саясатын оқыдым және келісемін.',
    createAccBtn: 'Аккаунт ашу және панельге өту',
    corpRegBtn: 'Корпоративтік өтінім жіберу',
    corpRegInfo: 'Қазір құпиясөз енгізу қажет емес. Өтініміңіз FlyToAspan әкімшісіне түседі; расталған соң рұқсаттар мен кіру құпиясөзі беріледі.',
    pendingDoneTitle: 'Корпоративтік өтінім қабылданды!',
    pendingDoneClose: 'Жабу',
    haveAccount: 'Аккаунтыңыз бар ма?',
  },
};

export const AuthModals: React.FC<AuthModalsProps> = ({
  lang = 'TR',
  mode,
  onClose,
  onSwitchMode,
  onAuthSuccess,
}) => {
  const ui = AUTH_I18N[lang];
  const [accountType, setAccountType] = useState<'individual' | 'corporate'>('individual');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [applicantType, setApplicantType] = useState<'agency' | 'corporate' | 'sales'>('agency');
  const [taxId, setTaxId] = useState('');
  const [requestedModules, setRequestedModules] = useState<string[]>(['flights', 'hotels', 'tours']);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [pendingSuccess, setPendingSuccess] = useState('');

  if (!mode) return null;

  const passwordStrength = password.length === 0 ? 0 : password.length < 12 ? 1 : password.length < 16 ? 2 : 3;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
      if (mode === 'login') {
        const { user } = await api.login(email, password);
        onAuthSuccess(user);
        setPassword('');
        onClose();
      } else {
        const res = await api.register({
          firstName,
          lastName,
          companyName,
          applicantType: accountType === 'corporate' ? applicantType : undefined,
          taxId: accountType === 'corporate' && taxId.trim() ? taxId.trim() : undefined,
          requestedModules: accountType === 'corporate' ? requestedModules : undefined,
          phone,
          email,
          password: accountType === 'corporate' ? undefined : password,
          accountType,
        });
        if (res.pending || !res.user) {
          setPendingSuccess(res.message || ui.corpRegInfo);
          setPassword('');
        } else {
          onAuthSuccess(res.user);
          setPassword('');
          onClose();
        }
      }
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={() => { if (!pending) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <img src="/images/logo-light.png" alt="FlyToAspan" style={{ height: 34, width: 'auto' }} />
          <button
            type="button"
            className="drawer-close"
            onClick={() => { if (!pending) onClose(); }}
            aria-label={ui.close}
          >
            <X size={18} />
          </button>
        </div>

        {/* Account Type Switcher: Bireysel vs Kurumsal Portal */}
        <div className="uf-cabin-toggle" style={{ marginTop: 0, marginBottom: 16 }}>
          <button
            type="button"
            className={`uf-cabin-btn ${accountType === 'individual' ? 'active' : ''}`}
            onClick={() => setAccountType('individual')}
          >
            {ui.individualTab}
          </button>
          <button
            type="button"
            className={`uf-cabin-btn ${accountType === 'corporate' ? 'active' : ''}`}
            onClick={() => setAccountType('corporate')}
          >
            <Briefcase size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            {ui.corporateTab}
          </button>
        </div>

        {error && <p className="form-action-error" role="alert">{error}</p>}
        {pendingSuccess ? (
          <div style={{ textAlign: 'center', padding: '14px 6px 6px' }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.14)',
                color: '#059669',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <CheckCircle2 size={28} />
            </div>
            <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: 'var(--aspan-text)' }}>
              {ui.pendingDoneTitle}
            </h2>
            <p style={{ margin: '0 0 18px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--aspan-text-muted)' }}>
              {pendingSuccess}
            </p>
            <button
              type="button"
              className="uf-pop-done"
              style={{ height: 44, width: '100%' }}
              onClick={() => {
                setPendingSuccess('');
                onClose();
              }}
            >
              {ui.pendingDoneClose}
            </button>
          </div>
        ) : mode === 'login' ? (
          <>
            <form onSubmit={handleSubmit}>
              <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800 }}>
                {accountType === 'corporate' ? ui.corpLoginTitle : ui.loginTitle}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <div>
                  <label
                    htmlFor="auth-login-email"
                    style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}
                  >
                    {ui.emailLbl}
                  </label>
                  <input
                    id="auth-login-email"
                    name="email"
                    autoComplete="email"
                    required
                    type="email"
                    className="modal-input"
                    placeholder="ornek@flytoaspan.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="auth-login-password"
                    style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}
                  >
                    {ui.passwordLbl}
                  </label>
                  <input
                    id="auth-login-password"
                    name="password"
                    autoComplete="current-password"
                    required
                    type="password"
                    className="modal-input"
                    placeholder={ui.passwordPh}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button type="submit" disabled={pending} className="uf-pop-done" style={{ height: 46 }}>
                  {accountType === 'corporate' ? ui.corpLoginBtn : ui.loginBtn}
                </button>
              </div>
            </form>

            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
              {ui.noAccount}{' '}
              <button
                type="button"
                disabled={pending}
                onClick={() => onSwitchMode('register')}
                style={{
                  border: 'none',
                  background: 'none',
                  color: 'var(--aspan-teal-deep)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {ui.registerLink}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800 }}>
              {accountType === 'corporate' ? ui.corpRegTitle : ui.regTitle}
            </h2>
            {accountType === 'corporate' && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 6,
                  marginBottom: 12,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <div style={{ padding: '7px 8px', borderRadius: 10, background: '#10B981', color: '#fff', textAlign: 'center' }}>
                  1. Başvuru
                </div>
                <div style={{ padding: '7px 8px', borderRadius: 10, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)', color: 'var(--aspan-text-muted)', textAlign: 'center' }}>
                  2. Yönetici Onayı
                </div>
                <div style={{ padding: '7px 8px', borderRadius: 10, background: 'var(--aspan-bg-soft)', border: '1px solid var(--aspan-border)', color: 'var(--aspan-text-muted)', textAlign: 'center' }}>
                  3. Şifre &amp; Panel
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {accountType === 'corporate' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {(
                      [
                        { id: 'agency', label: 'B2B Alt Acente' },
                        { id: 'corporate', label: 'Kurumsal Şirket' },
                        { id: 'sales', label: 'Satış Temsilcisi' },
                      ] as const
                    ).map((opt) => {
                      const active = applicantType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setApplicantType(opt.id)}
                          style={{
                            padding: '8px 6px',
                            borderRadius: 10,
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: active ? '1.5px solid #10B981' : '1px solid var(--aspan-border)',
                            background: active ? 'rgba(16, 185, 129, 0.12)' : 'var(--aspan-bg-soft)',
                            color: active ? '#047857' : 'var(--aspan-text)',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 8 }}>
                    <input
                      id="auth-reg-company"
                      name="companyName"
                      autoComplete="organization"
                      required
                      className="modal-input"
                      placeholder={ui.companyPh}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                    <input
                      id="auth-reg-taxid"
                      name="taxId"
                      className="modal-input"
                      placeholder="BIN / Vergi No"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                    />
                  </div>
                </>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input
                  id="auth-reg-firstname"
                  name="firstName"
                  autoComplete="given-name"
                  required
                  className="modal-input"
                  placeholder={ui.firstNamePh}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <input
                  id="auth-reg-lastname"
                  name="lastName"
                  autoComplete="family-name"
                  required
                  className="modal-input"
                  placeholder={ui.lastNamePh}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <input
                id="auth-reg-phone"
                name="phone"
                autoComplete="tel"
                required
                className="modal-input"
                placeholder={ui.phonePh}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <input
                id="auth-reg-email"
                name="email"
                autoComplete="email"
                required
                type="email"
                className="modal-input"
                placeholder={ui.emailPh}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {accountType === 'corporate' ? (
                <>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--aspan-text-muted)', marginBottom: 6 }}>
                      Talep Edilen Satış Modülleri
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(
                        [
                          { id: 'flights', label: 'Uçak Bileti' },
                          { id: 'hotels', label: 'Otel' },
                          { id: 'tours', label: 'Paket Turlar' },
                        ] as const
                      ).map((mod) => {
                        const selected = requestedModules.includes(mod.id);
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() =>
                              setRequestedModules((prev) =>
                                selected ? prev.filter((m) => m !== mod.id) : [...prev, mod.id]
                              )
                            }
                            style={{
                              padding: '5px 11px',
                              borderRadius: 999,
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: selected ? '1px solid #10B981' : '1px solid var(--aspan-border)',
                              background: selected ? 'rgba(16, 185, 129, 0.14)' : 'var(--aspan-bg-soft)',
                              color: selected ? '#047857' : 'var(--aspan-text-muted)',
                            }}
                          >
                            {selected ? '✓ ' : '+ '}{mod.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      fontSize: 12,
                      lineHeight: 1.45,
                      color: 'var(--aspan-text)',
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                    }}
                  >
                    <ShieldCheck size={16} color="#10B981" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{ui.corpRegInfo}</span>
                  </div>
                </>
              ) : (
                <div>
                  <input
                    id="auth-reg-password"
                    name="password"
                    autoComplete="new-password"
                    required
                    type="password"
                    minLength={12}
                    className="modal-input"
                    placeholder={ui.passMinPh}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {password.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                      {[1, 2, 3].map((lvl) => (
                        <div
                          key={lvl}
                          style={{
                            flex: 1,
                            height: 4,
                            borderRadius: 4,
                            background:
                              passwordStrength >= lvl
                                ? lvl === 1
                                  ? '#e11d48'
                                  : lvl === 2
                                    ? '#e0aa36'
                                    : '#10b981'
                                : '#e2e8f0',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label style={{ fontSize: 12, display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                <input type="checkbox" required style={{ marginTop: 3 }} />
                {ui.termsText}
              </label>

              <button type="submit" disabled={pending} className="uf-pop-done" style={{ height: 46 }}>
                {accountType === 'corporate' ? ui.corpRegBtn : ui.createAccBtn}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
              {ui.haveAccount}{' '}
              <button
                type="button"
                disabled={pending}
                onClick={() => onSwitchMode('login')}
                style={{
                  border: 'none',
                  background: 'none',
                  color: 'var(--aspan-teal-deep)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {ui.loginBtn}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
