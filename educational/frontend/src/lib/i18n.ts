// Multilingual i18n Translation Engine (English, Tamil, Hindi)
export type Language = 'en' | 'ta' | 'hi';

export const LANGUAGE_STORAGE_KEY = 'studymentor-selected-language';

export const getSelectedLanguage = (): Language => {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'ta' || saved === 'hi' || saved === 'en') {
      return saved;
    }
  } catch {
    /* ignore */
  }
  return 'en';
};

export const setSelectedLanguage = (lang: Language): void => {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    window.dispatchEvent(new Event('language-change'));
  } catch {
    /* ignore */
  }
};

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    nav_chat: 'Thambi Robo AI',
    nav_dashboard: 'Dashboard',
    nav_quiz: 'Practice',
    nav_data: 'Data Hub',
    nav_progress: 'Progress',
    nav_profile: 'Profile',
    nav_subtitle: 'AI Learning Platform',

    // Header & Brand
    brand_title: 'Sai Elite India Educational',
    guest_banner: 'Browsing in Guest Mode — Create an account to sync progress to cloud database.',
    sign_in: 'Sign In',

    // Chat Interface
    robo_counselor: 'Thambi Robo Counselor',
    robo_subtitle: 'Interactive 3D Study Mentor & Loving Robot Friend',
    btn_dance: '🕺 Dance for me!',
    btn_hug: '💖 Best Friend Hug',
    btn_sad: "😢 I'm feeling down...",
    btn_motivation: '💡 Study Motivation',
    status_ready: '🟢 Ready to listen & talk',
    status_speaking: '🗣️ Voice Synthesis Active...',
    status_thinking: '🧠 Thambi Robo is thinking...',
    status_dancing: '🕺 Thambi Robo is dancing to cheer you up!',
    status_comforting: '💖 Thambi Robo is comforting you with care...',
    status_love: '♥ Thambi Robo sends best-friend love!',
    placeholder_type_message: 'Ask Thambi Robo anything (Math, Physics, Exams)...',
    mic_listen: 'Listening to your voice...',

    // Dashboard
    welcome_back: 'Welcome back',
    command_center: 'AI Student Command Center',
    welcome_sub: 'Track real-time learning metrics, practice priority weak areas, and consult Thambi Robo for instant step-by-step guidance.',
    active_streak: 'Active Streak',
    total_xp: 'Total XP',
    strong_mastery: 'Strong Mastery',
    priority_practice: 'Priority Practice',
    quizzes_completed: 'Quizzes Completed',
    overall_accuracy: 'Overall Accuracy',
    priority_focus_areas: 'Priority Focus Areas',
    curriculum_subjects: 'Curriculum Subjects',
    daily_quests_title: 'Daily Quests & XP Rewards',
    resets_daily: 'Resets Daily',
    claim_xp: 'Claim XP',
    claimed: 'Claimed',

    // Ranks
    rank_level_1: 'Level 1 • Junior Cadet',
    rank_level_2: 'Level 2 • AI Explorer',
    rank_level_3: 'Level 3 • STEM Prodigy',
    rank_level_4: 'Level 4 • Robotics Specialist',
    rank_level_5: 'Level 5 • Master Scholar',

    // Pomodoro Timer
    pomodoro_title: '⏱️ Pomodoro Study Focus',
    pomodoro_sub: 'Boost focus with timed 25-minute learning sessions.',
    timer_paused: 'Paused / Ready',
    timer_active: '⚡ Focus Session Active',
    btn_start_focus: 'Start Focus',
    btn_pause_focus: 'Pause Session',

    // Subject Card & Quiz
    quizzes_taken: 'Quizzes Taken',
    avg_accuracy: 'Avg Accuracy',
    start_quiz: 'Start Quiz',
    practice_now: 'Practice Now',
    question: 'Question',
    of: 'of',
    next_question: 'Next Question',
    submit_quiz: 'Submit Quiz',
    quiz_completed: 'Quiz Completed!',
    your_score: 'Your Score',
    retake_quiz: 'Retake Quiz',
    back_to_dashboard: 'Back to Dashboard',
    explanation: 'Explanation',

    // Data Hub
    data_hub_title: 'STEM Knowledge Base & File Vault',
    upload_files: 'Upload STEM Files',
    drop_files_here: 'Drop files here or click to browse (PDF, TXT, DOCX)',
    file_name: 'File Name',
    category: 'Category',
    size: 'Size',
    uploaded_date: 'Uploaded Date',
    action: 'Action',
    delete: 'Delete',
    download: 'Download',
    edit: 'Edit',

    // Profile & Progress
    my_profile: 'My Student Profile',
    edit_profile: 'Edit Profile',
    save_changes: 'Save Changes',
    cancel: 'Cancel',
    badges_earned: 'Badges Earned',
    unlocked: 'Unlocked',
    locked: 'Locked',
    learning_progress: 'Learning Progress & Mastery',
  },

  ta: {
    // Navigation (Tamil / தமிழ்)
    nav_chat: 'தம்பி ரோபோ AI',
    nav_dashboard: 'டாஷ்போர்டு',
    nav_quiz: 'பயிற்சி',
    nav_data: 'தரவு மையம்',
    nav_progress: 'முன்னேற்றம்',
    nav_profile: 'சுயவிவரம்',
    nav_subtitle: 'AI கற்றல் தளம்',

    // Header & Brand
    brand_title: 'சாய் எலைட் இந்தியா கல்வி',
    guest_banner: 'விருந்தினர் முறையில் உலாவுகிறீர்கள் — மேகக்கணி தரவுத்தளத்தில் முன்னேற்றத்தைச் சேமிக்க கணக்கை உருவாக்கவும்.',
    sign_in: 'உள்நுழைக',

    // Chat Interface
    robo_counselor: 'தம்பி ரோபோ ஆலோசகர்',
    robo_subtitle: 'ஊடாடும் 3D படிப்பு வழிகாட்டி மற்றும் அன்பு ரோபோ நண்பன்',
    btn_dance: '🕺 எனக்காக நடனமாடு!',
    btn_hug: '💖 சிறந்த நண்பன் கட்டிப்பிடி',
    btn_sad: '😢 நான் மனச்சோர்வாக உணர்கிறேன்...',
    btn_motivation: '💡 படிப்பு ஊக்கம்',
    status_ready: '🟢 கேட்க மற்றும் பேச தயார்',
    status_speaking: '🗣️ குரல் தொடர்பு செயலில் உள்ளது...',
    status_thinking: '🧠 தம்பி ரோபோ சிந்திக்கிறது...',
    status_dancing: '🕺 உங்களை மகிழ்விக்க தம்பி ரோபோ நடனமாடுகிறது!',
    status_comforting: '💖 தம்பி ரோபோ உங்களுக்கு ஆறுதல் அளிக்கிறது...',
    status_love: '♥ தம்பி ரோபோ அன்பைப் பகிர்கிறது!',
    placeholder_type_message: 'தம்பி ரோபோவிடம் எதுவேண்டுமானாலும் கேளுங்கள் (கணிதம், இயற்பியல்)...',
    mic_listen: 'உங்கள் குரலைக் கேட்கிறது...',

    // Dashboard
    welcome_back: 'மீண்டும் வருக',
    command_center: 'AI மாணவர் கட்டளை மையம்',
    welcome_sub: 'நேரலை கற்றல் அளவீடுகளைக் கண்காணிக்கவும், பலவீனமான பகுதிகளைப் பயிற்சி செய்யவும்.',
    active_streak: 'செயலில் உள்ள நாட்கள்',
    total_xp: 'மொத்த XP புள்ளிகள்',
    strong_mastery: 'சிறந்த தேர்ச்சி',
    priority_practice: 'முன்னுரிமை பயிற்சி',
    quizzes_completed: 'முடிந்த வினாடி வினாக்கள்',
    overall_accuracy: 'ஒட்டுமொத்த துல்லியம்',
    priority_focus_areas: 'முன்னுரிமை கவனம் செலுத்தும் பகுதிகள்',
    curriculum_subjects: 'பாடத்திட்ட பாடங்கள்',
    daily_quests_title: 'தினசரி சவால்கள் & XP வெகுமதிகள்',
    resets_daily: 'தினமும் புதுப்பிக்கப்படும்',
    claim_xp: 'XP பெறுங்கள்',
    claimed: 'பெறப்பட்டது',

    // Ranks
    rank_level_1: 'நிலை 1 • இளைய மாணவர்',
    rank_level_2: 'நிலை 2 • AI ஆராய்ச்சியாளர்',
    rank_level_3: 'நிலை 3 • STEM நிபுணர்',
    rank_level_4: 'நிலை 4 • ரோபாட்டிக்ஸ் வல்லுநர்',
    rank_level_5: 'நிலை 5 • தலைமை அறிஞர்',

    // Pomodoro Timer
    pomodoro_title: '⏱️ போமோடோரோ படிப்பு கவனம்',
    pomodoro_sub: '25 நிமிட படிப்பு அமர்வுகளுடன் கவனத்தை அதிகரிக்கவும்.',
    timer_paused: 'நிறுத்தப்பட்டது / தயார்',
    timer_active: '⚡ படிப்பு அமர்வு செயலில் உள்ளது',
    btn_start_focus: 'கவனத்தைத் தொடங்கு',
    btn_pause_focus: 'அமர்வை நிறுத்து',

    // Subject Card & Quiz
    quizzes_taken: 'எடுத்த வினாடி வினாக்கள்',
    avg_accuracy: 'சராசரி துல்லியம்',
    start_quiz: 'வினாடி வினா தொடங்கு',
    practice_now: 'இப்போது பயிற்சி செய்',
    question: 'கேள்வி',
    of: 'இல்',
    next_question: 'அடுத்த கேள்வி',
    submit_quiz: 'பதிலைச் சமர்ப்பி',
    quiz_completed: 'வினாடி வினா முடிந்தது!',
    your_score: 'உங்கள் மதிப்பெண்',
    retake_quiz: 'மீண்டும் முயல்க',
    back_to_dashboard: 'டாஷ்போர்டிற்குத் திரும்பு',
    explanation: 'விளக்கம்',

    // Data Hub
    data_hub_title: 'STEM அறிவு தளம் & கோப்பு பெட்டகம்',
    upload_files: 'STEM கோப்புகளைப் பதிவேற்றுங்கள்',
    drop_files_here: 'கோப்புகளை இங்கே விடவும் அல்லது கிளிக் செய்யவும் (PDF, TXT, DOCX)',
    file_name: 'கோப்பின் பெயர்',
    category: 'வகை',
    size: 'அளவு',
    uploaded_date: 'பதிவேற்றிய தேதி',
    action: 'செயல்',
    delete: 'நீக்கு',
    download: 'பதிவிறக்கு',
    edit: 'திருத்து',

    // Profile & Progress
    my_profile: 'எனது மாணவர் சுயவிவரம்',
    edit_profile: 'சுயவிவரத்தைத் திருத்து',
    save_changes: 'மாற்றங்களைச் சேமி',
    cancel: 'ரத்து செய்',
    badges_earned: 'பெறப்பட்ட பேட்ஜ்கள்',
    unlocked: 'திறக்கப்பட்டது',
    locked: 'பூட்டப்பட்டது',
    learning_progress: 'கற்றல் முன்னேற்றம் & தேர்ச்சி',
  },

  hi: {
    // Navigation (Hindi / हिंदी)
    nav_chat: 'थम्बी रोबो AI',
    nav_dashboard: 'डैशबोर्ड',
    nav_quiz: 'अभ्यास',
    nav_data: 'डेटा हब',
    nav_progress: 'प्रगति',
    nav_profile: 'प्रोफ़ाइल',
    nav_subtitle: 'AI लर्निंग प्लेटफॉर्म',

    // Header & Brand
    brand_title: 'साई एलीट इंडिया एजुकेशनल',
    guest_banner: 'आप गेस्ट मोड में ब्राउज़ कर रहे हैं — प्रोग्रेस सेव करने के लिए अकाउंट बनाएं।',
    sign_in: 'साइन इन करें',

    // Chat Interface
    robo_counselor: 'थम्बी रोबो काउंसलर',
    robo_subtitle: 'इंटरएक्टिव 3D स्टडी मेंटर और प्यारा रोबोट दोस्त',
    btn_dance: '🕺 मेरे लिए डांस करो!',
    btn_hug: '💖 बेस्ट फ्रेंड हग',
    btn_sad: '😢 मैं उदास महसूस कर रहा हूं...',
    btn_motivation: '💡 स्टडी मोटिवेशन',
    status_ready: '🟢 सुनने और बोलने के लिए तैयार',
    status_speaking: '🗣️ वॉयस सिंथेसिस सक्रिय...',
    status_thinking: '🧠 थम्बी रोबो सोच रहा है...',
    status_dancing: '🕺 थम्बी रोबो आपको खुश करने के लिए डांस कर रहा है!',
    status_comforting: '💖 थम्बी रोबो आपको सांत्वना दे रहा है...',
    status_love: '♥ थम्बी रोबो प्यार भेज रहा है!',
    placeholder_type_message: 'थम्बी रोबो से कुछ भी पूछें (गणित, भौतिकी, परीक्षा)...',
    mic_listen: 'आपकी आवाज सुन रहा है...',

    // Dashboard
    welcome_back: 'वापसी पर स्वागत है',
    command_center: 'AI स्टूडेंट कमांड सेंटर',
    welcome_sub: 'रियल-टाइम लर्निंग मेट्रिक्स ट्रैक करें और कमजोर विषयों का अभ्यास करें।',
    active_streak: 'सक्रिय स्ट्राइक',
    total_xp: 'कुल XP पॉइंट्स',
    strong_mastery: 'उत्कृष्ट महारत',
    priority_practice: 'प्राथमिकता अभ्यास',
    quizzes_completed: 'पूर्ण क्विज़',
    overall_accuracy: 'कुल सटीकता',
    priority_focus_areas: 'प्राथमिकता ध्यान क्षेत्र',
    curriculum_subjects: 'पाठ्यक्रम के विषय',
    daily_quests_title: 'डेली क्वेस्ट्स और XP रिवार्ड्स',
    resets_daily: 'रोजाना रीसेट होता है',
    claim_xp: 'XP क्लेम करें',
    claimed: 'क्लेम किया गया',

    // Ranks
    rank_level_1: 'लेवल 1 • जूनियर कैडेट',
    rank_level_2: 'लेवल 2 • AI एक्सप्लोरर',
    rank_level_3: 'लेवल 3 • STEM प्रोडीजी',
    rank_level_4: 'लेवल 4 • रोबोटिक्स स्पेशलिस्ट',
    rank_level_5: 'लेवल 5 • मास्टर स्कॉलर',

    // Pomodoro Timer
    pomodoro_title: '⏱️ पोमोडोरो स्टडी फोकस',
    pomodoro_sub: '25 मिनट के अध्ययन सत्रों के साथ ध्यान केंद्रित करें।',
    timer_paused: 'रुका हुआ / तैयार',
    timer_active: '⚡ फोकस सेशन एक्टिव',
    btn_start_focus: 'फोकस शुरू करें',
    btn_pause_focus: 'सेशन रोकें',

    // Subject Card & Quiz
    quizzes_taken: 'दिए गए क्विज़',
    avg_accuracy: 'औसत सटीकता',
    start_quiz: 'क्विज़ शुरू करें',
    practice_now: 'अभी अभ्यास करें',
    question: 'प्रश्न',
    of: 'का',
    next_question: 'अगला प्रश्न',
    submit_quiz: 'उत्तर सबमिट करें',
    quiz_completed: 'क्विज़ पूरा हुआ!',
    your_score: 'आपका स्कोर',
    retake_quiz: 'पुनः प्रयास करें',
    back_to_dashboard: 'डैशबोर्ड पर वापस जाएं',
    explanation: 'व्याख्या',

    // Data Hub
    data_hub_title: 'STEM नॉलेज बेस और फ़ाइल वॉल्ट',
    upload_files: 'STEM फ़ाइलें अपलोड करें',
    drop_files_here: 'फ़ाइलें यहाँ छोड़ें या ब्राउज़ करने के लिए क्लिक करें (PDF, TXT, DOCX)',
    file_name: 'फ़ाइल का नाम',
    category: 'श्रेणी',
    size: 'आकार',
    uploaded_date: 'अपलोड की तारीख',
    action: 'कार्रवाई',
    delete: 'हटाएं',
    download: 'डाउनलोड',
    edit: 'संपादित करें',

    // Profile & Progress
    my_profile: 'मेरी छात्र प्रोफ़ाइल',
    edit_profile: 'प्रोफ़ाइल संपादित करें',
    save_changes: 'सहेजें',
    cancel: 'रद्द करें',
    badges_earned: 'अर्जित बैज',
    unlocked: 'अनलॉक किया गया',
    locked: 'लॉक किया गया',
    learning_progress: 'सीखने की प्रगति और महारत',
  },
};

// Auto-Translate Helper Function with Dynamic Language Fallback
export const t = (key: string, lang: Language = getSelectedLanguage(), defaultText?: string): string => {
  const dict = translations[lang] || translations['en'];
  if (dict[key]) {
    return dict[key];
  }
  const enDict = translations['en'];
  if (enDict[key]) {
    return enDict[key];
  }
  return defaultText || key;
};

// Convert Speech Recognition & Synthesis Language Code
export const getSpeechLanguageCode = (lang: Language): string => {
  switch (lang) {
    case 'ta':
      return 'ta-IN';
    case 'hi':
      return 'hi-IN';
    default:
      return 'en-US';
  }
};
