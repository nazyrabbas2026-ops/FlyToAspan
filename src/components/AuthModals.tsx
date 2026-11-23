import React, { useState } from 'react';
import { X, Briefcase, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { LangCode, UserProfile } from '../types';

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
    rememberMe: string;
    forgotPass: string;
    corpLoginBtn: string;
    loginBtn: string;
    demoTitle: string;
    demoIndBtn: string;
    demoCorpBtn: string;
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
    sslBadge: string;
    createAccBtn: string;
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
    rememberMe: 'Beni Hatırla',
    forgotPass: 'Şifremi Unuttum?',
    corpLoginBtn: 'Kurumsal Panele Gir',
    loginBtn: 'Giriş Yap',
    demoTitle: 'Hızlı Demo Panel İnceleme (Tek Tıkla Giriş)',
    demoIndBtn: 'Bireysel Paneli Gör',
    demoCorpBtn: 'Kurumsal Paneli Gör',
    noAccount: 'Henüz hesabınız yok mu?',
    registerLink: 'Kayıt Ol',
    corpRegTitle: 'Kurumsal Hesap Oluştur',
    regTitle: 'Üye Ol · 2.500 Mil Kazan',
    companyPh: 'Şirket / Firma Ünvanı *',
    firstNamePh: 'Adı *',
    lastNamePh: 'Soyadı *',
    phonePh: 'Telefon (+90 5xx xxx xx xx) *',
    emailPh: 'E-Posta *',
    passMinPh: 'Şifre (En az 6 karakter) *',
    termsText: 'Kullanım Koşulları ve KVKK Aydınlatma Metni’ni okudum, onaylıyorum.',
    sslBadge: 'Bilgileriniz 256-Bit SSL ve KVKK güvencesiyle korunur.',
    createAccBtn: 'Hesabı Oluştur ve Panele Git',
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
    rememberMe: 'Remember Me',
    forgotPass: 'Forgot Password?',
    corpLoginBtn: 'Enter Corporate Portal',
    loginBtn: 'Sign In',
    demoTitle: 'Instant Demo Dashboard Access (1-Click)',
    demoIndBtn: 'View Individual Panel',
    demoCorpBtn: 'View Corporate Panel',
    noAccount: 'Don’t have an account yet?',
    registerLink: 'Sign Up',
    corpRegTitle: 'Create Corporate Account',
    regTitle: 'Sign Up · Earn 2,500 Miles',
    companyPh: 'Company / Legal Entity Name *',
    firstNamePh: 'First Name *',
    lastNamePh: 'Last Name *',
    phonePh: 'Phone (+90 5xx xxx xx xx) *',
    emailPh: 'E-Mail *',
    passMinPh: 'Password (Min 6 characters) *',
    termsText: 'I have read and agree to the Terms of Use and Privacy Notice.',
    sslBadge: 'Your data is protected by 256-Bit SSL and GDPR/KVKK security.',
    createAccBtn: 'Create Account & Open Dashboard',
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
    rememberMe: 'Запомнить меня',
    forgotPass: 'Забыли пароль?',
    corpLoginBtn: 'Войти в бизнес-портал',
    loginBtn: 'Войти',
    demoTitle: 'Быстрый демо-доступ в панель (в 1 клик)',
    demoIndBtn: 'Личный кабинет',
    demoCorpBtn: 'Корпоративный кабинет',
    noAccount: 'Ещё нет аккаунта?',
    registerLink: 'Регистрация',
    corpRegTitle: 'Создать корпоративный аккаунт',
    regTitle: 'Регистрация · +2 500 миль',
    companyPh: 'Название компании / организации *',
    firstNamePh: 'Имя *',
    lastNamePh: 'Фамилия *',
    phonePh: 'Телефон (+90 5xx xxx xx xx) *',
    emailPh: 'Эл. почта *',
    passMinPh: 'Пароль (мин. 6 символов) *',
    termsText: 'Я принимаю Условия использования и Политику конфиденциальности.',
    sslBadge: 'Данные защищены 256-битным SSL и стандартами KVKK/GDPR.',
    createAccBtn: 'Создать аккаунт и перейти в панель',
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
    rememberMe: 'Мені есте сақтау',
    forgotPass: 'Құпиясөзді ұмыттыңыз ба?',
    corpLoginBtn: 'Корпоративтік панельге кіру',
    loginBtn: 'Кіру',
    demoTitle: 'Жылдам демо-панельді көру (1 шертумен)',
    demoIndBtn: 'Жеке панельді көру',
    demoCorpBtn: 'Корпоративтік панель',
    noAccount: 'Әлі тіркелмедіңіз бе?',
    registerLink: 'Тіркелу',
    corpRegTitle: 'Корпоративтік аккаунт ашу',
    regTitle: 'Тіркелу · 2 500 миль сыйлық',
    companyPh: 'Компания / Мекеме атауы *',
    firstNamePh: 'Аты *',
    lastNamePh: 'Тегі *',
    phonePh: 'Телефон (+90 5xx xxx xx xx) *',
    emailPh: 'Эл. пошта *',
    passMinPh: 'Құпиясөз (кемінде 6 таңба) *',
    termsText: 'Пайдалану шарттары мен Құпиялылық саясатын оқыдым және келісемін.',
    sslBadge: 'Деректеріңіз 256-Бит SSL және KVKK стандартымен қорғалған.',
    createAccBtn: 'Аккаунт ашу және панельге өту',
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
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [corpInquirySent, setCorpInquirySent] = useState(false);

  if (!mode) return null;

  const passwordStrength =
    password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;

  const loginAsDemo = (type: 'individual' | 'corporate') => {
    const demoUser: UserProfile = {
      id: type === 'corporate' ? 'usr-corp-1' : 'usr-ind-1',
      firstName: type === 'corporate' ? 'Alperen' : 'Mert',
      lastName: type === 'corporate' ? 'Kaya' : 'Yılmaz',
      email: type === 'corporate' ? 'kurumsal@flytoaspan.com' : 'uye@flytoaspan.com',
      phone: '+90 531 460 61 75',
      accountType: type,
      companyName: type === 'corporate' ? 'Infinitive Travel Holding A.Ş.' : undefined,
      miles: type === 'corporate' ? 48500 : 12450,
      twoFactorEnabled: true,
      createdAt: '2026-11-22',
    };
    onAuthSuccess(demoUser);
    onClose();
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nameGuess = email.split('@')[0] || 'Üye';
    const user: UserProfile = {
      id: `usr-${Date.now()}`,
      firstName: nameGuess.charAt(0).toUpperCase() + nameGuess.slice(1),
      lastName: 'FlyToAspan',
      email,
      phone: '+90 531 460 61 75',
      accountType,
      companyName: accountType === 'corporate' ? companyName || 'Kurumsal Hesap' : undefined,
      miles: 6500,
      twoFactorEnabled: true,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    onAuthSuccess(user);
    onClose();
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user: UserProfile = {
      id: `usr-${Date.now()}`,
      firstName: firstName.trim() || 'Değerli',
      lastName: lastName.trim() || 'Üye',
      email,
      phone: phone || '+90 531 460 61 75',
      accountType,
      companyName: accountType === 'corporate' ? companyName.trim() || 'Şirket Hesabı' : undefined,
      miles: 2500, // Welcome bonus miles
      twoFactorEnabled: false,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    onAuthSuccess(user);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        setCorpInquirySent(false);
        onClose();
      }}
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
            onClick={() => {
              setCorpInquirySent(false);
              onClose();
            }}
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

        {corpInquirySent ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <CheckCircle2 size={50} color="#10B981" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 8px' }}>Kurumsal Başvurunuz Alındı</h3>
            <p style={{ fontSize: 13.5, color: 'var(--aspan-text-body)' }}>
              Ekibimiz en kısa sürede sizinle iletişime geçecektir.
            </p>
          </div>
        ) : mode === 'login' ? (
          <>
            <form onSubmit={handleLoginSubmit}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" defaultChecked /> {ui.rememberMe}
                  </label>
                  <span style={{ color: 'var(--aspan-teal-deep)', fontWeight: 700, cursor: 'pointer' }}>
                    {ui.forgotPass}
                  </span>
                </div>
                <button type="submit" className="uf-pop-done" style={{ height: 46 }}>
                  {accountType === 'corporate' ? ui.corpLoginBtn : ui.loginBtn}
                </button>
              </div>
            </form>

            {/* Instant Demo Panel Access */}
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 14,
                background: 'var(--aspan-sky-soft)',
                border: '1px solid var(--aspan-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: 'var(--aspan-teal-deep)', marginBottom: 8 }}>
                <Sparkles size={14} />
                {ui.demoTitle}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className="uf-quick-pill"
                  style={{ background: '#ffffff', textAlign: 'center' }}
                  onClick={() => loginAsDemo('individual')}
                >
                  {ui.demoIndBtn}
                </button>
                <button
                  type="button"
                  className="uf-quick-pill"
                  style={{ background: '#ffffff', textAlign: 'center' }}
                  onClick={() => loginAsDemo('corporate')}
                >
                  {ui.demoCorpBtn}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
              {ui.noAccount}{' '}
              <button
                type="button"
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
          <form onSubmit={handleRegisterSubmit}>
            <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800 }}>
              {accountType === 'corporate' ? ui.corpRegTitle : ui.regTitle}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {accountType === 'corporate' && (
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
              <div>
                <input
                  id="auth-reg-password"
                  name="password"
                  autoComplete="new-password"
                  required
                  type="password"
                  minLength={6}
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

              <label style={{ fontSize: 12, display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                <input type="checkbox" required style={{ marginTop: 3 }} />
                {ui.termsText}
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#047857', fontWeight: 600 }}>
                <ShieldCheck size={15} />
                {ui.sslBadge}
              </div>

              <button type="submit" className="uf-pop-done" style={{ height: 46 }}>
                {ui.createAccBtn}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
              {ui.haveAccount}{' '}
              <button
                type="button"
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
