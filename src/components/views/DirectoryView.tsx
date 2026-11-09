import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BookOpen, Shield, Users, Mail, Globe } from 'lucide-react';

export const DirectoryView: React.FC = () => {
  const { teachers, admins, t } = useApp();
  const [tab, setTab] = useState<'teachers' | 'admin'>('teachers');

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            Annuaire de l'École
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Découvrez l'équipe pédagogique et la direction de l'École Primaire Privée Kristou School.
          </p>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl">
          <button
            onClick={() => setTab('teachers')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${tab === 'teachers' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
          >
            {t('teachers')}
          </button>
          <button
            onClick={() => setTab('admin')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${tab === 'admin' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
          >
            {t('administration')}
          </button>
        </div>
      </div>

      {tab === 'teachers' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teachers.map(teach => (
            <div key={teach.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-start space-x-4 rtl:space-x-reverse">
              <img src={teach.photoUrl} alt={teach.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-500 shadow-md shrink-0" />
              <div className="space-y-2 flex-1">
                <h3 className="font-bold text-base text-gray-900 dark:text-white">{teach.name}</h3>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{teach.title}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{teach.bio}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {teach.classes.map((cls, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-bold rounded-lg">
                      {cls}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {admins.map(adm => (
            <div key={adm.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-start space-x-4 rtl:space-x-reverse">
              <img src={adm.photoUrl} alt={adm.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500 shadow-md shrink-0" />
              <div className="space-y-2 flex-1">
                <h3 className="font-bold text-base text-gray-900 dark:text-white">{adm.name}</h3>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{adm.title}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{adm.bio}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {adm.responsibilities.map((resp, i) => (
                    <span key={i} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-lg">
                      {resp}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
