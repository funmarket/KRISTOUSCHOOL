import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GraduationCap, CheckCircle2, Send, FileText } from 'lucide-react';

export const RegistrationView: React.FC = () => {
  const { t } = useApp();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    childName: '',
    birthDate: '',
    level: 'Primaire 1',
    parentName: '',
    phone: '',
    email: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.childName || !formData.parentName || !formData.phone) return;
    setSubmitted(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
        <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl mx-auto flex items-center justify-center font-bold text-lg mb-3 shadow-md shadow-blue-500/30">
          K
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
          {t('registration')} — Rentrée 2025/2026
        </h1>
        <p className="text-xs text-gray-500 max-w-lg mx-auto">
          Inscrivez votre enfant à l'École Primaire Privée Kristou School. Remplissez le formulaire ci-dessous pour initier la demande d'admission.
        </p>
      </div>

      {submitted ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-8 rounded-3xl text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <h3 className="font-bold text-lg text-emerald-900 dark:text-emerald-300">Demande d'inscription enregistrée !</h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 max-w-md mx-auto">
            Notre service des admissions étudiera votre dossier et vous contactera rapidement par téléphone ou email.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="px-6 py-2.5 bg-emerald-600 text-white font-semibold text-xs rounded-xl shadow-md hover:bg-emerald-700 transition-all mt-4"
          >
            Nouvelle demande
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nom et Prénom de l'élève</label>
                <input
                  type="text"
                  required
                  value={formData.childName}
                  onChange={e => setFormData({ ...formData, childName: e.target.value })}
                  placeholder="Ex: Yasmine Ben Salah"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Date de naissance</label>
                <input
                  type="date"
                  required
                  value={formData.birthDate}
                  onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Niveau scolaire souhaité</label>
                <select
                  value={formData.level}
                  onChange={e => setFormData({ ...formData, level: e.target.value })}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                >
                  <option value="Primaire 1">1ère Année Primaire</option>
                  <option value="Primaire 2">2ème Année Primaire</option>
                  <option value="Primaire 3">3ème Année Primaire</option>
                  <option value="Primaire 4">4ème Année Primaire</option>
                  <option value="Primaire 5">5ème Année Primaire</option>
                  <option value="Primaire 6">6ème Année Primaire</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nom et Prénom du Parent / Tuteur</label>
                <input
                  type="text"
                  required
                  value={formData.parentName}
                  onChange={e => setFormData({ ...formData, parentName: e.target.value })}
                  placeholder="Ex: Karim Ben Salah"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Numéro de téléphone</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+216 98 000 000"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Adresse Email (Optionnelle)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="parent@example.com"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center space-x-2 rtl:space-x-reverse mt-4"
            >
              <Send className="w-4 h-4" />
              <span>Soumettre la demande d'admission</span>
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
