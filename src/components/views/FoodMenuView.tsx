import React from 'react';
import { useApp } from '../../context/AppContext';
import { Utensils, Sparkles, Calendar } from 'lucide-react';

export const FoodMenuView: React.FC = () => {
  const { foodMenu, t } = useApp();

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-semibold mb-2">
            <Utensils className="w-3.5 h-3.5" />
            <span>{t('serviceRestaurant')}</span>
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            {t('foodMenu')} — La Toque Gourmande
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {t('foodDescription')}
          </p>
        </div>

        <div className="bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>{foodMenu.weekRange}</span>
        </div>
      </div>

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
