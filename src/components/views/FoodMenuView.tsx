import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { FoodMenuItem } from '../../types';
import { canManageFoodMenuUi } from '../homepages/homepageAccess';
import { pickText } from '../../i18n/homepages';
import { saveFoodMenuWeek } from '../../lib/schoolContent';
import { Utensils, Calendar, Edit3, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

export const FoodMenuView: React.FC = () => {
  const { currentUser, foodMenu, foodMenuStatus, language, refreshSchoolData, t } = useApp();
  const canManage = canManageFoodMenuUi(currentUser);

  const [editing, setEditing] = useState(false);
  const [editWeekRange, setEditWeekRange] = useState(foodMenu.weekRange);
  const [editItems, setEditItems] = useState<FoodMenuItem[]>(foodMenu.items);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (!editing) {
      setEditWeekRange(foodMenu.weekRange);
      setEditItems(foodMenu.items);
    }
  }, [editing, foodMenu]);

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    const res = await saveFoodMenuWeek(editWeekRange, editItems, true);
    setSaving(false);

    if (!res.ok) {
      setFeedback({
        type: 'error',
        text: res.errorMessage || res.errorCode || t('error'),
      });
      return;
    }

    setEditing(false);
    setFeedback({
      type: 'success',
      text: pickText(
        { ar: 'تم حفظ ونشر قائمة الطعام بنجاح.', fr: 'Menu de la cantine publié.', en: 'Food menu saved and published.' },
        language,
      ),
    });
    await refreshSchoolData();
  };

  return (
    <div className="space-y-6 pb-12" data-testid="food-menu-view">
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-semibold mb-2">
            <Utensils className="w-3.5 h-3.5" />
            <span>{t('serviceRestaurant')}</span>
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            {t('foodMenu')} — {foodMenu.providerName || 'La Toque Gourmande'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{t('foodDescription')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(foodMenu.isDemoPreview || foodMenuStatus !== 'READY') && (
            <span
              data-testid="food-menu-preview-badge"
              className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] font-extrabold text-amber-700 dark:text-amber-300"
            >
              {t('demoPreview')}
            </span>
          )}
          <div className="bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{foodMenu.weekRange}</span>
          </div>
          {canManage && (
            <button
              type="button"
              data-testid="food-menu-edit-toggle"
              onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{pickText({ ar: 'تعديل القائمة', fr: 'Modifier le menu', en: 'Edit Menu' }, language)}</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'error'
              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
          }`}
        >
          {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {canManage && editing && (
        <form
          onSubmit={handleSaveMenu}
          className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-blue-200 dark:border-blue-900 shadow-sm space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-sm text-gray-900 dark:text-white">
              {pickText({ ar: 'إدارة قائمة المطعم المدرسي', fr: 'Éditeur du menu hebdomadaire', en: 'Weekly Canteen Menu Editor' }, language)}
            </h2>
            <button
              type="button"
              onClick={() =>
                setEditItems((prev) => [
                  ...prev,
                  { day: '', starter: '', main: '', side: '', dessert: '', notes: '' },
                ])
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{pickText({ ar: 'إضافة يوم', fr: 'Ajouter un jour', en: 'Add Day' }, language)}</span>
            </button>
          </div>

          <input
            type="text"
            required
            value={editWeekRange}
            onChange={(e) => setEditWeekRange(e.target.value)}
            placeholder="Week range (e.g. Semaine du 16 au 20 Novembre 2026)"
            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
          />

          <div className="space-y-3">
            {editItems.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center"
              >
                <input
                  type="text"
                  required
                  value={item.day}
                  onChange={(e) =>
                    setEditItems((prev) =>
                      prev.map((d, i) => (i === idx ? { ...d, day: e.target.value } : d)),
                    )
                  }
                  placeholder="Day"
                  className="p-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-xs font-bold"
                />
                <input
                  type="text"
                  value={item.starter}
                  onChange={(e) =>
                    setEditItems((prev) =>
                      prev.map((d, i) => (i === idx ? { ...d, starter: e.target.value } : d)),
                    )
                  }
                  placeholder={t('starter')}
                  className="p-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-xs"
                />
                <input
                  type="text"
                  required
                  value={item.main}
                  onChange={(e) =>
                    setEditItems((prev) =>
                      prev.map((d, i) => (i === idx ? { ...d, main: e.target.value } : d)),
                    )
                  }
                  placeholder={t('mainDish')}
                  className="p-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-xs"
                />
                <input
                  type="text"
                  value={item.side}
                  onChange={(e) =>
                    setEditItems((prev) =>
                      prev.map((d, i) => (i === idx ? { ...d, side: e.target.value } : d)),
                    )
                  }
                  placeholder={t('sideDish')}
                  className="p-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-xs"
                />
                <input
                  type="text"
                  value={item.dessert}
                  onChange={(e) =>
                    setEditItems((prev) =>
                      prev.map((d, i) => (i === idx ? { ...d, dessert: e.target.value } : d)),
                    )
                  }
                  placeholder={t('dessert')}
                  className="p-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="Remove day"
                  className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 justify-self-end"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      )}

      {/* Days list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {foodMenu.items.map((item, idx) => (
          <div key={idx} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="font-extrabold text-base text-blue-600 dark:text-blue-400">{item.day}</h3>
              <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-lg">
                {t('balanced')}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-gray-400 block mb-0.5">{t('starter')}</span>
                <span className="font-bold text-gray-900 dark:text-white">{item.starter}</span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">{t('mainDish')}</span>
                <span className="font-bold text-gray-900 dark:text-white">{item.main}</span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">{t('sideDish')}</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{item.side}</span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">{t('dessert')}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{item.dessert}</span>
              </div>
            </div>

            {item.notes && (
              <p className="text-[11px] text-gray-400 italic pt-2 border-t border-gray-100 dark:border-gray-800">
                {item.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
