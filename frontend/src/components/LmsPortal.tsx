import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, 
  BookOpen, 
  PlayCircle, 
  CheckCircle2, 
  Clock, 
  Star, 
  UserCheck, 
  Search, 
  Sparkles, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Cpu, 
  Award, 
  ArrowLeft, 
  Lock, 
  HelpCircle, 
  Printer, 
  Check, 
  BookMarked,
  BrainCircuit
} from 'lucide-react';
import { mockCourses, Course, Lesson, CourseModule } from '../data/lmsData';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface LmsPortalProps {
  onOpenAiChat?: (initialPrompt: string) => void;
}

export const LmsPortal: React.FC<LmsPortalProps> = ({ onOpenAiChat }) => {
  const [courses] = useState<Course[]>(mockCourses);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Active state for viewing a specific course player
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({ 'mod-1': true, 'mod-ai-1': true, 'mod-phy-1': true, 'mod-math-1': true });

  // Store completed lessons in localStorage
  const [completedLessonIds, setCompletedLessonIds] = useLocalStorage<string[]>('saielite_lms_completed_lessons', ['les-1-1']);

  // Certificate Modal State
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);

  // AI Assistant Quick Ask Drawer State
  const [aiPromptInput, setAiPromptInput] = useState<string>('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Filter courses based on category and search
  const filteredCourses = courses.filter(c => {
    const matchesCat = selectedCategory === 'All' || c.category === selectedCategory;
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Calculate course completion progress
  const getCourseProgress = (course: Course) => {
    const allLessons = course.modules.flatMap(m => m.lessons);
    if (allLessons.length === 0) return 0;
    const completedCount = allLessons.filter(l => completedLessonIds.includes(l.id)).length;
    return Math.round((completedCount / allLessons.length) * 100);
  };

  const handleStartCourse = (course: Course) => {
    setActiveCourse(course);
    // Default to first lesson of first module
    if (course.modules.length > 0 && course.modules[0].lessons.length > 0) {
      setActiveLesson(course.modules[0].lessons[0]);
    }
  };

  const toggleModule = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const toggleLessonComplete = (lessonId: string) => {
    setCompletedLessonIds(prev => {
      if (prev.includes(lessonId)) {
        return prev.filter(id => id !== lessonId);
      } else {
        return [...prev, lessonId];
      }
    });
  };

  const handleAskThambiAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPromptInput.trim() || !activeLesson) return;

    setIsAiLoading(true);
    setAiAnswer(null);

    // Provide a smart local answer immediately while referencing the lesson
    setTimeout(() => {
      setAiAnswer(`Based on lesson "${activeLesson.title}":\n\n${aiPromptInput} is directly related to our core control principles. In this module, remember that hardware sensors stream telemetry data at real-time baud rates. For deeper calculations, try adjusting the PID Kp gain constant or checking the timing interrupts!`);
      setIsAiLoading(false);
    }, 900);
  };

  const categories = ['All', 'Robotics', 'Computer Science', 'Physics', 'Mathematics'];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Top Banner Header */}
      {!activeCourse && (
        <div className="max-w-7xl mx-auto mb-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-950 via-slate-900 to-purple-950 border border-cyan-500/30 p-6 sm:p-10 shadow-2xl">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-3">
                  <GraduationCap className="w-4 h-4" /> Next-Gen STEM LMS Portal
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  Master Robotics, AI & Engineering Courses
                </h1>
                <p className="text-slate-400 text-sm sm:text-base mt-2 max-w-2xl">
                  Structured interactive curriculums, hands-on lab projects, video lectures, and AI-powered doubt solving tailored for students.
                </p>
              </div>

              <div className="flex items-center gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 backdrop-blur-xl">
                <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-xl">
                  <Award className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">Completed Lessons</div>
                  <div className="text-2xl font-black text-white">{completedLessonIds.length} Finished</div>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Category Filter Navigation */}
          <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20'
                      : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search courses or topics..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Course Catalog Grid View */}
      {!activeCourse ? (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map(course => {
            const progress = getCourseProgress(course);
            const isCompleted = progress === 100;
            return (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative flex flex-col bg-slate-900/90 border border-slate-800/80 rounded-3xl overflow-hidden hover:border-cyan-500/40 transition-all duration-300 shadow-xl"
              >
                {/* Course Cover Image Header */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={course.coverImage}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  
                  {/* Category & Level Badges */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-bold text-cyan-400">
                      {course.category}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-bold text-purple-400">
                      {course.level}
                    </span>
                  </div>

                  {/* Rating Pill */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md text-amber-400 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    {course.rating}
                  </div>
                </div>

                {/* Course Details Content */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-2">
                      {course.title}
                    </h3>
                    <p className="text-slate-400 text-xs mt-2 line-clamp-2 leading-relaxed">
                      {course.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" /> {course.duration}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-purple-400" /> {course.enrolledCount} enrolled
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar & Actions */}
                  <div className="mt-6">
                    <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                      <span className="text-slate-400">Course Progress</span>
                      <span className="text-cyan-400">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500" 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>

                    <button
                      onClick={() => handleStartCourse(course)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        isCompleted
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30'
                          : progress > 0
                          ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-lg shadow-cyan-500/20'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <Award className="w-4 h-4 text-purple-400" /> Course Completed (Review)
                        </>
                      ) : progress > 0 ? (
                        <>
                          <PlayCircle className="w-4 h-4" /> Continue Course ({progress}%)
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-4 h-4" /> Start Course
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Active LMS Course Player View */
        <div className="max-w-7xl mx-auto">
          {/* Back to Catalog Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setActiveCourse(null)}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800"
            >
              <ArrowLeft className="w-4 h-4" /> Back to LMS Catalog
            </button>

            {getCourseProgress(activeCourse) === 100 && (
              <button
                onClick={() => setShowCertificateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-xs font-extrabold shadow-lg shadow-amber-500/20 hover:brightness-110 transition-all"
              >
                <Award className="w-4 h-4" /> View Course Certificate
              </button>
            )}
          </div>

          {/* Main Course Player Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Sidebar: Curriculum Modules & Lessons */}
            <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 h-fit shadow-xl">
              <div className="mb-4 pb-3 border-b border-slate-800">
                <h2 className="text-base font-extrabold text-white leading-tight">
                  {activeCourse.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span className="text-cyan-400 font-semibold">{getCourseProgress(activeCourse)}% Completed</span>
                  <span>•</span>
                  <span>{activeCourse.duration}</span>
                </div>
              </div>

              {/* Modules Accordion */}
              <div className="space-y-3">
                {activeCourse.modules.map(mod => {
                  const isExpanded = expandedModules[mod.id] ?? true;
                  return (
                    <div key={mod.id} className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
                      <button
                        onClick={() => toggleModule(mod.id)}
                        className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-slate-200 hover:bg-slate-800/50 transition-colors"
                      >
                        <span className="line-clamp-1">{mod.title}</span>
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-cyan-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                      </button>

                      {isExpanded && (
                        <div className="p-1.5 space-y-1 border-t border-slate-800/60 bg-slate-900/40">
                          {mod.lessons.map(les => {
                            const isCurrent = activeLesson?.id === les.id;
                            const isDone = completedLessonIds.includes(les.id);
                            return (
                              <button
                                key={les.id}
                                onClick={() => setActiveLesson(les)}
                                className={`w-full p-2.5 rounded-xl text-left text-xs font-medium flex items-center justify-between transition-all ${
                                  isCurrent
                                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 font-bold'
                                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  {isDone ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                  ) : isCurrent ? (
                                    <PlayCircle className="w-4 h-4 text-cyan-400 flex-shrink-0 animate-pulse" />
                                  ) : (
                                    <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                  )}
                                  <span className="truncate">{les.title}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 flex-shrink-0">{les.duration}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Main Stage: Active Lesson Content Viewer */}
            <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between">
              {activeLesson ? (
                <div>
                  {/* Lesson Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                    <div>
                      <div className="inline-flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">
                        <BookMarked className="w-3.5 h-3.5" /> Active Lesson
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white">
                        {activeLesson.title}
                      </h2>
                    </div>

                    <button
                      onClick={() => toggleLessonComplete(activeLesson.id)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                        completedLessonIds.includes(activeLesson.id)
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-lg shadow-cyan-500/20'
                      }`}
                    >
                      {completedLessonIds.includes(activeLesson.id) ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Lesson Finished
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" /> Mark as Completed
                        </>
                      )}
                    </button>
                  </div>

                  {/* Video Stream Player if Lesson Type is Video */}
                  {activeLesson.type === 'video' && activeLesson.videoUrl && (
                    <div className="my-6 aspect-video rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
                      <iframe
                        src={activeLesson.videoUrl}
                        title={activeLesson.title}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    </div>
                  )}

                  {/* Lesson Text Content */}
                  <div className="mt-6 prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-4">
                    <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80">
                      {activeLesson.content.split('\n\n').map((paragraph, idx) => (
                        <p key={idx} className="mb-3 text-slate-300 leading-relaxed">
                          {paragraph}
                        </p>
                      ))}
                    </div>

                    {/* Code Snippet Box if available */}
                    {activeLesson.codeSnippet && (
                      <div className="mt-4 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                        <div className="px-4 py-2 bg-slate-900 text-xs font-mono text-cyan-400 border-b border-slate-800 flex justify-between items-center">
                          <span>Embedded Code Snippet</span>
                          <span>C++ / Python</span>
                        </div>
                        <pre className="p-4 text-xs font-mono text-cyan-300 overflow-x-auto">
                          <code>{activeLesson.codeSnippet}</code>
                        </pre>
                      </div>
                    )}

                    {/* Key Takeaways Callout Box */}
                    {activeLesson.keyTakeaways && activeLesson.keyTakeaways.length > 0 && (
                      <div className="mt-6 p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30">
                        <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Sparkles className="w-4 h-4" /> Key Lesson Takeaways
                        </h4>
                        <ul className="space-y-2">
                          {activeLesson.keyTakeaways.map((takeaway, idx) => (
                            <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                              <span className="text-cyan-400 font-bold">•</span>
                              <span>{takeaway}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Integrated Ask Thambi AI Drawer / Form */}
                  <div className="mt-8 p-5 rounded-2xl bg-slate-950/90 border border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-400 mb-3">
                      <BrainCircuit className="w-4 h-4" /> Ask Thambi Robo AI about this Lesson
                    </div>

                    <form onSubmit={handleAskThambiAi} className="flex gap-2">
                      <input
                        type="text"
                        placeholder={`Ask a question about ${activeLesson.title}...`}
                        value={aiPromptInput}
                        onChange={e => setAiPromptInput(e.target.value)}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="submit"
                        disabled={isAiLoading}
                        className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 disabled:opacity-50 transition-colors flex items-center gap-2"
                      >
                        {isAiLoading ? 'Analyzing...' : 'Ask AI'}
                      </button>
                    </form>

                    {aiAnswer && (
                      <div className="mt-4 p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs text-purple-200 leading-relaxed">
                        {aiAnswer}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-slate-500">
                  Select a lesson from the curriculum sidebar to begin learning.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable Course Completion Certificate Modal */}
      {showCertificateModal && activeCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-8 shadow-2xl text-center">
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setShowCertificateModal(false)}
                className="text-slate-400 hover:text-white p-2"
              >
                ✕
              </button>
            </div>

            <div className="inline-flex p-3 bg-amber-500/20 text-amber-400 rounded-full mb-4">
              <Award className="w-12 h-12" />
            </div>

            <div className="uppercase tracking-widest text-xs font-bold text-amber-400 mb-2">
              Official Certificate of Mastery
            </div>

            <h2 className="text-2xl font-black text-white mb-4">
              Sai Elite India Educational Platform
            </h2>

            <p className="text-slate-400 text-xs mb-6">
              This is to certify that the student has successfully completed 100% of the curriculum for:
            </p>

            <div className="py-4 px-6 rounded-2xl bg-slate-950 border border-amber-500/30 text-amber-300 font-bold text-lg mb-6">
              {activeCourse.title}
            </div>

            <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-800 pt-4 mb-6">
              <div>
                <div>Issued By: Sai Elite AI Lab</div>
                <div>Instructor: {activeCourse.instructor}</div>
              </div>
              <div className="text-right">
                <div>Date: {new Date().toLocaleDateString()}</div>
                <div>ID: CERT-{Math.random().toString(36).substring(2, 9).toUpperCase()}</div>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-2 hover:bg-amber-400 transition-colors"
            >
              <Printer className="w-4 h-4" /> Print / Save Certificate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
