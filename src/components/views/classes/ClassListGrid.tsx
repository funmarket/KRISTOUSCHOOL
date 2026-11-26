import React from 'react';
import type { Language, SchoolClassSummary } from '../../../types';
import { EmptyFeatureState } from '../../homepages/shared/EmptyFeatureState';
import { pickText } from '../../../i18n/homepages';
import {
  AlertCircle,
  Calendar,
  ClipboardCheck,
  GraduationCap,
  Lock,
  MessageSquare,
  Search,
  Users,
} from 'lucide-react';
import type { ClassesBackendStatus } from '../ClassesManagementView';

interface ClassListGridProps {
  language: Language;
  t: (key: any) => string;
  backendStatus: ClassesBackendStatus;
  errorMessage: string | null;
  isBackendUnauthorized: boolean;
  isTeacherView: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  effectiveSelectedLevel: string;
  setSelectedLevel: (v: string) => void;
  levelOptions: { value: string; label: string }[];
  effectiveSelectedYear: string;
  setSelectedYear: (v: string) => void;
  yearOptions: string[];
  scopedInitialClasses: SchoolClassSummary[];
  filteredClasses: SchoolClassSummary[];
  sharedSelectedClassId?: string | null;
  setSharedSelectedClassId?: (id: string) => void;
  setSelectedClassId: (id: string | null) => void;
  setStudentSearchQuery: (v: string) => void;
  setRosterPage: (v: number) => void;
  onRefresh?: () => Promise<boolean | void> | void;
  onOpenClassCommunity?: (classId: string) => void;
  onOpenAttendance?: (classId: string) => void;
}

export const ClassListGrid: React.FC<ClassListGridProps> = ({
  language, t, backendStatus, errorMessage, isBackendUnauthorized, isTeacherView,
  searchQuery, setSearchQuery, effectiveSelectedLevel, setSelectedLevel, levelOptions,
  effectiveSelectedYear, setSelectedYear, yearOptions, scopedInitialClasses, filteredClasses,
  sharedSelectedClassId, setSharedSelectedClassId, setSelectedClassId,
  setStudentSearchQuery, setRosterPage, onRefresh, onOpenClassCommunity, onOpenAttendance,
}) => {
  return (
    <>
      <div className="bg-white dark:bg-[#111111] p-4 sm:p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute start-3.5 top-3" />
          <input
            type="search"
            data-testid="classes-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={pickText({ ar: 'بحث باسم القسم أو المربي...', fr: 'Rechercher une classe ou un enseignant...', en: 'Search by class name or teacher...', es: 'Buscar por clase o docente...', de: 'Nach Klasse oder Lehrkraft suchen...', pt: 'Pesquisar por turma ou docente...' }, language)}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-2.5 ps-10 pe-4 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <select
            aria-label="Filter by level"
            data-testid="classes-level-filter"
            value={effectiveSelectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-2.5 px-3.5 text-xs font-semibold text-gray-900 dark:text-white"
          >
            <option value="ALL">
              {pickText({ ar: 'جميع المستويات', fr: 'Tous les niveaux', en: 'All Levels', es: 'Todos los niveles', de: 'Alle Stufen', pt: 'Todos os níveis' }, language)}
            </option>
            {levelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            aria-label="Filter by academic year"
            data-testid="classes-year-filter"
            value={effectiveSelectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-2.5 px-3.5 text-xs font-semibold text-gray-900 dark:text-white"
          >
            <option value="ALL">
              {pickText({ ar: 'جميع السنوات الدراسية', fr: 'Toutes les années scolaires', en: 'All Academic Years', es: 'Todos los años académicos', de: 'Alle Schuljahre', pt: 'Todos os anos letivos' }, language)}
            </option>
            {yearOptions.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {backendStatus === 'LOADING' && (
        <div
          data-testid="classes-loading-state"
          className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-xs font-bold text-gray-500"
        >
          {t('loading')}
        </div>
      )}

      {backendStatus === 'BACKEND_NOT_IMPLEMENTED' && scopedInitialClasses.length === 0 && (
        <div data-testid="classes-backend-pending-state">
          <EmptyFeatureState
            state="BLOCKED_BACKEND"
            title={pickText(
              isTeacherView
                ? { ar: 'خدمة الأقسام قيد التفعيل على الخادم', fr: 'Service des classes en attente d’activation serveur', en: 'Classes Service Unavailable on Backend', es: 'Servicio de clases no disponible en el servidor', de: 'Klassendienst auf dem Server nicht verfügbar', pt: 'Serviço de turmas indisponível no servidor' }
                : { ar: 'جداول الأقسام وقوائم التلاميذ بانتظار التفعيل في الخادم (Pending Backend)', fr: 'Tables des classes et listes d’élèves en attente du contrat serveur (Pending Backend)', en: 'Classes & Student Roster Persistence Pending Backend Deployment', es: 'Persistencia de clases y listas pendiente del servidor', de: 'Klassen- und Schülerlisten-Speicherung wartet auf Server-Bereitstellung', pt: 'Persistência de turmas e listas pendente da implantação no servidor' },
              language,
            )}
            description={pickText(
              isTeacherView
                ? { ar: 'تعذر الوصول إلى خدمة الأقسام في الخادم حالياً. لا يتم عرض أي أقسام أو تلاميذ غير موثقين.', fr: 'Le service serveur des classes n’est pas encore disponible. Aucune classe ni liste d’élèves fictive n’est affichée.', en: 'The school classes service is not yet available from the backend. No unverified classes or students are shown.', es: 'El servicio escolar de clases aún no está disponible en el servidor. No se muestran clases ni alumnos sin verificar.', de: 'Der Schulklassendienst ist auf dem Server noch nicht verfügbar. Es werden keine unbestätigten Klassen oder Schüler angezeigt.', pt: 'O serviço escolar de turmas ainda não está disponível no servidor. Não são exibidas turmas nem alunos não verificados.' }
                : { ar: 'واجهة إدارة الأقسام جاهزة ومحمية بصلاحيات الإدارة المدرسية، ولكن لم يتم بعد نشر جداول الأقسام والتلاميذ في الخادم. التزاماً بقواعد الأمان، لا يتم عرض أي أقسام أو تلاميذ وهميين.', fr: 'L’interface Classes → Élèves est prête et protégée, mais les services serveur des classes ne sont pas encore déployés. Conformément aux règles de sécurité, aucune donnée fictive n’est affichée.', en: 'The Classes & Student Roster UI is wired and access-controlled, but backend services are not deployed yet. Zero mock classes or mock student records are fabricated.', es: 'La interfaz de clases y listas está conectada y protegida, pero los servicios del servidor aún no están desplegados. No se muestran datos ficticios.', de: 'Die Klassen- und Schülerlisten-Oberfläche ist angebunden und geschützt, aber die Serverdienste sind noch nicht bereitgestellt. Es werden keine Scheindaten erzeugt.', pt: 'A interface de turmas e listas está ligada e protegida, mas os serviços do servidor ainda não foram implantados. Não são gerados dados fictícios.' },
              language,
            )}
          />
        </div>
      )}

      {isBackendUnauthorized && (
        <div
          data-testid="classes-unauthorized-state"
          role="alert"
          className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              {errorMessage ||
                pickText({ ar: 'غير مصرح بعرض قائمة الأقسام أو التلاميذ من الخادم.', fr: 'Accès non autorisé aux classes et listes d’élèves.', en: 'Not authorized to access school classes and student rosters.', es: 'No autorizado para acceder a las clases y listas de alumnos.', de: 'Nicht berechtigt, auf Schulklassen und Schülerlisten zuzugreifen.', pt: 'Sem autorização para aceder às turmas e listas de alunos.' }, language)}
            </span>
          </div>
          {onRefresh && (
            <button
              type="button"
              data-testid="classes-unauthorized-retry-btn"
              onClick={() => void onRefresh()}
              className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs"
            >
              {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
            </button>
          )}
        </div>
      )}

      {backendStatus === 'ERROR' && (
        <div
          data-testid="classes-error-state"
          role="alert"
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-xs text-red-800 dark:text-red-300"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {errorMessage ||
                pickText({ ar: 'تعذر تحميل قائمة الأقسام والتلاميذ من الخادم.', fr: 'Impossible de charger les classes et listes d’élèves depuis le serveur.', en: 'Failed to load classes and student rosters from server.', es: 'No se pudieron cargar las clases y listas de alumnos desde el servidor.', de: 'Klassen und Schülerlisten konnten nicht vom Server geladen werden.', pt: 'Falha ao carregar as turmas e listas de alunos do servidor.' }, language)}
            </span>
          </div>
          {onRefresh && (
            <button
              type="button"
              data-testid="classes-retry-btn"
              onClick={() => void onRefresh()}
              className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs"
            >
              {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
            </button>
          )}
        </div>
      )}

      {backendStatus === 'READY' && filteredClasses.length === 0 && (
        <div data-testid="classes-empty-state">
          <EmptyFeatureState
            state="AVAILABLE_READ_ONLY"
            title={pickText(
              isTeacherView && scopedInitialClasses.length === 0
                ? { ar: 'لا توجد أقسام مسندة لحسابك حالياً', fr: 'Aucune classe assignée pour le moment', en: 'No classes assigned yet', es: 'Aún no hay clases asignadas', de: 'Noch keine Klassen zugewiesen', pt: 'Ainda não há turmas atribuídas' }
                : { ar: 'لا توجد أقسام مطابقة للبحث', fr: 'Aucune classe trouvée', en: 'No classes found', es: 'No se encontraron clases', de: 'Keine Klassen gefunden', pt: 'Nenhuma turma encontrada' },
              language,
            )}
            description={pickText(
              isTeacherView && scopedInitialClasses.length === 0
                ? { ar: 'ستظهر هنا الأقسام الدراسية المسندة إليك وقوائم التلاميذ الخاصة بها فور تعيينها من طرف إدارة المدرسة.', fr: 'Vos classes assignées et leurs listes d’élèves apparaîtront ici dès leur affectation par la direction de l’école.', en: 'Your assigned classes and student rosters will appear here once assigned by school administration.', es: 'Sus clases asignadas y listas de alumnos aparecerán aquí en cuanto la dirección escolar las asigne.', de: 'Ihre zugewiesenen Klassen und Schülerlisten erscheinen hier, sobald die Schulleitung sie zuweist.', pt: 'As suas turmas atribuídas e respetivas listas de alunos aparecerão aqui assim que forem atribuídas pela direção.' }
                : { ar: 'لم يتم العثور على أقسام مسجلة تطابق معايير التصفية الحالية.', fr: 'Aucune classe enregistrée ne correspond aux filtres sélectionnés.', en: 'No server-verified classes match the current search or filter criteria.', es: 'Ninguna clase verificada coincide con los criterios de búsqueda o filtro.', de: 'Keine verifizierten Klassen entsprechen den aktuellen Such- oder Filterkriterien.', pt: 'Nenhuma turma verificada corresponde aos critérios atuais de pesquisa ou filtro.' },
              language,
            )}
          />
        </div>
      )}

      {!isBackendUnauthorized && filteredClasses.length > 0 && (
        <div data-testid="classes-card-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClasses.map((cls) => {
            const isSharedSelected = Boolean(sharedSelectedClassId && sharedSelectedClassId === cls.id);
            return (
              <article
                key={cls.id}
                data-testid={`class-card-${cls.id}`}
                data-selected={isSharedSelected ? 'true' : 'false'}
                className={`kh-info-panel flex flex-col justify-between gap-4 ${
                  isSharedSelected ? 'ring-2 ring-[#1E3A6D] dark:ring-blue-500' : ''
                }`}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="kh-info-chip">{cls.level}</span>
                      {isSharedSelected && (
                        <span
                          data-testid={`class-selected-badge-${cls.id}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-xl text-[10px] font-extrabold bg-blue-100 text-[#1E3A6D] dark:bg-blue-950/70 dark:text-blue-300"
                        >
                          {pickText({ ar: 'محدد', fr: 'Sélectionnée', en: 'Selected', es: 'Seleccionada', de: 'Ausgewählt', pt: 'Selecionada' }, language)}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-zinc-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{cls.academicYear}</span>
                    </span>
                  </div>

                  <h2 className="kh-info-panel-title text-lg">{cls.name}</h2>

                  <div className="space-y-1 text-xs text-slate-600 dark:text-zinc-300">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>
                        {t('teacherLabel')} : <strong>{cls.homeroomTeacherName || '—'}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        {pickText({ ar: `التلاميذ المسجلون: ${cls.activeStudentCount}${cls.capacity ? ` / السعة: ${cls.capacity}` : ''}`, fr: `Élèves inscrits : ${cls.activeStudentCount}${cls.capacity ? ` / Capacité : ${cls.capacity}` : ''}`, en: `Enrolled students: ${cls.activeStudentCount}${cls.capacity ? ` / Capacity: ${cls.capacity}` : ''}`, es: `Alumnos matriculados: ${cls.activeStudentCount}${cls.capacity ? ` / Capacidad: ${cls.capacity}` : ''}`, de: `Eingeschriebene Schüler: ${cls.activeStudentCount}${cls.capacity ? ` / Kapazität: ${cls.capacity}` : ''}`, pt: `Alunos inscritos: ${cls.activeStudentCount}${cls.capacity ? ` / Capacidade: ${cls.capacity}` : ''}` }, language)}
                      </span>
                    </div>
                    {cls.roomLabel && (
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                        {pickText({ ar: `القاعة: ${cls.roomLabel}`, fr: `Salle : ${cls.roomLabel}`, en: `Room: ${cls.roomLabel}`, es: `Aula: ${cls.roomLabel}`, de: `Raum: ${cls.roomLabel}`, pt: `Sala: ${cls.roomLabel}` }, language)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    data-testid={`view-class-students-${cls.id}`}
                    onClick={() => {
                      setSharedSelectedClassId?.(cls.id);
                      setSelectedClassId(cls.id);
                      setStudentSearchQuery('');
                      setRosterPage(1);
                    }}
                    className="w-full rounded-2xl bg-[#1E3A6D] hover:bg-[#162C54] text-white font-extrabold text-xs py-3 px-4 transition-colors flex items-center justify-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    <span>{pickText({ ar: 'عرض قائمة التلاميذ', fr: 'Voir les élèves', en: 'View Students', es: 'Ver alumnos', de: 'Schüler anzeigen', pt: 'Ver alunos' }, language)}</span>
                  </button>

                  {onOpenClassCommunity && (
                    <button
                      type="button"
                      data-testid={`open-class-community-${cls.id}`}
                      onClick={() => {
                        setSharedSelectedClassId?.(cls.id);
                        onOpenClassCommunity(cls.id);
                      }}
                      className="w-full rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/70 hover:bg-slate-100 dark:hover:bg-zinc-900 text-[#1E3A6D] dark:text-blue-300 font-extrabold text-xs py-2.5 px-4 transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{pickText({ ar: 'فتح فضاء القسم', fr: 'Ouvrir l’espace classe', en: 'Open Class Community', es: 'Abrir espacio de clase', de: 'Klassenbereich öffnen', pt: 'Abrir espaço da turma' }, language)}</span>
                    </button>
                  )}
                  {isTeacherView && onOpenAttendance && (
                    <button
                      type="button"
                      data-testid={`take-attendance-${cls.id}`}
                      onClick={() => {
                        setSharedSelectedClassId?.(cls.id);
                        onOpenAttendance(cls.id);
                      }}
                      className="w-full rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs py-2.5 px-4 transition-colors flex items-center justify-center gap-2"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      <span>{pickText({ ar: 'تسجيل الحضور والغياب', fr: 'Faire l’appel', en: 'Take Attendance', es: 'Pasar lista', de: 'Anwesenheit erfassen', pt: 'Registar presenças' }, language)}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
};
