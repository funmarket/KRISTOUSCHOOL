import type { Language } from '../types';

export const telegramLinkCopy: Record<Language, {
  title: string;
  instructions: string;
  open: string;
  expires: string;
  startFailed: string;
  complete: string;
  failed: string;
  close: string;
}> = {
  ar: {
    title: 'ربط حساب تيليجرام',
    instructions: 'افتح تطبيق KRISTOU في تيليجرام لتأكيد ربط هذا الحساب. تنتهي صلاحية الرابط خلال 10 دقائق.',
    open: 'فتح تطبيق KRISTOU في تيليجرام',
    expires: 'بعد التأكيد، ارجع إلى التطبيق وحدّث الصفحة.',
    startFailed: 'تعذر بدء ربط تيليجرام. سجّل الدخول وحاول مرة أخرى.',
    complete: 'تم ربط حساب تيليجرام. يمكنك العودة إلى التطبيق.',
    failed: 'تعذر تأكيد الربط. قد يكون الرابط منتهي الصلاحية أو مستخدماً بالفعل.',
    close: 'إغلاق',
  },
  fr: {
    title: 'Connecter Telegram',
    instructions: 'Ouvrez KRISTOU dans Telegram pour confirmer la liaison de ce compte. Le lien expire dans 10 minutes.',
    open: 'Ouvrir KRISTOU dans Telegram',
    expires: 'Après confirmation, revenez à l’application et actualisez la page.',
    startFailed: 'Impossible de lancer la liaison Telegram. Connectez-vous puis réessayez.',
    complete: 'Compte Telegram connecté. Vous pouvez revenir à l’application.',
    failed: 'La liaison n’a pas pu être confirmée. Le lien a peut-être expiré ou déjà été utilisé.',
    close: 'Fermer',
  },
  en: {
    title: 'Connect Telegram',
    instructions: 'Open KRISTOU in Telegram to confirm linking this account. The link expires in 10 minutes.',
    open: 'Open KRISTOU in Telegram',
    expires: 'After confirmation, return to the app and refresh the page.',
    startFailed: 'Could not start Telegram linking. Sign in and try again.',
    complete: 'Telegram account linked. You can return to the app.',
    failed: 'The link could not be confirmed. It may have expired or already been used.',
    close: 'Close',
  },
};

export function getTelegramLinkCopy(language: Language) {
  return telegramLinkCopy[language] ?? telegramLinkCopy.en;
}
