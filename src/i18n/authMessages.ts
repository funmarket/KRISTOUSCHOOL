import type { Language } from '../types';

const usernameRule: Record<Language, string> = {
  en: 'Use 3–50 characters: letters, numbers, periods, underscores, or hyphens; start with a letter or number.',
  fr: 'Utilisez 3 à 50 caractères : lettres, chiffres, points, tirets bas ou tirets ; commencez par une lettre ou un chiffre.',
  ar: 'استخدم 3 إلى 50 حرفاً أو رقماً أو نقطة أو شرطة سفلية أو واصلة، وابدأ بحرف أو رقم.',
};

const usernameUnavailable: Record<Language, string> = {
  en: 'That username is unavailable or invalid. Choose another username using the format shown above.',
  fr: "Ce nom d'utilisateur est déjà utilisé ou invalide. Choisissez-en un autre selon le format indiqué ci-dessus.",
  ar: 'اسم المستخدم غير متاح أو غير صالح. اختر اسماً آخر وفق التنسيق الموضح أعلاه.',
};

export function usernameRuleMessage(language: Language): string {
  return usernameRule[language];
}

export function usernameUnavailableMessage(language: Language): string {
  return usernameUnavailable[language];
}
