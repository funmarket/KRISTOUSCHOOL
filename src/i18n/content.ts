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
  es: {
    announcements: {
      'ann-1.title': 'Excursión educativa al Museo del Bardo',
      'ann-1.body': 'Estimadas familias, nuestra visita al Museo Nacional del Bardo tendrá lugar este jueves. Por favor, envíen a los alumnos con botella de agua y el uniforme escolar oficial.',
      'ann-1.authorRole': 'Docente',
      'ann-2.title': 'Reunión de vuelta al colegio e indicaciones sanitarias',
      'ann-2.body': 'Recordatorio importante sobre los horarios de entrada y salida del alumnado. Respeten las zonas de estacionamiento designadas.',
      'ann-2.authorRole': 'Administración',
    },
    homework: { 'hw-1.title': 'Matemáticas: ejercicios de fracciones', 'hw-1.description': 'Completa los ejercicios 4, 5 y 6 de la página 42 del libro de aritmética.', 'hw-2.title': 'Expresión escrita: mi animal favorito', 'hw-2.description': 'Escribe cinco líneas en francés describiendo tu animal favorito.' },
    calendar: { 'cal-1.title': 'Evaluación de dictado', 'cal-1.description': 'Dictado preparado con las palabras de la semana 8.', 'cal-1.category': 'EXAMEN', 'cal-2.title': 'Reunión de docentes', 'cal-2.description': 'Reunión mensual del equipo pedagógico.', 'cal-2.category': 'REUNIÓN' },
    menu: { 'menu-current.weekRange': '10 de noviembre – 14 de noviembre de 2026', '0.day': 'Lunes', '0.starter': 'Ensalada tunecina fresca', '0.main': 'Cuscús de pollo de corral', '0.side': 'Verduras de temporada', '0.dessert': 'Fruta de temporada', '0.notes': 'Preparado con esmero por La Toque Gourmande', '1.day': 'Martes', '1.starter': 'Crema suave de verduras', '1.main': 'Escalope de pavo empanado', '1.side': 'Puré de patatas', '1.dessert': 'Yogur natural ecológico', '2.day': 'Miércoles', '2.starter': 'Brik crujiente de atún', '2.main': 'Espaguetis a la boloñesa con parmesano', '2.side': 'Salsa de tomate casera', '2.dessert': 'Macedonia de frutas frescas', '3.day': 'Jueves', '3.starter': 'Ensalada verde y maíz', '3.main': 'Ojja suave de merguez', '3.side': 'Pan tunecino recién hecho', '3.dessert': 'Natillas de vainilla', '4.day': 'Viernes', '4.starter': 'Crema de calabaza', '4.main': 'Pesca del día', '4.side': 'Arroz basmati con guisantes', '4.dessert': 'Pastel tradicional' },
    teachers: { 'teach-1.title': 'Maestra de educación primaria', 'teach-1.bio': '12 años de experiencia en enseñanza primaria bilingüe (árabe/francés).', 'teach-2.title': 'Profesor de matemáticas y ciencias', 'teach-2.bio': 'Apasionado por el descubrimiento científico lúdico y el pensamiento lógico.' },
    admins: { 'admin-1.title': 'Fundador y Director General', 'admin-1.bio': 'Comprometido con la excelencia educativa y el desarrollo infantil desde la fundación de la escuela.', 'admin-2.title': 'Coordinadora pedagógica', 'admin-2.bio': 'Supervisa los programas bilingües y el seguimiento personalizado del alumnado.' },
    notifications: { 'n-1.title': 'Excursión escolar – Museo del Bardo', 'n-1.message': 'Recordatorio de la visita de este jueves.', 'n-1.time': 'Hace 10 min', 'n-2.title': 'Comedor La Toque Gourmande', 'n-2.message': 'El menú de esta semana ya está en línea.', 'n-2.time': 'Hace 1 hora' },
  },
  de: {
    announcements: {
      'ann-1.title': 'Bildungsausflug ins Bardo-Museum',
      'ann-1.body': 'Liebe Eltern, unser Besuch im Nationalmuseum von Bardo findet diesen Donnerstag statt. Bitte geben Sie den Schülern eine Trinkflasche und die offizielle Schulkleidung mit.',
      'ann-1.authorRole': 'Lehrkraft',
      'ann-2.title': 'Schuljahresauftakt und Gesundheitshinweise',
      'ann-2.body': 'Wichtige Erinnerung an die Bring- und Abholzeiten der Schüler. Bitte nutzen Sie die ausgewiesenen Parkflächen.',
      'ann-2.authorRole': 'Verwaltung',
    },
    homework: { 'hw-1.title': 'Mathematik: Bruchrechnungsübungen', 'hw-1.description': 'Bearbeite die Aufgaben 4, 5 und 6 auf Seite 42 des Rechenbuchs.', 'hw-2.title': 'Schreibaufgabe: Mein Lieblingstier', 'hw-2.description': 'Schreibe fünf Sätze auf Französisch über dein Lieblingstier.' },
    calendar: { 'cal-1.title': 'Diktat-Test', 'cal-1.description': 'Vorbereitetes Diktat mit den Wörtern aus Woche 8.', 'cal-1.category': 'TEST', 'cal-2.title': 'Lehrerkonferenz', 'cal-2.description': 'Monatliches Treffen des pädagogischen Teams.', 'cal-2.category': 'BESPRECHUNG' },
    menu: { 'menu-current.weekRange': '10. November – 14. November 2026', '0.day': 'Montag', '0.starter': 'Frischer tunesischer Salat', '0.main': 'Freilandhähnchen-Couscous', '0.side': 'Saisongemüse', '0.dessert': 'Obst der Saison', '0.notes': 'Mit Sorgfalt zubereitet von La Toque Gourmande', '1.day': 'Dienstag', '1.starter': 'Cremige Gemüsesuppe', '1.main': 'Paniertes Putenschnitzel', '1.side': 'Kartoffelpüree', '1.dessert': 'Bio-Naturjoghurt', '2.day': 'Mittwoch', '2.starter': 'Knuspriger Thunfisch-Brik', '2.main': 'Spaghetti Bolognese mit Parmesan', '2.side': 'Hausgemachte Tomatensauce', '2.dessert': 'Frischer Obstsalat', '3.day': 'Donnerstag', '3.starter': 'Grüner Salat mit Mais', '3.main': 'Milde Merguez-Ojja', '3.side': 'Frisches tunesisches Brot', '3.dessert': 'Vanillecreme', '4.day': 'Freitag', '4.starter': 'Kürbiscremesuppe', '4.main': 'Fang des Tages', '4.side': 'Basmatireis mit Erbsen', '4.dessert': 'Traditionelles Gebäck' },
    teachers: { 'teach-1.title': 'Grundschullehrerin', 'teach-1.bio': '12 Jahre Erfahrung im zweisprachigen Grundschulunterricht (Arabisch/Französisch).', 'teach-2.title': 'Mathematik- und Naturwissenschaftslehrer', 'teach-2.bio': 'Begeistert von spielerischer Naturwissenschaft und logischem Denken.' },
    admins: { 'admin-1.title': 'Gründer & Schulleiter', 'admin-1.bio': 'Seit der Schulgründung der pädagogischen Exzellenz und der Entwicklung der Kinder verpflichtet.', 'admin-2.title': 'Pädagogische Koordinatorin', 'admin-2.bio': 'Begleitet zweisprachige Programme und die individuelle Förderung der Schüler.' },
    notifications: { 'n-1.title': 'Schulausflug – Bardo-Museum', 'n-1.message': 'Erinnerung an den Besuch diesen Donnerstag.', 'n-1.time': 'Vor 10 Min.', 'n-2.title': 'Mensa La Toque Gourmande', 'n-2.message': 'Der Speiseplan dieser Woche ist online.', 'n-2.time': 'Vor 1 Std.' },
  },
  pt: {
    announcements: {
      'ann-1.title': 'Visita educativa ao Museu do Bardo',
      'ann-1.body': 'Caros pais, a nossa visita ao Museu Nacional do Bardo realiza-se esta quinta-feira. Enviem os alunos com garrafa de água e o uniforme escolar oficial.',
      'ann-1.authorRole': 'Docente',
      'ann-2.title': 'Encontro de regresso às aulas e orientações de saúde',
      'ann-2.body': 'Lembrete importante sobre os horários de entrada e saída dos alunos. Respeitem as zonas de estacionamento designadas.',
      'ann-2.authorRole': 'Administração',
    },
    homework: { 'hw-1.title': 'Matemática: exercícios de frações', 'hw-1.description': 'Complete os exercícios 4, 5 e 6 da página 42 do livro de aritmética.', 'hw-2.title': 'Trabalho escrito: o meu animal favorito', 'hw-2.description': 'Escreva cinco linhas em francês a descrever o seu animal favorito.' },
    calendar: { 'cal-1.title': 'Avaliação de ditado', 'cal-1.description': 'Ditado preparado com as palavras da semana 8.', 'cal-1.category': 'TESTE', 'cal-2.title': 'Reunião de docentes', 'cal-2.description': 'Reunião mensal da equipa pedagógica.', 'cal-2.category': 'REUNIÃO' },
    menu: { 'menu-current.weekRange': '10 de novembro – 14 de novembro de 2026', '0.day': 'Segunda-feira', '0.starter': 'Salada tunisina fresca', '0.main': 'Cuscuz de frango do campo', '0.side': 'Legumes da época', '0.dessert': 'Fruta da época', '0.notes': 'Preparado com cuidado por La Toque Gourmande', '1.day': 'Terça-feira', '1.starter': 'Sopa aveludada de legumes', '1.main': 'Escalope de peru panado', '1.side': 'Puré de batata', '1.dessert': 'Iogurte natural biológico', '2.day': 'Quarta-feira', '2.starter': 'Brik estaladiço de atum', '2.main': 'Esparguete à bolonhesa com parmesão', '2.side': 'Molho de tomate caseiro', '2.dessert': 'Salada de fruta fresca', '3.day': 'Quinta-feira', '3.starter': 'Salada verde e milho', '3.main': 'Ojja suave de merguez', '3.side': 'Pão tunisino fresco', '3.dessert': 'Creme de baunilha', '4.day': 'Sexta-feira', '4.starter': 'Velouté de abóbora', '4.main': 'Peixe do dia', '4.side': 'Arroz basmati com ervilhas', '4.dessert': 'Pastelaria tradicional' },
    teachers: { 'teach-1.title': 'Professora do ensino primário', 'teach-1.bio': '12 anos de experiência no ensino primário bilingue (árabe/francês).', 'teach-2.title': 'Professor de matemática e ciências', 'teach-2.bio': 'Apaixonado pela descoberta científica lúdica e pelo pensamento lógico.' },
    admins: { 'admin-1.title': 'Fundador e Diretor-Geral', 'admin-1.bio': 'Comprometido com a excelência educativa e o desenvolvimento das crianças desde a fundação da escola.', 'admin-2.title': 'Coordenadora pedagógica', 'admin-2.bio': 'Supervisiona os programas bilingues e o acompanhamento personalizado dos alunos.' },
    notifications: { 'n-1.title': 'Visita escolar – Museu do Bardo', 'n-1.message': 'Lembrete da visita desta quinta-feira.', 'n-1.time': 'Há 10 min', 'n-2.title': 'Cantina La Toque Gourmande', 'n-2.message': 'A ementa desta semana já está online.', 'n-2.time': 'Há 1 hora' },
  },
};

export function contentT(language: Language, section: string, id: string, field: string, fallback: string): string {
  return content[language]?.[section]?.[`${id}.${field}`] || fallback;
}
