import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Lock, User as UserIcon, Mail, Phone, Shield, Badge } from 'lucide-react';
import type { RegistrationRole } from '../lib/auth';
import {
  classifySignInError,
  classifySignUpError,
  identifierChoiceGuidanceMessage,
  phoneRuleMessage,
  registrationResultMessage,
  resolveSignInErrorMessage,
  resolveSignUpErrorMessage,
  usernameRuleMessage,
  type SignInErrorCode,
  type SignUpErrorCode,
} from '../i18n/authMessages';

const inputClass = 'w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 ps-10 pe-4 text-sm dark:border-gray-800 dark:bg-gray-900 dark:text-white';

type ModalErrorState =
  | { kind: 'validation_required' }
  | { kind: 'signin'; code: SignInErrorCode }
  | { kind: 'signup'; code: SignUpErrorCode };

const optionalBadgeLabel = {
  ar: 'اختياري',
  fr: 'optionnel',
  en: 'optional',
} as const;

const loginIdentifierHint = {
  ar: 'سجّل الدخول باستخدام اسم المستخدم أو البريد الإلكتروني أو رقم الهاتف (+216 أو 8 أرقام).',
  fr: 'Connectez-vous avec votre nom d’utilisateur, votre adresse e-mail ou votre numéro de téléphone (+216 ou 8 chiffres).',
  en: 'Sign in using your username, email address, or phone number (+216 or 8-digit local number).',
} as const;

export const AuthModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { login, signup, t, dir, language } = useApp();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [staffId, setStaffId] = useState('');
  const [admissionId, setAdmissionId] = useState('');
  const [password, setPassword] = useState('');
  const [requestedRole, setRequestedRole] = useState<RegistrationRole>('PARENT');
  const [errorState, setErrorState] = useState<ModalErrorState | null>(null);
  const [signupNotice, setSignupNotice] = useState<{
    confirmationRequired: boolean;
    secondaryPhoneVerificationRequired?: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const isStudent = requestedRole === 'STUDENT';
  const isParent = requestedRole === 'PARENT';
  const isEmployee = requestedRole === 'SCHOOL_STAFF' || requestedRole === 'ADMINISTRATIVE_PERSONNEL';
  const isStaffLike = requestedRole === 'TEACHER' || isEmployee;

  const error = errorState
    ? errorState.kind === 'validation_required'
      ? t('requiredUsername')
      : errorState.kind === 'signin'
      ? resolveSignInErrorMessage(language, errorState.code)
      : resolveSignUpErrorMessage(language, errorState.code)
    : '';

  const message = signupNotice
    ? registrationResultMessage(language, {
        confirmationRequired: signupNotice.confirmationRequired,
        secondaryPhoneVerificationRequired: signupNotice.secondaryPhoneVerificationRequired,
      })
    : '';

  const isNotApprovedNotice =
    errorState?.kind === 'signin' &&
    (errorState.code === 'account_not_approved' ||
      errorState.code === 'contact_not_confirmed');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorState(null);
    setSignupNotice(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        if (!identifier.trim() || !password) {
          setErrorState({ kind: 'validation_required' });
          return;
        }
        const result = await login(identifier.trim(), password);
        if (!result.success) {
          const code = result.errorCode ?? classifySignInError(result.error);
          setErrorState({ kind: 'signin', code });
          return;
        }
        onClose();
        return;
      }

      const missingRoleSpecificId = (isStaffLike && !staffId.trim()) || (isStudent && !admissionId.trim());
      if (!fullName.trim() || !password || missingRoleSpecificId) {
        setErrorState({ kind: 'validation_required' });
        return;
      }

      const result = await signup({
        username: username.trim() || undefined,
        fullName,
        password,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        requestedRole,
        staffId: isStaffLike ? staffId : undefined,
        admissionId: isStudent ? admissionId : undefined,
      });
      if (!result.success) {
        const code = result.errorCode ?? classifySignUpError(result.error);
        setErrorState({ kind: 'signup', code });
        return;
      }
      setSignupNotice({
        confirmationRequired: Boolean(result.confirmationRequired),
        secondaryPhoneVerificationRequired: Boolean(result.secondaryPhoneVerificationRequired),
      });
      setMode('login');
      setIdentifier(email.trim() || phone.trim() || username.trim());
      setPassword('');
    } finally { setBusy(false); }
  };

  const roleLabel = (role: RegistrationRole) => ({
    APP_ADMIN: t('roleAdmin'),
    MANAGER: t('roleManager'),
    PARENT: t('roleParent'),
    TEACHER: t('roleTeacher'),
    SCHOOL_STAFF: t('roleSchoolStaff'),
    ADMINISTRATIVE_PERSONNEL: t('roleAdministrativePersonnel'),
    STUDENT: t('roleStudent'),
  }[role]);

  const optLabel = optionalBadgeLabel[language] ?? optionalBadgeLabel.en;

  return (
    <div className="fixed inset-0 z-[60] min-h-[100dvh] overflow-y-auto bg-black/60 p-4 backdrop-blur-xs sm:p-6" role="presentation" dir={dir} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex min-h-[calc(100dvh-2rem)] items-center justify-center py-[max(0.5rem,env(safe-area-inset-top))] sm:min-h-[calc(100dvh-3rem)]">
        <div role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-[#111111] sm:p-6">
          <button onClick={onClose} aria-label={t('close')} className="absolute end-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="h-5 w-5" /></button>
          <div className="mb-5 px-8 text-center">
            <img src="/assets/kristou-logo.png" alt={t('school')} className="mx-auto mb-3 h-14 w-14 rounded-2xl border border-gray-200 bg-white object-contain p-1 shadow-md dark:border-gray-700 dark:bg-gray-800" />
            <h2 id="auth-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">{mode === 'login' ? t('login') : t('register')}</h2>
            <p className="mt-1 text-xs text-gray-500">{t('school')}</p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900">
            <button type="button" onClick={() => { setMode('login'); setErrorState(null); }} className={`rounded-lg py-2 text-xs font-bold ${mode === 'login' ? 'bg-white text-k-brand shadow-sm dark:bg-gray-800' : 'text-gray-500'}`}>{t('login')}</button>
            <button type="button" onClick={() => { setMode('signup'); setErrorState(null); setSignupNotice(null); }} className={`rounded-lg py-2 text-xs font-bold ${mode === 'signup' ? 'bg-white text-k-brand shadow-sm dark:bg-gray-800' : 'text-gray-500'}`}>{t('register')}</button>
          </div>

          {error && (
            <div
              role="alert"
              data-testid="auth-modal-error"
              data-error-code={
                errorState?.kind === 'signin'
                  ? errorState.code
                  : errorState?.kind === 'signup'
                  ? errorState.code
                  : 'validation_required'
              }
              className={
                isNotApprovedNotice
                  ? 'mb-4 break-words rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-medium leading-relaxed text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200'
                  : 'mb-4 break-words rounded-xl bg-red-50 p-3 text-xs font-medium leading-relaxed text-red-600 dark:bg-red-950/40 dark:text-red-300'
              }
            >
              {error}
            </div>
          )}
          {message && (
            <div
              role="status"
              data-testid="auth-modal-message"
              data-confirmation-required={signupNotice ? String(signupNotice.confirmationRequired) : undefined}
              className="mb-4 break-words rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium leading-relaxed text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
            >
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && <>
              {/* Role is deliberately the first registration decision. */}
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">{t('roleSwitch')}
                <div className="relative mt-1"><Shield className="absolute start-3 top-3 h-4 w-4 text-gray-400" /><select required value={requestedRole} onChange={e => setRequestedRole(e.target.value as RegistrationRole)} className={`${inputClass} appearance-none`} aria-label={t('roleSwitch')}>
                  <option value="PARENT">{roleLabel('PARENT')}</option>
                  <option value="TEACHER">{roleLabel('TEACHER')}</option>
                  <option value="SCHOOL_STAFF">{roleLabel('SCHOOL_STAFF')}</option>
                  <option value="ADMINISTRATIVE_PERSONNEL">{roleLabel('ADMINISTRATIVE_PERSONNEL')}</option>
                  <option value="STUDENT">{roleLabel('STUDENT')}</option>
                  <option value="MANAGER">{roleLabel('MANAGER')}</option>
                  <option value="APP_ADMIN">{roleLabel('APP_ADMIN')}</option>
                </select></div>
              </label>

              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">{isParent ? t('parentName') : isStudent ? t('studentFullName') : t('fullName')}
                <div className="relative mt-1"><UserIcon className="absolute start-3 top-3 h-4 w-4 text-gray-400" /><input required value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" className={inputClass} /></div>
              </label>

              {isStaffLike && <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">{t('staffId')}
                <div className="relative mt-1"><Badge className="absolute start-3 top-3 h-4 w-4 text-gray-400" /><input required value={staffId} onChange={e => setStaffId(e.target.value)} className={inputClass} /></div>
              </label>}
              {isStudent && <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">{t('admissionId')}
                <div className="relative mt-1"><Badge className="absolute start-3 top-3 h-4 w-4 text-gray-400" /><input required value={admissionId} onChange={e => setAdmissionId(e.target.value)} className={inputClass} /></div>
              </label>}

              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                {identifierChoiceGuidanceMessage(language)}
              </div>

              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                <span>{t('username')} <span className="font-normal text-gray-400">({optLabel})</span></span>
                <div className="relative mt-1"><UserIcon className="absolute start-3 top-3 h-4 w-4 text-gray-400" /><input maxLength={50} title={usernameRuleMessage(language)} placeholder="Mohamed Ben Ali · فاطمة الزهراء · Élodie" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" className={inputClass} /></div>
                <p className="mt-1 font-normal text-gray-500">{usernameRuleMessage(language)}</p>
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  <span>{isStaffLike ? t('schoolEmail') : 'Email'} <span className="font-normal text-gray-400">({optLabel})</span></span>
                  <div className="relative mt-1"><Mail className="absolute start-3 top-3 h-4 w-4 text-gray-400" /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nom@exemple.com" className={inputClass} /></div>
                </label>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  <span>{t('phone')} (+216) <span className="font-normal text-gray-400">({optLabel})</span></span>
                  <div className="relative mt-1"><Phone className="absolute start-3 top-3 h-4 w-4 text-gray-400" /><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="20 123 456 / +216..." className={inputClass} /></div>
                </label>
              </div>
              <p className="text-[11px] font-normal text-gray-500">{phoneRuleMessage(language)}</p>
            </>}

            {mode === 'login' && <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">{t('username')} / Email / {t('phone')}
              <div className="relative mt-1"><UserIcon className="absolute start-3 top-3 h-4 w-4 text-gray-400" /><input required value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Mohamed Ben Ali / email@example.com / 20 123 456" autoComplete="username" className={inputClass} /></div>
              <p className="mt-1 font-normal text-gray-500">{loginIdentifierHint[language] ?? loginIdentifierHint.en}</p>
            </label>}
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">{t('password')}
              <div className="relative mt-1"><Lock className="absolute start-3 top-3 h-4 w-4 text-gray-400" /><input required type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={inputClass} /></div>
            </label>
            <button disabled={busy} type="submit" className="w-full rounded-xl bg-k-brand py-3 text-sm font-semibold text-white shadow-lg shadow-k-brand/25 transition-all hover:bg-k-brand-strong disabled:opacity-50">{busy ? t('loading') : mode === 'login' ? t('login') : t('register')}</button>
          </form>

        </div>
      </div>
    </div>
  );
};

