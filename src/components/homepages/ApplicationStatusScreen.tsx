import React from 'react';
import { useApp } from '../../context/AppContext';
import { HomePageHeader } from './shared/HomePageHeader';
import { HOMEPAGE_BADGE_LABELS, pickText } from '../../i18n/homepages';

export interface ApplicationStatusScreenProps {
  onOpenPublicSite: () => void;
}

export const ApplicationStatusScreen: React.FC<ApplicationStatusScreenProps> = ({
  onOpenPublicSite,
}) => {
  const { language, currentUser, logout } = useApp();

  const status = currentUser?.accountStatus ?? 'PENDING';
  const requestedRole = currentUser?.requestedRole ?? currentUser?.role ?? 'PARENT';

  const statusCopy = {
    PENDING: {
      title: {
        ar: 'طلب حسابك قيد المراجعة الإدارية',
        fr: 'Votre demande de compte est en cours d’examen',
        en: 'Your account application is pending review',
        es: 'Tu solicitud de cuenta está pendiente de revisión',
        de: 'Ihr Kontoantrag wird derzeit geprüft',
        pt: 'O seu pedido de conta está em análise',
      },
      body: {
        ar: 'تم استلام طلب إنشاء حسابك بنجاح. يتطلب الدخول إلى فضاءات المدرسة الخاصة موافقة إدارة مدرسة كريستو. ستتمكن من الدخول إلى فضائك المدرسي بعد الموافقة على حسابك.',
        fr: 'Votre demande de création de compte a bien été reçue. L’accès aux espaces privés nécessite l’approbation de l’administration de KRISTOU SCHOOL. Vous pourrez accéder à votre espace scolaire une fois votre compte approuvé.',
        en: 'Your account registration has been received. Access to private school spaces requires approval from KRISTOU SCHOOL administration. You will be able to access your school workspace after your account is approved.',
        es: 'Hemos recibido tu solicitud de registro. El acceso a los espacios privados requiere la aprobación de la administración de KRISTOU SCHOOL. Podrás acceder a tu espacio escolar cuando tu cuenta sea aprobada.',
        de: 'Ihre Kontoregistrierung ist eingegangen. Der Zugriff auf private Schulbereiche erfordert die Genehmigung der Verwaltung von KRISTOU SCHOOL. Nach der Freigabe können Sie auf Ihren Schulbereich zugreifen.',
        pt: 'O seu pedido de registo foi recebido. O acesso aos espaços privados requer aprovação da administração da KRISTOU SCHOOL. Poderá aceder ao seu espaço escolar após a aprovação da conta.',
      },
      chip: {
        ar: 'قيد الانتظار (PENDING)',
        fr: 'En attente (PENDING)',
        en: 'Pending Approval (PENDING)',
        es: 'Pendiente de aprobación (PENDING)',
        de: 'Freigabe ausstehend (PENDING)',
        pt: 'A aguardar aprovação (PENDING)',
      },
    },
    REJECTED: {
      title: {
        ar: 'تعذر قبول طلب الحساب',
        fr: 'Demande de compte non retenue',
        en: 'Account application was not approved',
        es: 'Solicitud de cuenta no aprobada',
        de: 'Kontoantrag wurde nicht genehmigt',
        pt: 'Pedido de conta não aprovado',
      },
      body: {
        ar: 'لم تتم الموافقة على طلب الحساب لهذا الدور. يرجى التواصل مع إدارة مدرسة كريستو للاستفسار أو تحديث بيانات التسجيل.',
        fr: 'Votre demande pour ce rôle n’a pas été approuvée. Veuillez contacter l’administration de l’école KRISTOU.',
        en: 'Your application for this role was not approved. Please contact KRISTOU School administration for assistance.',
        es: 'Tu solicitud para este rol no fue aprobada. Contacta con la administración de KRISTOU School si necesitas ayuda.',
        de: 'Ihr Antrag für diese Rolle wurde nicht genehmigt. Bitte wenden Sie sich an die Verwaltung der KRISTOU School.',
        pt: 'O seu pedido para esta função não foi aprovado. Contacte a administração da KRISTOU School para obter ajuda.',
      },
      chip: {
        ar: 'مرفوض (REJECTED)',
        fr: 'Refusé (REJECTED)',
        en: 'Not Approved (REJECTED)',
        es: 'No aprobado (REJECTED)',
        de: 'Nicht genehmigt (REJECTED)',
        pt: 'Não aprovado (REJECTED)',
      },
    },
    SUSPENDED: {
      title: {
        ar: 'تم إيقاف الحساب مؤقتاً',
        fr: 'Compte temporairement suspendu',
        en: 'Account temporarily suspended',
        es: 'Cuenta suspendida temporalmente',
        de: 'Konto vorübergehend gesperrt',
        pt: 'Conta suspensa temporariamente',
      },
      body: {
        ar: 'تم تعليق صلاحيات الدخول الخاصة بهذا الحساب مؤقتاً من قبل إدارة مدرسة كريستو. يمكنك تصفح الموقع العام للمدرسة أو التواصل مع الإدارة لمراجعة حالة حسابك.',
        fr: 'L’accès aux espaces privés de ce compte a été temporairement suspendu par l’administration de KRISTOU SCHOOL. Vous pouvez consulter le site public ou contacter l’administration.',
        en: 'Private school workspace access for this account has been temporarily suspended by KRISTOU School administration. You may browse the public school site or contact the administration office.',
        es: 'El acceso de esta cuenta a los espacios privados de la escuela ha sido suspendido temporalmente por la administración de KRISTOU School. Puedes navegar por el sitio público o contactar con la oficina.',
        de: 'Der Zugriff auf private Schulbereiche für dieses Konto wurde von der Verwaltung der KRISTOU School vorübergehend gesperrt. Sie können die öffentliche Seite besuchen oder die Verwaltung kontaktieren.',
        pt: 'O acesso privado desta conta foi suspenso temporariamente pela administração da KRISTOU School. Pode consultar o site público da escola ou contactar a administração.',
      },
      chip: {
        ar: 'موقوف مؤقتاً (SUSPENDED)',
        fr: 'Suspendu (SUSPENDED)',
        en: 'Suspended (SUSPENDED)',
        es: 'Suspendida (SUSPENDED)',
        de: 'Gesperrt (SUSPENDED)',
        pt: 'Suspensa (SUSPENDED)',
      },
    },
    REVOKED: {
      title: {
        ar: 'تم إلغاء صلاحية الحساب',
        fr: 'Accès au compte révoqué',
        en: 'Account access has been revoked',
        es: 'Acceso de la cuenta revocado',
        de: 'Kontozugriff wurde widerrufen',
        pt: 'Acesso à conta revogado',
      },
      body: {
        ar: 'تم إيقاف صلاحيات الدخول الخاصة بهذا الحساب من قبل إدارة المدرسة. يمكنك تصفح الموقع العام للمدرسة أو التواصل مع الإدارة.',
        fr: 'Les accès privés associés à ce compte ont été suspendus par la direction. Vous pouvez consulter le site public ou contacter l’école.',
        en: 'Private school access for this account has been suspended by school administration. You may view the public school site or contact the office.',
        es: 'El acceso privado de esta cuenta ha sido revocado por la administración escolar. Puedes ver el sitio público o contactar con la secretaría.',
        de: 'Der private Schulzugang für dieses Konto wurde von der Schulleitung aufgehoben. Sie können die öffentliche Seite aufrufen oder das Sekretariat kontaktieren.',
        pt: 'O acesso escolar privado desta conta foi revogado pela direção. Pode consultar o site público ou contactar a secretaria.',
      },
      chip: {
        ar: 'ملغى (REVOKED)',
        fr: 'Révoqué (REVOKED)',
        en: 'Access Revoked (REVOKED)',
        es: 'Acceso revocado (REVOKED)',
        de: 'Widerrufen (REVOKED)',
        pt: 'Acesso revogado (REVOKED)',
      },
    },
  };

  const activeCopy =
    status === 'REJECTED'
      ? statusCopy.REJECTED
      : status === 'SUSPENDED'
      ? statusCopy.SUSPENDED
      : status === 'REVOKED'
      ? statusCopy.REVOKED
      : statusCopy.PENDING;

  return (
    <div className="kh-role-page" data-testid="homepage-APPLICATION_STATUS">
      <HomePageHeader
        badgeText={pickText(HOMEPAGE_BADGE_LABELS.APPLICATION_STATUS, language)}
        title={pickText(activeCopy.title, language)}
        subtitle={pickText(activeCopy.body, language)}
      />

      <div className="kh-info-panel max-w-2xl">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="kh-info-chip">{pickText(activeCopy.chip, language)}</span>
            <span className="text-xs font-extrabold text-slate-500 dark:text-zinc-400">
              {pickText(
                {
                  ar: `الدور المطلوب: ${requestedRole}`,
                  fr: `Rôle demandé : ${requestedRole}`,
                  en: `Requested Role: ${requestedRole}`,
                  es: `Rol solicitado: ${requestedRole}`,
                  de: `Angefragte Rolle: ${requestedRole}`,
                  pt: `Função solicitada: ${requestedRole}`,
                },
                language,
              )}
            </span>
          </div>

          <p className="kh-info-panel-body">
            {pickText(
              {
                ar: 'حفاظاً على خصوصية التلاميذ والعائلات، لا يتم فتح أي لوحة تحكم داخلية قبل التحقق من الهوية والموافقة الرسمية على الحساب.',
                fr: 'Pour la sécurité des élèves et des familles, aucun tableau de bord interne n’est accessible avant validation officielle du compte.',
                en: 'To protect student and family privacy, no internal role homepage or private school data is accessible prior to server-verified approval.',
                es: 'Para proteger la privacidad de alumnos y familias, ningún panel interno es accesible antes de la aprobación verificada en el servidor.',
                de: 'Zum Schutz der Privatsphäre von Schülern und Familien ist vor der servergeprüften Freigabe kein interner Bereich zugänglich.',
                pt: 'Para proteger a privacidade de alunos e famílias, nenhum painel interno fica acessível antes da aprovação verificada pelo servidor.',
              },
              language,
            )}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenPublicSite}
              className="rounded-xl bg-[#0D8AE8] px-4 py-2.5 text-xs sm:text-sm font-extrabold text-white hover:bg-[#0B76C7] transition-colors"
            >
              {pickText(
                {
                  ar: 'تصفح الموقع العام للمدرسة',
                  fr: 'Consulter le site public de l’école',
                  en: 'Browse Public School Site',
                  es: 'Explorar sitio público',
                  de: 'Öffentliche Schulseite ansehen',
                  pt: 'Explorar site público',
                },
                language,
              )}
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="rounded-xl border border-slate-300 dark:border-zinc-700 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
            >
              {pickText(
                { ar: 'تسجيل الخروج', fr: 'Se déconnecter', en: 'Sign Out', es: 'Cerrar sesión', de: 'Abmelden', pt: 'Terminar sessão' },
                language,
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
