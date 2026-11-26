import React from 'react';
import { pickText } from '../../../i18n/homepages';
import type { Language } from '../../../types';

interface SchoolLevelOptionItem {
  code: string;
  labelAr: string;
  labelFr: string;
  labelEn: string;
}

interface BroadcastAudienceSelectorProps {
  mode: 'levels' | 'classes';
  language: Language;
  levels: readonly SchoolLevelOptionItem[];
  selectedLevelCodes: string[];
  onToggleLevel: (code: string) => void;
  availableClasses: { id: string; name: string; level?: string }[];
  selectedClassIds: string[];
  onToggleClass: (classId: string) => void;
}

export const BroadcastAudienceSelector: React.FC<BroadcastAudienceSelectorProps> = ({
  mode,
  language,
  levels,
  selectedLevelCodes,
  onToggleLevel,
  availableClasses,
  selectedClassIds,
  onToggleClass,
}) => {
  if (mode === 'levels') {
    return (
      <div
        className="p-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 space-y-2"
        data-testid="broadcast-level-selector"
      >
        <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
          {pickText(
            {
              ar: 'اختر المستويات المستهدفة:',
              fr: 'Sélectionnez les niveaux ciblés :',
              en: 'Select target school levels:',
              es: 'Selecciona los niveles escolares objetivo:',
              de: 'Zielklassenstufen auswählen:',
              pt: 'Selecione os níveis escolares pretendidos:',
            },
            language,
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {levels.map((lvl) => {
            const active = selectedLevelCodes.includes(lvl.code);
            const label =
              language === 'ar' ? lvl.labelAr : language === 'fr' ? lvl.labelFr : lvl.labelEn;
            return (
              <label
                key={lvl.code}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => onToggleLevel(lvl.code)}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 space-y-2"
      data-testid="broadcast-class-selector"
    >
      <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
        {pickText(
          {
            ar: 'اختر الأقسام المستهدفة:',
            fr: 'Sélectionnez les classes ciblées :',
            en: 'Select target classes:',
            es: 'Selecciona las clases objetivo:',
            de: 'Zielklassen auswählen:',
            pt: 'Selecione as turmas pretendidas:',
          },
          language,
        )}
      </p>
      {availableClasses.length === 0 ? (
        <p className="text-xs text-gray-500">
          {pickText(
            {
              ar: 'لا توجد أقسام متاحة حالياً.',
              fr: 'Aucune classe active disponible.',
              en: 'No active classes loaded.',
              es: 'No hay clases activas disponibles.',
              de: 'Keine aktiven Klassen verfügbar.',
              pt: 'Nenhuma turma ativa disponível.',
            },
            language,
          )}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {availableClasses.map((cls) => {
            const active = selectedClassIds.includes(cls.id);
            return (
              <label
                key={cls.id}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => onToggleClass(cls.id)}
                />
                <span>
                  {cls.name} ({cls.level})
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};
