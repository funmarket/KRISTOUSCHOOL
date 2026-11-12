import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, CheckCircle2, Clock, AlertTriangle, UserCheck } from 'lucide-react';

export const PickupBoardView: React.FC = () => {
  const { currentUser, currentRole, childrenList, pickupRecords, markPickupArrived, confirmPickupRelease, t } = useApp();

  const userChildren = childrenList.filter(c => currentUser?.linkedChildrenIds?.includes(c.id));

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t('pickupSecurity')}</span>
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            {t('pickup')}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {t('pickupRule')}
          </p>
        </div>

        <div className="bg-gray-100 dark:bg-gray-900 px-4 py-2 rounded-2xl text-xs font-semibold text-gray-700 dark:text-gray-300">
          {t('timezone')}
        </div>
      </div>

      {/* Parent Perspective */}
      {currentRole === 'PARENT' && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('announceArrival')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userChildren.map(child => {
              const record = pickupRecords.find(p => p.childId === child.id);
              const state = record?.state || 'WAITING';

              return (
                <div key={child.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                  <div className="flex items-center space-x-4 rtl:space-x-reverse">
                    <img src={child.photoUrl} alt={child.fullName} className="w-14 h-14 rounded-2xl object-cover border" />
                    <div>
                      <h4 className="font-bold text-base text-gray-900 dark:text-white">{child.fullName}</h4>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{child.className}</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-between text-xs">
                    <span className="text-gray-500">{t('currentStatus')} :</span>
                    <span className={`font-bold px-3 py-1 rounded-xl uppercase text-[10px] ${state === 'RELEASED' ? 'bg-emerald-100 text-emerald-700' : state === 'PARENT_ARRIVED' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {state === 'RELEASED' ? t('released') : state === 'PARENT_ARRIVED' ? t('parentArrived') : t('waiting')}
                    </span>
                  </div>

                  {state === 'WAITING' ? (
                    <button
                      onClick={() => markPickupArrived(child.id)}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
                    >
                      <span>{t('arrived')}</span>
                    </button>
                  ) : (
                    <div className="text-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold py-2">
                      ✓ {t('arrivalSent')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Teacher / Manager / Admin Perspective: Pickup Board */}
      {(currentRole === 'TEACHER' || currentRole === 'MANAGER' || currentRole === 'APP_ADMIN') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('pickupBoard')}</h3>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{t('liveUpdate')}</span>
          </div>

          <div className="space-y-3">
            {pickupRecords.map(rec => (
              <div key={rec.id} className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-4 rtl:space-x-reverse">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    {rec.childName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">{rec.childName}</h4>
                    <p className="text-xs text-gray-500">{rec.className} • {t('authorized')} : {rec.authorizedPerson}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 rtl:space-x-reverse w-full sm:w-auto justify-between sm:justify-end">
                  <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase ${rec.state === 'RELEASED' ? 'bg-emerald-100 text-emerald-700' : rec.state === 'PARENT_ARRIVED' ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
                    {rec.state}
                  </span>

                  {rec.state === 'PARENT_ARRIVED' && (
                    <button
                      onClick={() => confirmPickupRelease(rec.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>{t('confirmRelease')}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
