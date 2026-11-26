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
  es: {
    title: 'Conectar Telegram',
    instructions: 'Abre KRISTOU en Telegram para confirmar la vinculación de esta cuenta. El enlace caduca en 10 minutos.',
    open: 'Abrir KRISTOU en Telegram',
    expires: 'Después de confirmar, vuelve a la aplicación y actualiza la página.',
    startFailed: 'No se pudo iniciar la vinculación con Telegram. Inicia sesión e inténtalo de nuevo.',
    complete: 'Cuenta de Telegram vinculada. Puedes volver a la aplicación.',
    failed: 'No se pudo confirmar la vinculación. Es posible que haya caducado o ya se haya utilizado.',
    close: 'Cerrar',
  },
  de: {
    title: 'Telegram verbinden',
    instructions: 'Öffnen Sie KRISTOU in Telegram, um die Verknüpfung dieses Kontos zu bestätigen. Der Link läuft in 10 Minuten ab.',
    open: 'KRISTOU in Telegram öffnen',
    expires: 'Kehren Sie nach der Bestätigung zur App zurück und laden Sie die Seite neu.',
    startFailed: 'Telegram-Verknüpfung konnte nicht gestartet werden. Melden Sie sich an und versuchen Sie es erneut.',
    complete: 'Telegram-Konto verknüpft. Sie können zur App zurückkehren.',
    failed: 'Die Verknüpfung konnte nicht bestätigt werden. Der Link ist möglicherweise abgelaufen oder bereits verwendet worden.',
    close: 'Schließen',
  },
  pt: {
    title: 'Ligar Telegram',
    instructions: 'Abra a KRISTOU no Telegram para confirmar a associação desta conta. A ligação expira em 10 minutos.',
    open: 'Abrir KRISTOU no Telegram',
    expires: 'Após confirmar, regresse à aplicação e atualize a página.',
    startFailed: 'Não foi possível iniciar a ligação ao Telegram. Inicie sessão e tente novamente.',
    complete: 'Conta Telegram associada. Pode voltar à aplicação.',
    failed: 'Não foi possível confirmar a associação. A ligação pode ter expirado ou já ter sido utilizada.',
    close: 'Fechar',
  },
};

export function getTelegramLinkCopy(language: Language) {
  return telegramLinkCopy[language] ?? telegramLinkCopy.en;
}
