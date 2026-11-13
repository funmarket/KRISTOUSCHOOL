import type { Language } from '../types.ts';
import { translations } from './translations.ts';

export type SignInErrorCode =
  | 'account_not_approved'
  | 'contact_not_confirmed'
  | 'invalid_credentials'
  | 'sign_in_failed';

export type SignUpErrorCode =
  | 'invalid_username_format'
  | 'username_unavailable_or_invalid'
  | 'username_only_unsupported'
  | 'invalid_email_format'
  | 'invalid_phone_format'
  | 'missing_login_identifier'
  | 'signup_failed';

const usernameRule: Record<Language, string> = {
  en: 'Optional. Use 3–50 characters: letters (Arabic, French accents, or English), spaces, numbers, periods, underscores, or hyphens; do not enter an email or phone number here.',
  fr: 'Optionnel. Utilisez 3 à 50 caractères : lettres (arabes, françaises avec accents ou latines), espaces, chiffres, points, tirets bas ou tirets ; ne saisissez pas un e-mail ou un téléphone ici.',
  ar: 'اختياري. استخدم من 3 إلى 50 حرفاً (بالعربية أو الفرنسية أو الإنجليزية) مع المسافات أو الأرقام أو النقاط أو الشرطات؛ لا تدخل بريداً إلكترونياً أو رقم هاتف في هذا الحقل.',
};

const identifierChoiceGuidance: Record<Language, string> = {
  en: 'Provide an email address, a phone number, or both to create your account. You may also add an optional username (such as your name in Arabic or French) to sign in with later. Username-only registration without an email or phone number is not currently available.',
  fr: 'Indiquez une adresse e-mail, un numéro de téléphone, ou les deux pour créer votre compte. Vous pouvez aussi ajouter un nom d’utilisateur optionnel (en arabe ou en français, avec espaces) pour vous connecter. L’inscription uniquement par nom d’utilisateur sans e-mail ni téléphone n’est pas encore disponible.',
  ar: 'أدخل بريداً إلكترونياً أو رقم هاتف (أو كليهما) لإنشاء حسابك، ويمكنك أيضاً إضافة اسم مستخدم اختياري (بالعربية أو الفرنسية مع المسافات) لتسجيل الدخول به. التسجيل باسم مستخدم فقط دون بريد إلكتروني أو رقم هاتف غير متاح حالياً.',
};

const phoneRule: Record<Language, string> = {
  en: 'Enter an 8-digit Tunisian number (e.g., 20 123 456 for +216) or a full international number starting with + (e.g., +33 6 12 34 56 78).',
  fr: 'Saisissez un numéro tunisien à 8 chiffres (ex. 20 123 456 pour +216) ou un numéro international complet commençant par + (ex. +33 6 12 34 56 78).',
  ar: 'أدخل رقم هاتف تونسي مكوّن من 8 أرقام (مثال: 20 123 456 لرمز +216) أو رقماً دولياً كاملاً يبدأ بعلامة +.',
};

const usernameOnlyUnsupported: Record<Language, string> = {
  en: 'Username-only registration without an email address or phone number is not supported by the current authentication service. Please add an email address or a phone number along with your chosen username.',
  fr: 'La création de compte uniquement avec un nom d’utilisateur, sans adresse e-mail ni numéro de téléphone, n’est pas prise en charge actuellement. Veuillez ajouter une adresse e-mail ou un numéro de téléphone avec votre nom d’utilisateur.',
  ar: 'إنشاء حساب باسم مستخدم فقط دون بريد إلكتروني أو رقم هاتف غير مدعوم حالياً في خدمة المصادقة. يرجى إضافة بريد إلكتروني أو رقم هاتف مع اسم المستخدم المختار.',
};

const invalidEmailFormat: Record<Language, string> = {
  en: 'Please enter a valid email address (for example, name@example.com).',
  fr: 'Veuillez saisir une adresse e-mail valide (par exemple, nom@exemple.com).',
  ar: 'يرجى إدخال عنوان بريد إلكتروني صالح (مثال: name@example.com).',
};

const usernameUnavailable: Record<Language, string> = {
  en: 'That username is unavailable or invalid. Choose another username using the format shown above.',
  fr: "Ce nom d'utilisateur est déjà utilisé ou invalide. Choisissez-en un autre selon le format indiqué ci-dessus.",
  ar: 'اسم المستخدم غير متاح أو غير صالح. اختر اسماً آخر وفق التنسيق الموضح أعلاه.',
};

const registrationReceivedPendingApproval: Record<Language, string> = {
  en: 'Your account registration has been received. Access to private school spaces requires approval from KRISTOU SCHOOL administration. You will be able to access your school workspace after your account is approved.',
  fr: 'Votre demande de création de compte a bien été reçue. L’accès aux espaces privés nécessite l’approbation de l’administration de KRISTOU SCHOOL. Vous pourrez accéder à votre espace scolaire une fois votre compte approuvé.',
  ar: 'تم استلام طلب إنشاء حسابك بنجاح. يتطلب الدخول إلى فضاءات المدرسة الخاصة موافقة إدارة مدرسة كريستو. ستتمكن من الدخول إلى فضائك المدرسي بعد الموافقة على حسابك.',
};

const registrationReceivedConfirmationAndApproval: Record<Language, string> = {
  en: 'Your account registration has been received. Please complete the email or phone verification required by the authentication provider. Access to private school spaces still requires approval from authorized KRISTOU SCHOOL personnel—confirming your contact method alone does not activate a school role.',
  fr: 'Votre demande de création de compte a bien été reçue. Veuillez compléter la vérification de votre adresse e-mail ou de votre numéro de téléphone auprès du service d’authentification. L’accès aux espaces privés reste soumis à l’approbation du personnel autorisé de KRISTOU SCHOOL : la confirmation de votre contact ne suffit pas à activer un rôle scolaire.',
  ar: 'تم استلام طلب إنشاء حسابك بنجاح. يرجى إتمام التحقق من البريد الإلكتروني أو رقم الهاتف عبر خدمة المصادقة، مع العلم أن الدخول إلى فضاءات المدرسة الخاصة يظل خاضعاً لموافقة الإدارة المخوّلة في مدرسة كريستو، ولا يؤدي تأكيد وسيلة الاتصال وحده إلى تفعيل الدور المدرسي.',
};

const secondaryPhoneVerificationNote: Record<Language, string> = {
  en: ' Note: Your account was created with your email address; phone number sign-in requires separate phone verification before the phone number can be used as a login method.',
  fr: ' Remarque : Votre compte a été créé avec votre adresse e-mail ; la connexion par numéro de téléphone nécessite une vérification séparée du numéro avant de pouvoir l’utiliser pour vous connecter.',
  ar: ' ملاحظة: تم إنشاء حسابك باستخدام بريدك الإلكتروني؛ ويتطلب تسجيل الدخول برقم الهاتف إتمام التحقق المستقل من رقم الهاتف أولاً قبل استخدامه كوسيلة دخول.',
};

const accountNotApproved: Record<Language, string> = {
  en: 'Your credentials were accepted, but this account does not currently have access to private school workspaces. It may still be awaiting administrative approval. Please contact the school administration if you need assistance.',
  fr: 'Vos identifiants ont été acceptés, mais ce compte n’a actuellement pas accès aux espaces privés de l’école. Il est peut-être encore en attente d’approbation administrative. Veuillez contacter l’administration de l’école si vous avez besoin d’aide.',
  ar: 'تم قبول بيانات الدخول الخاصة بك، ولكن هذا الحساب لا يملك حالياً صلاحية الوصول إلى فضاءات المدرسة الخاصة. قد يكون الحساب لا يزال قيد انتظار الموافقة الإدارية. يرجى التواصل مع إدارة المدرسة إذا كنت بحاجة إلى مساعدة.',
};

const contactNotConfirmed: Record<Language, string> = {
  en: 'Please verify your email address or phone number through the authentication provider before signing in. Access to private school spaces also requires approval from KRISTOU SCHOOL administration.',
  fr: 'Veuillez vérifier votre adresse e-mail ou votre numéro de téléphone auprès du service d’authentification avant de vous connecter. L’accès aux espaces privés nécessite également l’approbation de l’administration de KRISTOU SCHOOL.',
  ar: 'يرجى التحقق من البريد الإلكتروني أو رقم الهاتف عبر خدمة المصادقة قبل تسجيل الدخول. يتطلب الدخول إلى فضاءات المدرسة الخاصة أيضاً موافقة إدارة مدرسة كريستو.',
};

const signInFailed: Record<Language, string> = {
  en: 'Unable to sign in right now. Please check your connection or try again later.',
  fr: 'Impossible de vous connecter pour le moment. Veuillez vérifier votre connexion ou réessayer plus tard.',
  ar: 'تعذر تسجيل الدخول في الوقت الحالي. يرجى التحقق من اتصالك والمحاولة لاحقاً.',
};

const signupFailed: Record<Language, string> = {
  en: 'Unable to complete account registration. Please check your information and try again.',
  fr: 'Impossible de finaliser la demande de création de compte. Veuillez vérifier vos informations et réessayer.',
  ar: 'تعذر إتمام طلب إنشاء الحساب. يرجى التحقق من البيانات والمحاولة مرة أخرى.',
};

export function usernameRuleMessage(language: Language): string {
  return usernameRule[language] ?? usernameRule.en;
}

export function identifierChoiceGuidanceMessage(language: Language): string {
  return identifierChoiceGuidance[language] ?? identifierChoiceGuidance.en;
}

export function phoneRuleMessage(language: Language): string {
  return phoneRule[language] ?? phoneRule.en;
}

export function usernameOnlyUnsupportedMessage(language: Language): string {
  return usernameOnlyUnsupported[language] ?? usernameOnlyUnsupported.en;
}

export function usernameUnavailableMessage(language: Language): string {
  return usernameUnavailable[language] ?? usernameUnavailable.en;
}

export function registrationResultMessage(
  language: Language,
  options?: { confirmationRequired?: boolean; secondaryPhoneVerificationRequired?: boolean },
): string {
  const base = options?.confirmationRequired
    ? registrationReceivedConfirmationAndApproval[language] ??
      registrationReceivedConfirmationAndApproval.en
    : registrationReceivedPendingApproval[language] ??
      registrationReceivedPendingApproval.en;

  if (options?.secondaryPhoneVerificationRequired) {
    return `${base}${secondaryPhoneVerificationNote[language] ?? secondaryPhoneVerificationNote.en}`;
  }
  return base;
}

export function accountNotApprovedMessage(language: Language): string {
  return accountNotApproved[language] ?? accountNotApproved.en;
}

export function contactNotConfirmedMessage(language: Language): string {
  return contactNotConfirmed[language] ?? contactNotConfirmed.en;
}

export function signInFailedMessage(language: Language): string {
  return signInFailed[language] ?? signInFailed.en;
}

export function signupFailedMessage(language: Language): string {
  return signupFailed[language] ?? signupFailed.en;
}

export function classifySignInError(error: unknown): SignInErrorCode {
  if (typeof error === 'string') {
    if (error === 'account_not_approved') {
      return 'account_not_approved';
    }
    if (
      error === 'contact_not_confirmed' ||
      error === 'email_not_confirmed' ||
      error === 'phone_not_confirmed'
    ) {
      return 'contact_not_confirmed';
    }
    if (
      error === 'invalid_credentials' ||
      error === 'invalid_grant' ||
      error === 'Invalid credentials' ||
      error === 'Invalid login credentials'
    ) {
      return 'invalid_credentials';
    }
    return 'sign_in_failed';
  }

  if (error && typeof error === 'object') {
    const rawCode =
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : '';
    const rawMessage =
      typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : '';

    if (rawCode === 'account_not_approved' || rawMessage === 'account_not_approved') {
      return 'account_not_approved';
    }

    if (
      rawCode === 'email_not_confirmed' ||
      rawCode === 'phone_not_confirmed' ||
      rawCode === 'contact_not_confirmed'
    ) {
      return 'contact_not_confirmed';
    }

    if (rawCode === 'invalid_credentials' || rawCode === 'invalid_grant') {
      return 'invalid_credentials';
    }

    if (
      error instanceof Error &&
      (rawMessage === 'Invalid credentials' ||
        rawMessage === 'Invalid login credentials' ||
        rawMessage === 'invalid_credentials')
    ) {
      return 'invalid_credentials';
    }
  }

  return 'sign_in_failed';
}

export function classifySignUpError(error: unknown): SignUpErrorCode {
  const code =
    typeof error === 'string'
      ? error
      : error instanceof Error
      ? error.message
      : '';
  if (code === 'invalid_username_format') {
    return 'invalid_username_format';
  }
  if (code === 'username_unavailable_or_invalid') {
    return 'username_unavailable_or_invalid';
  }
  if (
    code === 'username_only_requires_contact_or_backend_auth' ||
    code === 'username_only_unsupported'
  ) {
    return 'username_only_unsupported';
  }
  if (code === 'invalid_email_format') {
    return 'invalid_email_format';
  }
  if (code === 'invalid_phone_format') {
    return 'invalid_phone_format';
  }
  if (code === 'missing_login_identifier') {
    return 'missing_login_identifier';
  }
  return 'signup_failed';
}

export function resolveSignInErrorMessage(
  language: Language,
  errorOrCode: unknown,
): string {
  const code = classifySignInError(errorOrCode);
  if (code === 'account_not_approved') {
    return accountNotApprovedMessage(language);
  }
  if (code === 'contact_not_confirmed') {
    return contactNotConfirmedMessage(language);
  }
  if (code === 'invalid_credentials') {
    const dict = translations[language] ?? translations.en;
    return dict.invalidCredentials;
  }
  return signInFailedMessage(language);
}

export function resolveSignUpErrorMessage(
  language: Language,
  errorOrCode: unknown,
): string {
  const code = classifySignUpError(errorOrCode);
  if (code === 'invalid_username_format') {
    return usernameRuleMessage(language);
  }
  if (code === 'username_unavailable_or_invalid') {
    return usernameUnavailableMessage(language);
  }
  if (code === 'username_only_unsupported') {
    return usernameOnlyUnsupportedMessage(language);
  }
  if (code === 'invalid_email_format') {
    return invalidEmailFormat[language] ?? invalidEmailFormat.en;
  }
  if (code === 'invalid_phone_format') {
    return phoneRuleMessage(language);
  }
  if (code === 'missing_login_identifier') {
    return identifierChoiceGuidanceMessage(language);
  }
  return signupFailedMessage(language);
}



