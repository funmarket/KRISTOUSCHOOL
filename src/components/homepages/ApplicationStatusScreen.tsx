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
      },
      body: {
        ar: 'تم استلام طلب إنشاء حسابك بنجاح. يتطلب الدخول إلى فضاءات المدرسة الخاصة موافقة إدارة مدرسة كريستو. ستتمكن من الدخول إلى فضائك المدرسي بعد الموافقة على حسابك.',
        fr: 'Votre demande de création de compte a bien été reçue. L’accès aux espaces privés nécessite l’approbation de l’administration de KRISTOU SCHOOL. Vous pourrez accéder à votre espace scolaire une fois votre compte approuvé.',
        en: 'Your account registration has been received. Access to private school spaces requires approval from KRISTOU SCHOOL administration. You will be able to access your school workspace after your account is approved.',
      },
      chip: {
        ar: 'قيد الانتظار (PENDING)',
        fr: 'En attente (PENDING)',
        en: 'Pending Approval (PENDING)',
      },
    },
    REJECTED: {
      title: {
        ar: 'تعذر قبول طلب الحساب',
        fr: 'Demande de compte non retenue',
        en: 'Account application was not approved',
      },
      body: {
        ar: 'لم تتم الموافقة على طلب الحساب لهذا الدور. يرجى التواصل مع إدارة مدرسة كريستو للاستفسار أو تحديث بيانات التسجيل.',
        fr: 'Votre demande pour ce rôle n’a pas été approuvée. Veuillez contacter l’administration de l’école KRISTOU.',
        en: 'Your application for this role was not approved. Please contact KRISTOU School administration for assistance.',
      },
      chip: {
        ar: 'مرفوض (REJECTED)',
        fr: 'Refusé (REJECTED)',
        en: 'Not Approved (REJECTED)',
      },
    },
    REVOKED: {
      title: {
        ar: 'تم تعليق صلاحية الحساب',
        fr: 'Accès au compte révoqué',
        en: 'Account access has been revoked',
      },
      body: {
        ar: 'تم إيقاف صلاحيات الدخول الخاصة بهذا الحساب من قبل إدارة المدرسة. يمكنك تصفح الموقع العام للمدرسة أو التواصل مع الإدارة.',
        fr: 'Les accès privés associés à ce compte ont été suspendus par la direction. Vous pouvez consulter le site public ou contacter l’école.',
        en: 'Private school access for this account has been suspended by school administration. You may view the public school site or contact the office.',
      },
      chip: {
        ar: 'معلق (REVOKED)',
        fr: 'Révoqué (REVOKED)',
        en: 'Access Revoked (REVOKED)',
      },
    },
  };

  const activeCopy =
    status === 'REJECTED'
      ? statusCopy.REJECTED
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
                { ar: 'تسجيل الخروج', fr: 'Se déconnecter', en: 'Sign Out' },
                language,
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
