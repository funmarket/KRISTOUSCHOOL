import type { Language } from '../types';

type ContentPatch = Record<string, Record<string, string>>;

const content: Partial<Record<Language, ContentPatch>> = {
  en: {
    announcements: {
      'ann-1.title': 'Educational trip to Bardo Museum',
      'ann-1.body': 'Dear parents, our visit to the Bardo National Museum will take place this Thursday. Please send pupils with a water bottle and the official school uniform.',
      'ann-1.authorRole': 'Teacher',
      'ann-2.title': 'Back-to-school gathering and health guidance',
      'ann-2.body': 'Important reminder about pupil arrival and departure times. Please respect the designated parking areas.',
      'ann-2.authorRole': 'Administration',
    },
    homework: {
      'hw-1.title': 'Mathematics: fraction exercises',
      'hw-1.description': 'Complete exercises 4, 5 and 6 on page 42 of the arithmetic book.',
      'hw-2.title': 'Written work: my favourite animal',
      'hw-2.description': 'Write five lines in French describing your favourite animal.',
    },
    calendar: {
      'cal-1.title': 'Dictation assessment',
      'cal-1.description': 'Prepared dictation using the words from week 8.',
      'cal-1.category': 'TEST',
      'cal-2.title': 'Teachers’ meeting',
      'cal-2.description': 'Monthly teaching-team meeting.',
      'cal-2.category': 'MEETING',
    },
    menu: {
      'menu-current.weekRange': '10 November – 14 November 2026',
      '0.day': 'Monday', '0.starter': 'Fresh Tunisian salad', '0.main': 'Free-range chicken couscous', '0.side': 'Seasonal vegetables', '0.dessert': 'Seasonal fruit', '0.notes': 'Prepared with care by La Toque Gourmande',
      '1.day': 'Tuesday', '1.starter': 'Velvety vegetable soup', '1.main': 'Breaded turkey escalope', '1.side': 'Mashed potatoes', '1.dessert': 'Organic plain yoghurt',
      '2.day': 'Wednesday', '2.starter': 'Crispy tuna brick', '2.main': 'Parmesan spaghetti bolognese', '2.side': 'Homemade tomato sauce', '2.dessert': 'Fresh fruit salad',
      '3.day': 'Thursday', '3.starter': 'Green salad and corn', '3.main': 'Mild ojja merguez', '3.side': 'Fresh Tunisian bread', '3.dessert': 'Vanilla custard',
      '4.day': 'Friday', '4.starter': 'Pumpkin velouté', '4.main': 'Catch of the day', '4.side': 'Basmati rice with peas', '4.dessert': 'Traditional pastry',
    },
    teachers: {
      'teach-1.title': 'Primary school teacher', 'teach-1.bio': '12 years of experience teaching bilingual primary classes (Arabic/French).',
      'teach-2.title': 'Mathematics & science teacher', 'teach-2.bio': 'Passionate about playful scientific discovery and logical thinking.',
    },
    admins: {
      'admin-1.title': 'Founder & Principal', 'admin-1.bio': 'Committed to educational excellence and children’s development since the school was founded.',
      'admin-2.title': 'Educational coordinator', 'admin-2.bio': 'Supervises bilingual programmes and personalised pupil support.',
    },
    notifications: { 'n-1.title': 'School trip – Bardo Museum', 'n-1.message': 'Reminder for this Thursday’s visit.', 'n-1.time': '10 min ago', 'n-2.title': 'La Toque Gourmande canteen', 'n-2.message': 'This week’s menu is online.', 'n-2.time': '1 hour ago' },
  },
  ar: {
    announcements: {
      'ann-1.title': 'رحلة تعليمية إلى متحف باردو',
      'ann-1.body': 'أولياءنا الأعزاء، ستقام زيارتنا إلى المتحف الوطني بباردو يوم الخميس. يرجى تزويد التلاميذ بقارورة ماء والزي المدرسي الرسمي.',
      'ann-1.authorRole': 'المعلمة',
      'ann-2.title': 'تجمع العودة إلى المدرسة وإرشادات الصحة',
      'ann-2.body': 'تذكير مهم بمواعيد دخول وخروج التلاميذ. يرجى احترام مناطق الوقوف المحددة.',
      'ann-2.authorRole': 'الإدارة',
    },
    homework: { 'hw-1.title': 'الرياضيات: تمارين الكسور', 'hw-1.description': 'حل التمارين 4 و5 و6 في الصفحة 42 من كتاب الحساب.', 'hw-2.title': 'التعبير الكتابي: حيواني المفضل', 'hw-2.description': 'اكتب خمسة أسطر بالفرنسية تصف فيها حيوانك المفضل.' },
    calendar: { 'cal-1.title': 'تقييم الإملاء', 'cal-1.description': 'إملاء محضر حول كلمات الأسبوع الثامن.', 'cal-1.category': 'اختبار', 'cal-2.title': 'اجتماع المعلمين', 'cal-2.description': 'الاجتماع التربوي الشهري لفريق التعليم.', 'cal-2.category': 'اجتماع' },
    menu: { 'menu-current.weekRange': '10 - 14 نوفمبر 2026', '0.day': 'الإثنين', '0.starter': 'سلطة تونسية طازجة', '0.main': 'كسكسي بالدجاج الطازج', '0.side': 'خضروات موسمية', '0.dessert': 'فواكه موسمية', '0.notes': 'محضر بعناية من La Toque Gourmande', '1.day': 'الثلاثاء', '1.starter': 'حساء خضروات ناعم', '1.main': 'إسكالوب ديك رومي مقرمش', '1.side': 'بطاطا مهروسة', '1.dessert': 'ياغورت طبيعي عضوي', '2.day': 'الأربعاء', '2.starter': 'بريك بالتونة مقرمش', '2.main': 'سباغيتي بولونيز بالبارميزان', '2.side': 'صلصة طماطم منزلية', '2.dessert': 'سلطة فواكه طازجة', '3.day': 'الخميس', '3.starter': 'سلطة خضراء وذرة', '3.main': 'عجة مرقاز خفيفة', '3.side': 'خبز تونسي طازج', '3.dessert': 'كريمة فانيلا', '4.day': 'الجمعة', '4.starter': 'حساء اليقطين', '4.main': 'سمك اليوم', '4.side': 'أرز بسمتي مع البازلاء', '4.dessert': 'حلوى تقليدية' },
    teachers: { 'teach-1.title': 'معلمة التعليم الابتدائي', 'teach-1.bio': 'خبرة 12 سنة في التعليم الابتدائي ثنائي اللغة (العربية والفرنسية).', 'teach-2.title': 'معلم الرياضيات والعلوم', 'teach-2.bio': 'شغوف بالتجارب العلمية المبسطة والتفكير المنطقي الممتع.' },
    admins: { 'admin-1.title': 'المؤسس والمدير العام', 'admin-1.bio': 'ملتزم بالتميز التربوي ونمو الأطفال منذ تأسيس المدرسة.', 'admin-2.title': 'المنسقة التربوية', 'admin-2.bio': 'تشرف على البرامج ثنائية اللغة والمتابعة الفردية للتلاميذ.' },
    notifications: { 'n-1.title': 'رحلة مدرسية - متحف باردو', 'n-1.message': 'تذكير بزيارة يوم الخميس.', 'n-1.time': 'منذ 10 دقائق', 'n-2.title': 'مطعم La Toque Gourmande', 'n-2.message': 'قائمة هذا الأسبوع متاحة.', 'n-2.time': 'منذ ساعة' },
  },
};

export function contentT(language: Language, section: string, id: string, field: string, fallback: string): string {
  return content[language]?.[section]?.[`${id}.${field}`] || fallback;
}
