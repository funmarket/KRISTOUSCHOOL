import type { Language } from '../types.ts';
import { translations } from './translations.ts';

export type SignInErrorCode =
  | 'account_not_approved'
  | 'contact_not_confirmed'
  | 'invalid_credentials'
  | 'phone_sign_in_not_supported'
  | 'sign_in_failed';

export type SignUpErrorCode =
  | 'invalid_username_format'
  | 'username_unavailable_or_invalid'
  | 'username_only_unsupported'
  | 'username_required_for_phone_registration'
  | 'invalid_email_format'
  | 'invalid_phone_format'
  | 'missing_login_identifier'
  | 'signup_failed';

const usernameRule: Record<Language, string> = {
  en: 'Required when registering with a phone number without email; otherwise optional. Use 3–50 characters: letters (Arabic, French accents, or English), spaces, numbers, periods, underscores, or hyphens; do not enter an email or phone number here.',
  fr: 'Requis lors de l’inscription avec un numéro de téléphone sans e-mail ; sinon optionnel. Utilisez 3 à 50 caractères : lettres (arabes, françaises avec accents ou latines), espaces, chiffres, points, tirets bas ou tirets ; ne saisissez pas un e-mail ou un téléphone ici.',
  ar: 'مطلوب عند التسجيل برقم هاتف دون بريد إلكتروني، واختياري في الحالات الأخرى. استخدم من 3 إلى 50 حرفاً (بالعربية أو الفرنسية أو الإنجليزية) مع المسافات أو الأرقام أو النقاط أو الشرطات؛ لا تدخل بريداً إلكترونياً أو رقم هاتف في هذا الحقل.',
  es: 'Obligatorio al registrarse con número de teléfono sin correo electrónico; en los demás casos es opcional. Usa entre 3 y 50 caracteres: letras (árabes, latinas o acentuadas), espacios, números, puntos, guiones bajos o guiones; no introduzcas un correo o teléfono aquí.',
  de: 'Erforderlich bei Registrierung mit Telefonnummer ohne E-Mail; sonst optional. Verwenden Sie 3–50 Zeichen: Buchstaben (arabisch, lateinisch oder mit Akzenten), Leerzeichen, Ziffern, Punkte, Unterstriche oder Bindestriche; geben Sie hier keine E-Mail oder Telefonnummer ein.',
  pt: 'Obrigatório ao registar-se com número de telefone sem email; caso contrário, é opcional. Utilize 3 a 50 caracteres: letras (árabes, latinas ou com acentos), espaços, números, pontos, sublinhados ou hífenes; não introduza um email ou telefone aqui.',
};

const identifierChoiceGuidance: Record<Language, string> = {
  en: 'Provide an email address, a phone number, or both to create your account. If you provide an email address, the username is optional. If you register with a phone number without an email address, a username is required so you can sign in with it later.',
  fr: 'Indiquez une adresse e-mail, un numéro de téléphone, ou les deux. Si vous fournissez une adresse e-mail, le nom d’utilisateur est optionnel. Si vous vous inscrivez avec un numéro de téléphone sans e-mail, un nom d’utilisateur est requis pour vous connecter.',
  ar: 'أدخل بريداً إلكترونياً أو رقم هاتف (أو كليهما). إذا أدخلت بريداً إلكترونياً، فإن اسم المستخدم اختياري. أما عند التسجيل برقم الهاتف بدون بريد إلكتروني، فيصبح اسم المستخدم إجبارياً لتسجيل الدخول به لاحقاً.',
  es: 'Indica una dirección de correo electrónico, un número de teléfono o ambos para crear tu cuenta. Si proporcionas un correo electrónico, el nombre de usuario es opcional. Si te registras con un teléfono sin correo electrónico, se requiere un nombre de usuario para poder iniciar sesión más adelante.',
  de: 'Geben Sie eine E-Mail-Adresse, eine Telefonnummer oder beides an, um Ihr Konto zu erstellen. Wenn Sie eine E-Mail-Adresse angeben, ist der Benutzername optional. Bei einer Registrierung mit Telefonnummer ohne E-Mail ist ein Benutzername für die spätere Anmeldung erforderlich.',
  pt: 'Indique um endereço de email, um número de telefone ou ambos para criar a sua conta. Se fornecer um email, o nome de utilizador é opcional. Se se registar com um telefone sem email, é obrigatório um nome de utilizador para iniciar sessão mais tarde.',
};

const phoneRule: Record<Language, string> = {
  en: 'Enter an 8-digit Tunisian number (e.g., 20 123 456 for +216) or a full international number starting with + (e.g., +33 6 12 34 56 78).',
  fr: 'Saisissez un numéro tunisien à 8 chiffres (ex. 20 123 456 pour +216) ou un numéro international complet commençant par + (ex. +33 6 12 34 56 78).',
  ar: 'أدخل رقم هاتف تونسي مكوّن من 8 أرقام (مثال: 20 123 456 لرمز +216) أو رقماً دولياً كاملاً يبدأ بعلامة +.',
  es: 'Introduce un número tunecino de 8 dígitos (p. ej., 20 123 456 para +216) o un número internacional completo que comience con + (p. ej., +34 612 34 56 78).',
  de: 'Geben Sie eine 8-stellige tunesische Nummer (z. B. 20 123 456 für +216) oder eine vollständige internationale Nummer beginnend mit + ein (z. B. +49 170 1234567).',
  pt: 'Introduza um número tunisino de 8 dígitos (ex.: 20 123 456 para +216) ou um número internacional completo começando por + (ex.: +351 912 345 678).',
};

const usernameOnlyUnsupported: Record<Language, string> = {
  en: 'Username-only registration without an email address or phone number is not supported by the current authentication service. Please add an email address or a phone number along with your chosen username.',
  fr: 'La création de compte uniquement avec un nom d’utilisateur, sans adresse e-mail ni numéro de téléphone, n’est pas prise en charge actuellement. Veuillez ajouter une adresse e-mail ou un numéro de téléphone avec votre nom d’utilisateur.',
  ar: 'إنشاء حساب باسم مستخدم فقط دون بريد إلكتروني أو رقم هاتف غير مدعوم حالياً في خدمة المصادقة. يرجى إضافة بريد إلكتروني أو رقم هاتف مع اسم المستخدم المختار.',
  es: 'El registro solo con nombre de usuario, sin correo electrónico ni número de teléfono, no es compatible con el servicio de autenticación actual. Añade un correo electrónico o un teléfono junto con tu nombre de usuario.',
  de: 'Eine Registrierung nur mit Benutzernamen ohne E-Mail-Adresse oder Telefonnummer wird derzeit nicht unterstützt. Bitte fügen Sie Ihrem Benutzernamen eine E-Mail-Adresse oder Telefonnummer hinzu.',
  pt: 'O registo apenas com nome de utilizador, sem email nem número de telefone, não é suportado pelo serviço de autenticação atual. Adicione um email ou um telefone juntamente com o nome de utilizador escolhido.',
};

const phoneSignInNotSupported: Record<Language, string> = {
  en: 'Direct phone number sign-in is not supported in the public sign-in field. Please sign in using your username or email address.',
  fr: 'La connexion directe par numéro de téléphone n’est pas prise en charge dans le champ de connexion public. Veuillez vous connecter avec votre nom d’utilisateur ou votre adresse e-mail.',
  ar: 'تسجيل الدخول المباشر برقم الهاتف غير مدعوم في حقل تسجيل الدخول العام. يرجى تسجيل الدخول باستخدام اسم المستخدم أو البريد الإلكتروني.',
  es: 'El inicio de sesión directo con número de teléfono no está admitido en el campo público de acceso. Inicia sesión con tu nombre de usuario o correo electrónico.',
  de: 'Die direkte Anmeldung per Telefonnummer wird im öffentlichen Anmeldefeld nicht unterstützt. Bitte melden Sie sich mit Ihrem Benutzernamen oder Ihrer E-Mail-Adresse an.',
  pt: 'O início de sessão direto por número de telefone não é suportado no campo público de acesso. Inicie sessão com o seu nome de utilizador ou email.',
};

const usernameRequiredForPhoneRegistration: Record<Language, string> = {
  en: 'Registration with a phone number (without an email address) requires a valid chosen username so you can sign in subsequently.',
  fr: "L'inscription avec un numéro de téléphone (sans adresse e-mail) nécessite un nom d'utilisateur valide pour pouvoir vous connecter ultérieurement.",
  ar: 'التسجيل برقم الهاتف (بدون بريد إلكتروني) يتطلب اسم مستخدم مختاراً وصالحاً لتتمكن من تسجيل الدخول به لاحقاً.',
  es: 'El registro con un número de teléfono (sin correo electrónico) requiere un nombre de usuario válido para poder iniciar sesión posteriormente.',
  de: 'Für die Registrierung mit einer Telefonnummer (ohne E-Mail-Adresse) ist ein gültiger Benutzername erforderlich, damit Sie sich später anmelden können.',
  pt: 'O registo com número de telefone (sem email) requer um nome de utilizador válido para poder iniciar sessão posteriormente.',
};

const invalidEmailFormat: Record<Language, string> = {
  en: 'Please enter a valid email address (for example, name@example.com).',
  fr: 'Veuillez saisir une adresse e-mail valide (par exemple, nom@exemple.com).',
  ar: 'يرجى إدخال عنوان بريد إلكتروني صالح (مثال: name@example.com).',
  es: 'Por favor, introduce una dirección de correo electrónico válida (por ejemplo, nombre@ejemplo.com).',
  de: 'Bitte geben Sie eine gültige E-Mail-Adresse ein (z. B. name@beispiel.de).',
  pt: 'Por favor, introduza um endereço de email válido (por exemplo, nome@exemplo.com).',
};

const usernameUnavailable: Record<Language, string> = {
  en: 'That username is unavailable or invalid. Choose another username using the format shown above.',
  fr: "Ce nom d'utilisateur est déjà utilisé ou invalide. Choisissez-en un autre selon le format indiqué ci-dessus.",
  ar: 'اسم المستخدم غير متاح أو غير صالح. اختر اسماً آخر وفق التنسيق الموضح أعلاه.',
  es: 'Ese nombre de usuario no está disponible o no es válido. Elige otro nombre siguiendo el formato indicado arriba.',
  de: 'Dieser Benutzername ist nicht verfügbar oder ungültig. Wählen Sie einen anderen Benutzernamen im oben gezeigten Format.',
  pt: 'Esse nome de utilizador não está disponível ou é inválido. Escolha outro nome utilizando o formato indicado acima.',
};

const registrationReceivedPendingApproval: Record<Language, string> = {
  en: 'Your account registration has been received. Access to private school spaces requires approval from KRISTOU SCHOOL administration. You will be able to access your school workspace after your account is approved.',
  fr: 'Votre demande de création de compte a bien été reçue. L’accès aux espaces privés nécessite l’approbation de l’administration de KRISTOU SCHOOL. Vous pourrez accéder à votre espace scolaire une fois votre compte approuvé.',
  ar: 'تم استلام طلب إنشاء حسابك بنجاح. يتطلب الدخول إلى فضاءات المدرسة الخاصة موافقة إدارة مدرسة كريستو. ستتمكن من الدخول إلى فضائك المدرسي بعد الموافقة على حسابك.',
  es: 'Hemos recibido tu solicitud de registro. El acceso a los espacios privados requiere la aprobación de la administración de KRISTOU SCHOOL. Podrás acceder a tu espacio escolar cuando tu cuenta sea aprobada.',
  de: 'Ihre Kontoregistrierung ist eingegangen. Der Zugriff auf private Schulbereiche erfordert die Genehmigung der Verwaltung von KRISTOU SCHOOL. Nach der Freigabe können Sie auf Ihren Schulbereich zugreifen.',
  pt: 'O seu pedido de registo de conta foi recebido. O acesso aos espaços privados requer aprovação da administração da KRISTOU SCHOOL. Poderá aceder ao seu espaço escolar após a aprovação da conta.',
};

const registrationReceivedConfirmationAndApproval: Record<Language, string> = {
  en: 'Your account registration has been received. Please complete the email or phone verification required by the authentication provider. Access to private school spaces still requires approval from authorized KRISTOU SCHOOL personnel—confirming your contact method alone does not activate a school role.',
  fr: 'Votre demande de création de compte a bien été reçue. Veuillez compléter la vérification de votre adresse e-mail ou de votre numéro de téléphone auprès du service d’authentification. L’accès aux espaces privés reste soumis à l’approbation du personnel autorisé de KRISTOU SCHOOL : la confirmation de votre contact ne suffit pas à activer un rôle scolaire.',
  ar: 'تم استلام طلب إنشاء حسابك بنجاح. يرجى إتمام التحقق من البريد الإلكتروني أو رقم الهاتف عبر خدمة المصادقة، مع العلم أن الدخول إلى فضاءات المدرسة الخاصة يظل خاضعاً لموافقة الإدارة المخوّلة في مدرسة كريستو، ولا يؤدي تأكيد وسيلة الاتصال وحده إلى تفعيل الدور المدرسي.',
  es: 'Hemos recibido tu solicitud de registro. Completa la verificación de correo electrónico o teléfono solicitada por el proveedor de autenticación. El acceso a los espacios privados sigue requiriendo la aprobación del personal autorizado de KRISTOU SCHOOL: confirmar tu método de contacto no activa un rol escolar por sí solo.',
  de: 'Ihre Kontoregistrierung ist eingegangen. Bitte schließen Sie die erforderliche E-Mail- oder Telefonbestätigung beim Authentifizierungsdienst ab. Der Zugang zu privaten Schulbereichen erfordert weiterhin die Genehmigung durch autorisiertes Personal von KRISTOU SCHOOL – die Bestätigung des Kontakts allein aktiviert keine Schulrolle.',
  pt: 'O seu registo de conta foi recebido. Conclua a verificação de email ou telefone exigida pelo serviço de autenticação. O acesso aos espaços privados continua a exigir aprovação do pessoal autorizado da KRISTOU SCHOOL: a confirmação do contacto por si só não ativa uma função escolar.',
};

const secondaryPhoneVerificationNote: Record<Language, string> = {
  en: ' Note: Your account was created with your email address. You sign in using your username or email address; any additional phone verification remains separate.',
  fr: ' Remarque : Votre compte a été créé avec votre adresse e-mail. Vous vous connectez avec votre nom d’utilisateur ou votre adresse e-mail ; toute vérification de téléphone additionnelle reste distincte.',
  ar: ' ملاحظة: تم إنشاء حسابك باستخدام بريدك الإلكتروني. يمكنك تسجيل الدخول باستخدام اسم المستخدم أو البريد الإلكتروني؛ وأي تحقق إضافي من رقم الهاتف يبقى منفصلاً.',
  es: ' Nota: Tu cuenta se creó con tu correo electrónico. Inicias sesión con tu nombre de usuario o correo electrónico; cualquier verificación telefónica adicional se mantiene aparte.',
  de: ' Hinweis: Ihr Konto wurde mit Ihrer E-Mail-Adresse erstellt. Sie melden sich mit Ihrem Benutzernamen oder Ihrer E-Mail-Adresse an; eine zusätzliche Telefonbestätigung bleibt davon getrennt.',
  pt: ' Nota: A sua conta foi criada com o seu endereço de email. Inicia sessão com o nome de utilizador ou email; qualquer verificação telefónica adicional permanece separada.',
};

const accountNotApproved: Record<Language, string> = {
  en: 'Your credentials were accepted, but this account does not currently have access to private school workspaces. It may still be awaiting administrative approval. Please contact the school administration if you need assistance.',
  fr: 'Vos identifiants ont été acceptés, mais ce compte n’a actuellement pas accès aux espaces privés de l’école. Il est peut-être encore en attente d’approbation administrative. Veuillez contacter l’administration de l’école si vous avez besoin d’aide.',
  ar: 'تم قبول بيانات الدخول الخاصة بك، ولكن هذا الحساب لا يملك حالياً صلاحية الوصول إلى فضاءات المدرسة الخاصة. قد يكون الحساب لا يزال قيد انتظار الموافقة الإدارية. يرجى التواصل مع إدارة المدرسة إذا كنت بحاجة إلى مساعدة.',
  es: 'Tus credenciales son válidas, pero esta cuenta no tiene acceso actualmente a los espacios privados de la escuela. Es posible que aún esté pendiente de aprobación administrativa. Contacta con la administración escolar si necesitas ayuda.',
  de: 'Ihre Zugangsdaten wurden akzeptiert, aber dieses Konto hat derzeit keinen Zugriff auf private Schulbereiche. Es wartet möglicherweise noch auf die administrative Freigabe. Wenden Sie sich bei Bedarf an die Schulverwaltung.',
  pt: 'As suas credenciais foram aceites, mas esta conta não tem atualmente acesso aos espaços privados da escola. Pode ainda aguardar aprovação administrativa. Contacte a administração escolar se precisar de ajuda.',
};

const contactNotConfirmed: Record<Language, string> = {
  en: 'Please verify your email address or phone number through the authentication provider before signing in. Access to private school spaces also requires approval from KRISTOU SCHOOL administration.',
  fr: 'Veuillez vérifier votre adresse e-mail ou votre numéro de téléphone auprès du service d’authentification avant de vous connecter. L’accès aux espaces privés nécessite également l’approbation de l’administration de KRISTOU SCHOOL.',
  ar: 'يرجى التحقق من البريد الإلكتروني أو رقم الهاتف عبر خدمة المصادقة قبل تسجيل الدخول. يتطلب الدخول إلى فضاءات المدرسة الخاصة أيضاً موافقة إدارة مدرسة كريستو.',
  es: 'Verifica tu dirección de correo electrónico o número de teléfono a través del proveedor de autenticación antes de iniciar sesión. El acceso a los espacios privados también requiere la aprobación de la administración de KRISTOU SCHOOL.',
  de: 'Bitte bestätigen Sie vor der Anmeldung Ihre E-Mail-Adresse oder Telefonnummer über den Authentifizierungsdienst. Der Zugriff auf private Schulbereiche erfordert außerdem die Genehmigung der Verwaltung von KRISTOU SCHOOL.',
  pt: 'Verifique o seu endereço de email ou número de telefone através do serviço de autenticação antes de iniciar sessão. O acesso aos espaços privados também requer aprovação da administração da KRISTOU SCHOOL.',
};

const signInFailed: Record<Language, string> = {
  en: 'Unable to sign in right now. Please check your connection or try again later.',
  fr: 'Impossible de vous connecter pour le moment. Veuillez vérifier votre connexion ou réessayer plus tard.',
  ar: 'تعذر تسجيل الدخول في الوقت الحالي. يرجى التحقق من اتصالك والمحاولة لاحقاً.',
  es: 'No es posible iniciar sesión en este momento. Comprueba tu conexión o inténtalo más tarde.',
  de: 'Anmeldung derzeit nicht möglich. Bitte prüfen Sie Ihre Verbindung oder versuchen Sie es später erneut.',
  pt: 'Não é possível iniciar sessão neste momento. Verifique a sua ligação ou tente novamente mais tarde.',
};

const signupFailed: Record<Language, string> = {
  en: 'Unable to complete account registration. Please check your information and try again.',
  fr: 'Impossible de finaliser la demande de création de compte. Veuillez vérifier vos informations et réessayer.',
  ar: 'تعذر إتمام طلب إنشاء الحساب. يرجى التحقق من البيانات والمحاولة مرة أخرى.',
  es: 'No se pudo completar el registro de la cuenta. Revisa tus datos e inténtalo de nuevo.',
  de: 'Die Kontoregistrierung konnte nicht abgeschlossen werden. Bitte prüfen Sie Ihre Angaben und versuchen Sie es erneut.',
  pt: 'Não foi possível concluir o registo da conta. Verifique os seus dados e tente novamente.',
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

export function phoneSignInNotSupportedMessage(language: Language): string {
  return phoneSignInNotSupported[language] ?? phoneSignInNotSupported.en;
}

export function usernameRequiredForPhoneRegistrationMessage(language: Language): string {
  return usernameRequiredForPhoneRegistration[language] ?? usernameRequiredForPhoneRegistration.en;
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
    if (error === 'phone_sign_in_not_supported') {
      return 'phone_sign_in_not_supported';
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

    if (rawCode === 'phone_sign_in_not_supported' || rawMessage === 'phone_sign_in_not_supported') {
      return 'phone_sign_in_not_supported';
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
  if (code === 'username_required_for_phone_registration') {
    return 'username_required_for_phone_registration';
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
  if (code === 'phone_sign_in_not_supported') {
    return phoneSignInNotSupportedMessage(language);
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
  if (code === 'username_required_for_phone_registration') {
    return usernameRequiredForPhoneRegistrationMessage(language);
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



