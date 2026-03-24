import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, FileText, Brain, LayoutDashboard, 
  CheckCircle, XCircle, AlertCircle, ChevronRight, 
  Plus, FileQuestion, ArrowRight, Loader2, RefreshCw,
  GraduationCap, Target, Zap, MessageCircle, Calendar, Send,
  UserCircle, CheckSquare, Square,
  Award, Timer, Flag, ChevronLeft, Sparkles, Star, Trophy, Crown, 
  Layers, Map, BarChart2, RefreshCcw, Play, Search, Filter, SortDesc,
  Edit3, Trash2, Edit, FolderPlus, List as ListIcon, Save, Folder,
  Settings, Key, Cloud
} from 'lucide-react';

// === Firebase Imports ===
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";

// === Firebase Initialization ===
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// ==========================================
// サウンドユーティリティ (Web Audio API)
// ==========================================
let audioCtx;
const playSound = (type) => {
  try {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const playTone = (freq, oscType, time, vol = 0.1) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = oscType;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + time);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + time);
    };

    if (type === 'click') {
      playTone(800, 'sine', 0.05, 0.02);
    } else if (type === 'start') {
      playTone(440, 'sine', 0.1, 0.05);
      setTimeout(() => playTone(880, 'sine', 0.2, 0.05), 100);
    } else if (type === 'correct') {
      playTone(880, 'sine', 0.1, 0.1);
      setTimeout(() => playTone(1108.73, 'sine', 0.3, 0.1), 100);
    } else if (type === 'incorrect') {
      playTone(250, 'triangle', 0.2, 0.1);
      setTimeout(() => playTone(200, 'triangle', 0.3, 0.1), 150);
    } else if (type === 'fanfare') {
      playTone(523.25, 'sine', 0.15, 0.1); 
      setTimeout(() => playTone(659.25, 'sine', 0.15, 0.1), 150); 
      setTimeout(() => playTone(783.99, 'sine', 0.15, 0.1), 300); 
      setTimeout(() => playTone(1046.50, 'sine', 0.5, 0.15), 450); 
    }
  } catch(e) { console.log("Audio not supported"); }
};

// ==========================================
// 紙吹雪エフェクトコンポーネント
// ==========================================
const Confetti = () => {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    const colors = ['#fce18a', '#ff726d', '#b48def', '#f4306d', '#3b82f6', '#10b981'];
    const newPieces = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      animationDuration: `${Math.random() * 3 + 2}s`,
      animationDelay: `${Math.random() * 0.5}s`,
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      transform: `rotate(${Math.random() * 360}deg)`,
      width: `${Math.random() * 8 + 6}px`,
      height: `${Math.random() * 16 + 8}px`,
    }));
    setPieces(newPieces);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {pieces.map(p => (
        <div 
          key={p.id}
          className="absolute opacity-0 rounded-sm"
          style={{
            left: p.left,
            width: p.width,
            height: p.height,
            backgroundColor: p.backgroundColor,
            animation: `fall ${p.animationDuration} linear ${p.animationDelay} forwards`,
            transform: p.transform
          }}
        />
      ))}
    </div>
  );
};

// 精度向上のための共通AI指示
const AI_STRICT_RULES = `
【厳守事項】
1. 解答の正確性: 生成した問題と解答に論理的・計算的な誤りがないか厳密にダブルチェックしてください。
2. 問題の制約: 図形や画像がないと解けない問題は絶対に避け、テキスト・数式のみで完全に状況が把握し解答できる問題のみを出題してください。
3. 出力サイズ制限: システムの文字数制限による出力の途切れを防ぐため、解説文は長文を避け、1〜2文程度で極力簡潔に出力してください。
`;

// API制限時(401)用のモックデータ生成関数
const getMockData = (isJson, schemaType) => {
  if (!isJson) return "【API通信制限中】現在AIサーバーへの接続が制限されています(401エラー)。\n設定⚙️からご自身のGemini APIキーを入力することでこの制限を解除できます。";
  if (schemaType === 'quiz') return [{ id: Date.now(), question: "【API制限中】設定からAPIキーを入力してください。日本の首都は？", options: [{ text: "東京都", errorCategory: "correct" }, { text: "大阪府", errorCategory: "concept" }, { text: "京都府", errorCategory: "prerequisite" }, { text: "北海道", errorCategory: "careless" }], answer: "東京都", explanation: "APIキーを設定すると、正常に問題が生成されます。", weaknessTag: "システム設定" }];
  if (schemaType === 'exam') return [{ id: Date.now(), theme: "【API制限中】設定画面からAPIキーを入力してください。", questions: [{ id: Date.now()+1, question: "API制限を解除するには？", options: [{ text: "設定画面からAPIキーを入力", errorCategory: "correct" }, { text: "諦める", errorCategory: "careless" }, { text: "アプリを消す", errorCategory: "concept" }, { text: "祈る", errorCategory: "reading" }], answer: "設定画面からAPIキーを入力", explanation: "キーを設定することで正常動作します。", weaknessTag: "システム設定" }] }];
  if (schemaType === 'flashcards') return [{ front: "【通信エラー】", back: "設定画面からAPIキーを入力してください。" }, { front: "API Key", back: "システムを利用するための鍵。" }];
  return [];
};

// --- API連携関数 ---
const generateGeminiContent = async (prompt, isJson = false, schemaType = 'quiz') => {
  const userKey = localStorage.getItem('gemini_api_key');
  const actualKey = userKey || "";
  const modelName = userKey ? "gemini-2.5-flash" : "gemini-2.5-flash-preview-09-2025";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${actualKey}`;
  
  const payload = { 
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: AI_STRICT_RULES }] }
  };

  if (isJson) {
    if (schemaType !== 'flashcards') {
        payload.contents[0].parts[0].text += `\n\n【重要: 出力フォーマット】
以下の条件に必ず従い、純粋なJSON配列（ARRAY）のみを出力してください。マークダウン(\`\`\`jsonなど)や説明文は一切含めないでください。

[要求するオブジェクトの構造例（${schemaType === 'exam' ? '模試' : 'クイズ'}用）]
{
  "id": 数値,
  ${schemaType === 'exam' ? '"theme": "共通のテーマや長文",\n  "questions": [以下の構造の配列]' : ''}
  "question": "問題文",
  "options": [
    { "text": "選択肢1", "errorCategory": "correct" },
    { "text": "選択肢2", "errorCategory": "concept" },
    { "text": "選択肢3", "errorCategory": "prerequisite" },
    { "text": "選択肢4", "errorCategory": "careless" }
  ],
  "answer": "正解の選択肢のtextと完全一致する文字列",
  "explanation": "解説文",
  "weaknessTag": "弱点タグ"
}`;
    }
  }

  let lastError;
  const retries = [1000, 2000, 4000];
  for (let i = 0; i < retries.length; i++) {
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errMsg = errorData.error?.message || response.statusText || "Unknown error";
          throw new Error(`API Error (${response.status}): ${errMsg}`);
      }
      const data = await response.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) throw new Error("API returned empty response");

      if (isJson) {
        text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const match = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
        if (match) text = match[0];
        
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : (parsed.items || []);
      }
      return text;
    } catch (e) {
      lastError = e;
      if (e.message && (e.message.includes('401') || e.message.includes('403') || e.message.includes('400'))) {
        if (!userKey) {
          console.warn("API Auth Error detected. Using mock data fallback.");
          return getMockData(isJson, schemaType);
        } else {
          throw new Error("入力されたAPIキーが無効、またはアクセス制限にかかっています。設定からキーを確認してください。");
        }
      }
      if (i === retries.length - 1) throw e;
      await new Promise(r => setTimeout(r, retries[i]));
    }
  }
  throw lastError;
};

const SUBJECTS = ['国語', '算数・数学', '理科', '社会', '英語', '情報'];
const GRADES = ['小学4年', '小学5年', '小学6年', '中学1年', '中学2年', '中学3年', '高校1年', '高校2年', '高校3年'];

export default function App() {
  // === Firebase Auth State ===
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState(null); // null means loading profile

  const [userProfile, setUserProfile] = useState({ 
    username: '',
    grade: '中学1年', 
    strongSubjects: [], 
    weakSubjects: [], 
    goals: [], 
    notePreference: '' 
  });
  const [newGoalInput, setNewGoalInput] = useState('');
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [weaknesses, setWeaknesses] = useState([]);
  const [mistakes, setMistakes] = useState([]); 
  const [stats, setStats] = useState({ totalQuestions: 0, correctAnswers: 0 });
  const [errorStats, setErrorStats] = useState({ concept: 0, prerequisite: 0, careless: 0, reading: 0 });
  const [activityLog, setActivityLog] = useState([
    { day: '月', count: 0 }, { day: '火', count: 0 }, { day: '水', count: 0 },
    { day: '木', count: 0 }, { day: '金', count: 0 }, { day: '土', count: 0 }, { day: '日', count: 0 }
  ]);
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  
  const [hasDoneRevenge, setHasDoneRevenge] = useState(false);
  const [hasDoneExam, setHasDoneExam] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(localStorage.getItem('gemini_api_key') || '');

  const [folders, setFolders] = useState(['未分類', '定期テスト', '受験対策']);
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [materials, setMaterials] = useState([]);
  const [activeMaterialId, setActiveMaterialId] = useState(null);
  const [noteViewState, setNoteViewState] = useState('list');
  const [newMatTitle, setNewMatTitle] = useState('');
  const [newMatSubject, setNewMatSubject] = useState(SUBJECTS[0]);
  const [newMatFolder, setNewMatFolder] = useState('未分類');
  const [newMatContent, setNewMatContent] = useState('');
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false); 
  const [editNoteData, setEditNoteData] = useState(null);
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [filterNoteFolder, setFilterNoteFolder] = useState('すべて');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('すべて');
  const [sortOrder, setSortOrder] = useState('newest');

  const [flashcards, setFlashcards] = useState([]);
  const [flashcardTab, setFlashcardTab] = useState('study');
  const [flashcardSubject, setFlashcardSubject] = useState('すべて');
  const [flashcardTheme, setFlashcardTheme] = useState('すべて');
  const [filterCardFolder, setFilterCardFolder] = useState('すべて');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [showFlashcardGenerator, setShowFlashcardGenerator] = useState(false);
  const [flashcardGenSubject, setFlashcardGenSubject] = useState(SUBJECTS[0]);
  const [flashcardGenFolder, setFlashcardGenFolder] = useState('未分類');
  const [flashcardPrompt, setFlashcardPrompt] = useState('');
  const [isGeneratingCardsDirectly, setIsGeneratingCardsDirectly] = useState(false);
  const [isEditingCardId, setIsEditingCardId] = useState(null);
  const [editCardData, setEditCardData] = useState(null);

  const [studyMode, setStudyMode] = useState('custom');
  const [customSettings, setCustomSettings] = useState({ grade: '中学1年', subject: '算数・数学', topic: '', difficulty: '標準', count: 'おまかせ' });
  const [selectedMistakes, setSelectedMistakes] = useState([]); 
  const [quizState, setQuizState] = useState('start');
  const [quizData, setQuizData] = useState([]);
  const [currentAnswers, setCurrentAnswers] = useState({});
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  
  const [examState, setExamState] = useState('start');
  const [examSettings, setExamSettings] = useState({ subject: '算数・数学', level: '高校受験（標準）', count: 10 });
  const [examData, setExamData] = useState([]);
  const [examAnswers, setExamAnswers] = useState({});
  const [examReviewFlags, setExamReviewFlags] = useState({});
  const [examCurrentIndex, setExamCurrentIndex] = useState(0);
  const [examTimeRemaining, setExamTimeRemaining] = useState(0);

  const [subjectStats, setSubjectStats] = useState(
    SUBJECTS.reduce((acc, sub) => ({ ...acc, [sub]: { total: 0, correct: 0 } }), {})
  );
  const [currentQuizSubject, setCurrentQuizSubject] = useState('その他');

  const chatEndRef = useRef(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const [showConfetti, setShowConfetti] = useState(false);

  // === Firebase Auth Initialization ===
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth Error", e);
        setAuthLoading(false); // In case of error, still remove loading
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // === Firestore Data Fetching ===
  useEffect(() => {
    if (!user) return;
    const userId = user.uid;

    const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data');
    const unsubProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProfile(data.userProfile || userProfile);
        setStats(data.stats || stats);
        setErrorStats(data.errorStats || errorStats);
        setActivityLog(data.activityLog || activityLog);
        setWeaknesses(data.weaknesses || []);
        setSubjectStats(data.subjectStats || subjectStats);
        setFolders(data.folders || ['未分類', '定期テスト', '受験対策']);
        setHasDoneRevenge(data.hasDoneRevenge || false);
        setHasDoneExam(data.hasDoneExam || false);
        setIsSetupComplete(true);
      } else {
        setIsSetupComplete(false); // 存在しない場合はセットアップ画面へ
      }
    }, (err) => console.error("Profile fetch error:", err));

    const todosRef = collection(db, 'artifacts', appId, 'users', userId, 'todos');
    const unsubTodos = onSnapshot(todosRef, (snap) => {
      setTodos(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=> a.createdAt - b.createdAt));
    }, (err) => console.error(err));

    const materialsRef = collection(db, 'artifacts', appId, 'users', userId, 'materials');
    const unsubMaterials = onSnapshot(materialsRef, (snap) => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>b.createdAt - a.createdAt));
    }, (err) => console.error(err));

    const flashcardsRef = collection(db, 'artifacts', appId, 'users', userId, 'flashcards');
    const unsubFlashcards = onSnapshot(flashcardsRef, (snap) => {
      setFlashcards(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>b.createdAt - a.createdAt));
    }, (err) => console.error(err));

    const mistakesRef = collection(db, 'artifacts', appId, 'users', userId, 'mistakes');
    const unsubMistakes = onSnapshot(mistakesRef, (snap) => {
      setMistakes(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>b.createdAt - a.createdAt));
    }, (err) => console.error(err));

    return () => {
      unsubProfile(); unsubTodos(); unsubMaterials(); unsubFlashcards(); unsubMistakes();
    };
  }, [user]);

  const accuracyRate = stats.totalQuestions > 0 ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) : 0;
  const activeMaterial = materials.find(m => m.id === activeMaterialId);
  
  const availableThemes = Array.from(new Set(
    flashcards.filter(card => flashcardSubject === 'すべて' || card.subject === flashcardSubject).map(card => card.theme).filter(Boolean)
  ));

  const pendingFlashcards = flashcards.filter(card => 
    (flashcardSubject === 'すべて' || card.subject === flashcardSubject) && 
    (flashcardTheme === 'すべて' || card.theme === flashcardTheme) &&
    (filterCardFolder === 'すべて' || (card.folder || '未分類') === filterCardFolder) &&
    !card.isMemorized
  );

  const filteredListCards = flashcards.filter(card => 
    (flashcardSubject === 'すべて' || card.subject === flashcardSubject) && 
    (filterCardFolder === 'すべて' || (card.folder || '未分類') === filterCardFolder) &&
    (flashcardTheme === 'すべて' || card.theme === flashcardTheme)
  );

  const getRoadmapSteps = () => {
    const step1Progress = Math.min(100, Math.round((stats.totalQuestions / 15) * 100));
    const step2Progress = step1Progress < 100 ? 0 : Math.min(100, Math.round((mistakes.length / 5) * 100));
    const step3Progress = step2Progress < 100 ? 0 : (hasDoneRevenge ? 100 : 0);
    const step4Progress = step3Progress < 100 ? 0 : (hasDoneExam ? 100 : 0);

    return [
      { id: 1, title: '学習の第一歩（演習15問）', status: step1Progress >= 100 ? 'completed' : 'current', progress: step1Progress, desc: 'まずは演習問題を15問解いて、学習のペースを掴みましょう。' },
      { id: 2, title: '弱点の発見（ストック5問）', status: step1Progress < 100 ? 'locked' : (step2Progress >= 100 ? 'completed' : 'current'), progress: step2Progress, desc: 'テストを通じて間違えた問題を5問以上蓄積し、自分の弱点を明らかにします。' },
      { id: 3, title: 'リベンジによる克服', status: step2Progress < 100 ? 'locked' : (step3Progress >= 100 ? 'completed' : 'current'), progress: step3Progress, desc: '「リベンジ特訓」で間違えた問題の類題に挑戦し、自力で解き切ります。' },
      { id: 4, title: '実践模試への挑戦', status: step3Progress < 100 ? 'locked' : (step4Progress >= 100 ? 'completed' : 'current'), progress: step4Progress, desc: '制限時間付きの実戦形式の模試を実施し、本番の対応力を養います。' }
    ];
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatting]);

  useEffect(() => {
    setCurrentCardIndex(0);
    setIsCardFlipped(false);
  }, [flashcardSubject, flashcardTheme, filterCardFolder]);

  useEffect(() => {
    if (currentCardIndex >= pendingFlashcards.length && pendingFlashcards.length > 0) {
      setCurrentCardIndex(Math.max(0, pendingFlashcards.length - 1));
    }
  }, [pendingFlashcards.length, currentCardIndex]);

  useEffect(() => {
    setIsEditingNote(false);
    setNoteToDelete(null);
  }, [activeMaterialId]);

  useEffect(() => {
    let timer;
    if (activeTab === 'exam' && examState === 'playing' && examTimeRemaining > 0) {
      timer = setInterval(() => {
        setExamTimeRemaining(prev => {
          if (prev <= 1) { clearInterval(timer); submitExam(true); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeTab, examState, examTimeRemaining]);

  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 5000);
  };

  const handleTabChange = (tabId) => {
    playSound('click');
    setActiveTab(tabId);
  };

  const addGoal = (e) => {
    e?.preventDefault();
    if (newGoalInput.trim() && !userProfile.goals.includes(newGoalInput.trim())) {
      setUserProfile(prev => ({ ...prev, goals: [...prev.goals, newGoalInput.trim()] }));
      setNewGoalInput('');
      playSound('click');
    }
  };
  const removeGoal = (indexToRemove) => {
    setUserProfile(prev => ({
      ...prev,
      goals: prev.goals.filter((_, index) => index !== indexToRemove)
    }));
    playSound('click');
  };

  // === プロファイル作成（初回起動時）===
  const finishSetup = async () => {
    if (!userProfile.grade || !userProfile.username.trim()) {
      showToast("アカウント名を入力してください。", "error");
      return;
    }
    playSound('start');
    
    const newWeaknesses = userProfile.weakSubjects.length > 0 ? userProfile.weakSubjects.map(s => `${s}全般`) : [];
    
    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      await setDoc(profileRef, {
        userProfile,
        stats: { totalQuestions: 0, correctAnswers: 0 },
        errorStats: { concept: 0, prerequisite: 0, careless: 0, reading: 0 },
        activityLog: [
          { day: '月', count: 0 }, { day: '火', count: 0 }, { day: '水', count: 0 },
          { day: '木', count: 0 }, { day: '金', count: 0 }, { day: '土', count: 0 }, { day: '日', count: 0 }
        ],
        weaknesses: newWeaknesses,
        subjectStats: SUBJECTS.reduce((acc, sub) => ({ ...acc, [sub]: { total: 0, correct: 0 } }), {}),
        folders: ['未分類', '定期テスト', '受験対策'],
        hasDoneRevenge: false,
        hasDoneExam: false
      });

      const batch = writeBatch(db);
      const todosRef = collection(db, 'artifacts', appId, 'users', user.uid, 'todos');
      batch.set(doc(todosRef), { text: '基礎用語の確認を行う', completed: false, createdAt: Date.now() });
      batch.set(doc(todosRef), { text: '弱点分野の演習を1回実施する', completed: false, createdAt: Date.now()+1 });
      await batch.commit();

      setCustomSettings(prev => ({ ...prev, grade: userProfile.grade }));
      setChatMessages([{ role: 'ai', text: `${userProfile.username}さん、アカウントの作成が完了しました。私はあなた専用の学習支援AIです。\n学習データは自動的にクラウドに保存されます。不明点があれば質問してください。`}]);
      setIsSetupComplete(true);
    } catch(e) {
      console.error(e);
      showToast("プロフィールの作成に失敗しました。");
    }
  };

  const toggleSubject = (type, subject) => {
    playSound('click');
    setUserProfile(prev => {
      const list = prev[type];
      return { ...prev, [type]: list.includes(subject) ? list.filter(s => s !== subject) : [...list, subject] };
    });
  };

  const toggleTodo = async (id) => {
    playSound('click');
    const todo = todos.find(t => t.id === id);
    if (!todo || !user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'todos', id), { completed: !todo.completed });
    } catch(e) { console.error(e); showToast("更新に失敗しました"); }
  };

  const addTodo = async (e) => {
    e.preventDefault();
    if (!newTodo.trim() || !user) return;
    playSound('click');
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'todos'), { text: newTodo, completed: false, createdAt: Date.now() });
      setNewTodo('');
    } catch(e) { console.error(e); showToast("追加に失敗しました"); }
  };

  const addFolder = async (folderName) => {
    if (folderName.trim() && !folders.includes(folderName.trim()) && user) {
      const newFolders = [...folders, folderName.trim()];
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), { folders: newFolders });
        showToast('フォルダーを追加しました', 'success');
        setNewFolderName('');
        setShowFolderInput(false);
      } catch(e) { console.error(e); showToast("追加に失敗しました"); }
    }
  };

  const renderFolderManager = () => (
    <div className="flex items-center gap-2">
      {showFolderInput ? (
        <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1 shadow-sm h-11">
          <input 
            type="text" placeholder="新フォルダー名" 
            value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
            className="px-3 py-1 outline-none text-sm font-bold w-32 bg-transparent"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && addFolder(newFolderName)}
          />
          <button onClick={() => addFolder(newFolderName)} className="bg-indigo-600 text-white p-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
            <CheckCircle size={16}/>
          </button>
          <button onClick={() => setShowFolderInput(false)} className="text-gray-400 p-1.5 hover:text-gray-600 transition-colors">
            <XCircle size={16}/>
          </button>
        </div>
      ) : (
        <button onClick={() => setShowFolderInput(true)} className="flex items-center text-sm font-bold text-indigo-600 bg-indigo-50 px-3 h-11 rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100">
          <FolderPlus size={16} className="mr-1.5"/> フォルダー追加
        </button>
      )}
    </div>
  );

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    if (!newMatTitle || !user) return;
    playSound('click');
    setIsAddingMaterial(true);
    try {
      const baseFormat = `重要なキーワードは赤文字（<span style="color:#ef4444; font-weight:bold;">テキスト</span>）や、下線（<u>テキスト</u>）を用いて明示すること。
視覚的にわかりやすくするため、見出しや重要な概念には関連する【絵文字】を効果的に使用すること。
概念の関係性や手順、分類を示す場合は、矢印（→）や記号を使った【視覚的なテキスト図解（フロー図やツリー図など）】を含めること。
構成は【結論】【図解・全体像】【詳細解説】【重要キーワード】【確認事項】の順とし、簡潔で客観的な文体（だ・である調）で記述すること。
※厳守：無駄な空行やスペースを入れないこと。段落間の空行は最大1行。HTMLの<br>や<p>タグは使用せず、通常の改行のみで構成すること。`;
      
      const customFormat = userProfile.notePreference ? `\n【ユーザー指定フォーマット（優先適用）】\n${userProfile.notePreference}` : '';

      const prompt = `対象: ${userProfile.grade}\n科目: ${newMatSubject}\n以下のテーマについて、学習用ノートを作成してください。\n\n【テーマ】\n${newMatTitle}\n${newMatContent ? `\n【参考テキスト】\n${newMatContent}\n` : ''}\n\n【著作権に関する厳守事項（表現の脱色）】\n入力された参考テキストから『事実ベースの知識』と『論理構造』のみを抽出し、入力元の文章表現や言い回しは一切使用しないでください。AI自身の完全に独自の言葉・表現でゼロから解説を構築すること。\n\n【フォーマット規定】\n${baseFormat}\n${customFormat}\n\n上記規定に従い出力してください。Markdownは使用せず、指定のHTMLタグのみで装飾してください。`;
      
      const summary = await generateGeminiContent(prompt, false);
      const newMatData = { 
        title: newMatTitle, subject: newMatSubject, folder: newMatFolder,
        content: newMatContent || '（参考テキストなし）', summary, 
        date: new Date().toISOString().split('T')[0], createdAt: Date.now()
      };
      
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'materials'), newMatData);
      setActiveMaterialId(docRef.id);
      setNewMatTitle(''); setNewMatContent('');
      playSound('correct'); 
      setNoteViewState('view');
      showToast('ノートを生成しました。', 'success');
      
      const today = new Date().getDay();
      const dayIndex = today === 0 ? 6 : today - 1;
      const newLog = [...activityLog];
      newLog[dayIndex].count += 1;
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), { activityLog: newLog });
    } catch (error) { 
      console.error(error);
      const isAuthError = error.message.includes('401') || error.message.includes('403');
      showToast(isAuthError ? "認証エラーが発生しました。設定からAPIキーを確認してください。" : `エラーが発生しました: ${error.message.substring(0, 40)}...`); 
    } 
    finally { setIsAddingMaterial(false); }
  };

  const saveNoteEdit = async () => {
    playSound('click');
    if (!user || !editNoteData) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'materials', editNoteData.id), {
        title: editNoteData.title, subject: editNoteData.subject, folder: editNoteData.folder, summary: editNoteData.summary
      });
      setIsEditingNote(false);
      showToast('ノートを更新しました', 'success');
    } catch(e) { console.error(e); showToast("更新に失敗しました"); }
  };

  const deleteNote = async (id) => {
    playSound('click');
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'materials', id));
      setNoteViewState('list');
      setNoteToDelete(null);
      showToast('ノートを削除しました', 'success');
    } catch(e) { console.error(e); showToast("削除に失敗しました"); }
  };

  // AIによる単語カード抽出機能
  const generateFlashcardsFromNote = async () => {
    playSound('click');
    setIsGeneratingCards(true);
    try {
      const prompt = `以下の学習ノートの内容から、特に重要なキーワードとその意味を抽出し、JSON形式の配列で出力してください。（3〜7個程度）
必ず以下のJSONフォーマットのみを出力し、それ以外の説明文などは一切含めないでください。抽出するキーワードは5個程度に厳選し、説明文も短くしてください。
[{"front": "キーワード", "back": "意味・説明"}]

【ノート内容】
${activeMaterial.summary.replace(/<[^>]*>?/gm, '')}
`;
      const rawText = await generateGeminiContent(prompt, false, 'flashcards');
      let newCards = [];
      try {
        let cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleanText.match(/\[[\s\S]*\]/) || cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            newCards = Array.isArray(parsed) ? parsed : (parsed.items || []);
        } else { throw new Error("JSONが見つかりません"); }
      } catch (parseError) { throw new Error("データの解析に失敗しました。"); }
      
      const batch = writeBatch(db);
      const fcRef = collection(db, 'artifacts', appId, 'users', user.uid, 'flashcards');
      let count = 0;
      newCards.forEach(c => {
        batch.set(doc(fcRef), {
          subject: activeMaterial.subject, theme: activeMaterial.title, folder: activeMaterial.folder || '未分類',
          front: typeof c.front === 'string' ? c.front : JSON.stringify(c.front),
          back: typeof c.back === 'string' ? c.back : JSON.stringify(c.back),
          isMemorized: false, createdAt: Date.now() + count++
        });
      });
      await batch.commit();
      showToast(`${newCards.length}枚の単語カードを抽出・追加しました！`, 'success');
    } catch(e) {
      console.error(e);
      showToast(e.message);
    } finally {
      setIsGeneratingCards(false);
    }
  };

  // AIによる単語カード直接生成機能
  const handleGenerateFlashcards = async (e) => {
    e.preventDefault();
    if (!flashcardPrompt.trim() || !user) return;
    playSound('click');
    setIsGeneratingCardsDirectly(true);
    try {
      const prompt = `対象: ${userProfile.grade}\n科目: ${flashcardGenSubject}\nテーマ: ${flashcardPrompt}\nこのテーマに関する重要なキーワードとその意味を、学習用の単語帳として抽出してください。抽出するキーワードは5個程度に厳選し、説明文も短くしてください。
必ず以下のJSONフォーマットのみを出力し、それ以外の説明文などは一切含めないでください。
[{"front": "キーワード", "back": "意味・説明"}]`;
      
      const rawText = await generateGeminiContent(prompt, false, 'flashcards');
      let newCards = [];
      try {
        let cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleanText.match(/\[[\s\S]*\]/) || cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            newCards = Array.isArray(parsed) ? parsed : (parsed.items || []);
        } else { throw new Error("JSONが見つかりません"); }
      } catch (parseError) { throw new Error("データの解析に失敗しました。"); }
      
      const batch = writeBatch(db);
      const fcRef = collection(db, 'artifacts', appId, 'users', user.uid, 'flashcards');
      let count = 0;
      newCards.forEach(c => {
        batch.set(doc(fcRef), {
          subject: flashcardGenSubject, theme: flashcardPrompt, folder: flashcardGenFolder,
          front: typeof c.front === 'string' ? c.front : JSON.stringify(c.front),
          back: typeof c.back === 'string' ? c.back : JSON.stringify(c.back),
          isMemorized: false, createdAt: Date.now() + count++
        });
      });
      await batch.commit();
      
      showToast(`${newCards.length}枚の単語カードを追加しました！`, 'success');
      setFlashcardPrompt('');
      setShowFlashcardGenerator(false);
    } catch(e) {
      console.error(e);
      showToast(e.message);
    } finally {
      setIsGeneratingCardsDirectly(false);
    }
  };

  const startQuiz = async () => {
    playSound('click');
    setIsGeneratingQuiz(true);
    setQuizState('start');
    try {
      let prompt = `対象: ${userProfile.grade}\n実力測定用の4択問題を作成してください。\n`;
      let countInstruction = customSettings.count === 'おまかせ' ? `指定範囲の広さや内容の濃さに応じて、適切な問題数（目安：10〜20問）を自動的に判断して出力してください。` : `出題数: ${customSettings.count}問`;

      let quizSub = 'その他';
      if (studyMode === 'custom') {
        prompt += `【条件】科目: ${customSettings.subject}, 単元: ${customSettings.topic || '全範囲'}, 難易度: ${customSettings.difficulty}\n${countInstruction}`;
        quizSub = customSettings.subject;
      } else if (studyMode === 'weakness') {
        prompt += `【条件】現在の弱点: ${weaknesses.join(', ')}\n${countInstruction}`;
        quizSub = '弱点特訓';
      } else if (studyMode === 'review') {
        const targetMistakes = mistakes.filter(m => selectedMistakes.includes(m.id));
        const recentMistakes = targetMistakes.map(m => m.question).join('\n・');
        prompt += `【条件】ユーザーが過去に間違えた以下の問題の「類似問題（数値や条件を変えたもの）」を作成し、再度出題してください。\n・${recentMistakes}\n${countInstruction}`;
        quizSub = 'リベンジ特訓';
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), { hasDoneRevenge: true });
      } else {
        const mat = materials.find(m => m.id === activeMaterialId);
        prompt += `【条件】テーマ: ${mat.title}\n内容: ${mat.summary}\n${countInstruction}`;
        quizSub = mat?.subject || 'その他';
      }
      setCurrentQuizSubject(quizSub);

      prompt += `\n【要件】\n1. 思考力を問う実践的な問題を含めること。\n2. 解説は客観的かつ論理的な文体（だ・である調）とし、簡潔に必要な情報のみを記述すること。\n3. weaknessTagは20文字以内の具体的な単元名とすること。\n4. 各選択肢(options)には、その選択肢を選んだ際のエラー要因(errorCategory)を付与すること。正解は'correct'、不正解は 'concept'(概念理解の欠如), 'prerequisite'(前提知識の抜け漏れ), 'careless'(計算・処理ミス), 'reading'(読解・条件見落とし) のいずれかに分類すること。\n${AI_STRICT_RULES}`;
      
      const generatedQuiz = await generateGeminiContent(prompt, true, 'quiz');
      const finalData = customSettings.count === 'おまかせ' ? generatedQuiz : generatedQuiz.slice(0, customSettings.count);
      setQuizData(finalData);
      setCurrentAnswers({});
      setQuizState('playing');
      playSound('start');
    } catch (error) { 
      console.error(error);
      showToast(error.message); 
    } 
    finally { setIsGeneratingQuiz(false); }
  };

  const handleAnswerSelect = (qId, opt) => {
    playSound('click');
    setCurrentAnswers({...currentAnswers, [qId]: opt});
  };

  const submitQuiz = async () => {
    setQuizState('results');
    if (!user) return;
    
    const newWeaknesses = new Set(weaknesses);
    const newMistakes = [];
    const newErrorStats = { ...errorStats };
    let correctCount = 0;

    quizData.forEach(q => {
      const selectedOptText = currentAnswers[q.id];
      const selectedOptObj = q.options?.find(o => o.text === selectedOptText) || { errorCategory: 'unknown' };

      if (selectedOptText === q.answer) { 
        correctCount++; 
        newWeaknesses.delete(q.weaknessTag); 
      } else if(selectedOptText) { 
        newWeaknesses.add(q.weaknessTag); 
        newMistakes.push({ ...q, subject: currentQuizSubject, errorCategory: selectedOptObj.errorCategory });
        if (selectedOptObj.errorCategory && selectedOptObj.errorCategory !== 'correct') {
          newErrorStats[selectedOptObj.errorCategory] = (newErrorStats[selectedOptObj.errorCategory] || 0) + 1;
        }
      }
    });

    const updatedStats = { totalQuestions: stats.totalQuestions + quizData.length, correctAnswers: stats.correctAnswers + correctCount };
    const updatedSubStats = { ...subjectStats };
    if (!updatedSubStats[currentQuizSubject]) updatedSubStats[currentQuizSubject] = { total: 0, correct: 0 };
    updatedSubStats[currentQuizSubject].total += quizData.length;
    updatedSubStats[currentQuizSubject].correct += correctCount;
    
    const today = new Date().getDay();
    const dayIndex = today === 0 ? 6 : today - 1;
    const newLog = [...activityLog];
    newLog[dayIndex].count += quizData.length;

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), {
        weaknesses: Array.from(newWeaknesses),
        stats: updatedStats,
        errorStats: newErrorStats,
        subjectStats: updatedSubStats,
        activityLog: newLog
      });

      if (newMistakes.length > 0) {
        const batch = writeBatch(db);
        const mistakesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'mistakes');
        let count = 0;
        newMistakes.forEach(m => {
          batch.set(doc(mistakesRef), { ...m, createdAt: Date.now() + count++ });
        });
        await batch.commit();
      }
    } catch(e) { console.error(e); showToast("結果の保存に失敗しました"); }

    const scoreRate = quizData.length > 0 ? correctCount / quizData.length : 0;
    if (scoreRate >= 0.8) {
      setTimeout(() => playSound('fanfare'), 300);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    } else {
      setTimeout(() => playSound('correct'), 300);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startExam = async () => {
    playSound('click');
    setIsGeneratingQuiz(true);
    setExamState('start');
    try {
      const prompt = `対象: ${userProfile.grade}, 受験科目: ${examSettings.subject}, 志望レベル: ${examSettings.level}
厳格な模試として、実践的な4択問題を作成してください。

【重要要件】
実際の模試のように、長文や共通の資料・前提条件・会話文などのテーマ設定を持つ「大問」があり、その大問に関する「小問」が複数出題される形式にしてください。
大問の数は2〜4個程度とし、小問の合計数がなるべく【${examSettings.count}問】になるように調整してください。

【問題作成の要件】
1. ${examSettings.level}に完全に対応した難易度・出題傾向にすること。大学受験レベルの場合は、より思考力や複合的な知識を問う高度な問題にすること。
2. 大問の theme には、長文問題の本文や、共通の前提条件をしっかり記述すること。
3. 総合的な範囲から出題すること。
4. 解説は客観的で論理的な文体（だ・である調）にすること。
5. weaknessTagは単元名とすること。
6. 各選択肢(options)には、その選択肢を選んだ際のエラー要因(errorCategory)を付与すること。正解は'correct'、不正解は 'concept'(概念理解の欠如), 'prerequisite'(前提知識の抜け漏れ), 'careless'(計算・処理ミス), 'reading'(読解・条件見落とし) のいずれかに分類すること。
${AI_STRICT_RULES}`;
      
      const generatedExam = await generateGeminiContent(prompt, true, 'exam');
      
      let flatExamData = [];
      let globalQuestionIndex = 0;
      generatedExam.forEach((group, gIdx) => {
        group.questions?.forEach((q, qIdx) => {
          globalQuestionIndex++;
          flatExamData.push({
            ...q,
            groupTitle: `第${gIdx + 1}問`,
            theme: group.theme,
            displayIndex: globalQuestionIndex,
            groupSubIndex: qIdx + 1
          });
        });
      });

      if (flatExamData.length > examSettings.count) {
          flatExamData = flatExamData.slice(0, examSettings.count);
      }
      
      setExamData(flatExamData);
      setExamAnswers({});
      setExamReviewFlags({});
      setExamCurrentIndex(0);
      setExamTimeRemaining(flatExamData.length * 60);
      setExamState('playing');
      
      if(user) await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), { hasDoneExam: true });
      playSound('start');
    } catch (error) { 
      console.error(error);
      showToast(error.message); 
    } 
    finally { setIsGeneratingQuiz(false); }
  };

  const submitExam = async (isTimeUp = false) => {
    if (isTimeUp) showToast("時間切れです。自動提出されました。", "warning");
    setExamState('results');
    if(!user) return;

    const newWeaknesses = new Set(weaknesses);
    const newMistakes = [];
    const newErrorStats = { ...errorStats };
    let correctCount = 0;
    
    examData.forEach(q => {
      const selectedOptText = examAnswers[q.id];
      const selectedOptObj = q.options?.find(o => o.text === selectedOptText) || { errorCategory: 'unknown' };

      if (selectedOptText === q.answer) { 
        correctCount++; 
        newWeaknesses.delete(q.weaknessTag); 
      } else if (selectedOptText) { 
        newWeaknesses.add(q.weaknessTag); 
        newMistakes.push({ ...q, subject: examSettings.subject, errorCategory: selectedOptObj.errorCategory });
        if (selectedOptObj.errorCategory && selectedOptObj.errorCategory !== 'correct') {
          newErrorStats[selectedOptObj.errorCategory] = (newErrorStats[selectedOptObj.errorCategory] || 0) + 1;
        }
      }
    });
    
    const updatedStats = { totalQuestions: stats.totalQuestions + examData.length, correctAnswers: stats.correctAnswers + correctCount };
    const updatedSubStats = { ...subjectStats };
    if (!updatedSubStats[examSettings.subject]) updatedSubStats[examSettings.subject] = { total: 0, correct: 0 };
    updatedSubStats[examSettings.subject].total += examData.length;
    updatedSubStats[examSettings.subject].correct += correctCount;

    const today = new Date().getDay();
    const dayIndex = today === 0 ? 6 : today - 1;
    const newLog = [...activityLog];
    newLog[dayIndex].count += examData.length;

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), {
        weaknesses: Array.from(newWeaknesses),
        stats: updatedStats,
        errorStats: newErrorStats,
        subjectStats: updatedSubStats,
        activityLog: newLog
      });

      if (newMistakes.length > 0) {
        const batch = writeBatch(db);
        const mistakesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'mistakes');
        let count = 0;
        newMistakes.forEach(m => {
          batch.set(doc(mistakesRef), { ...m, createdAt: Date.now() + count++ });
        });
        await batch.commit();
      }
    } catch(e) { console.error(e); showToast("結果の保存に失敗しました"); }

    const scoreRate = examData.length > 0 ? correctCount / examData.length : 0;
    if (scoreRate >= 0.8) {
      setTimeout(() => playSound('fanfare'), 300);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 6000);
    } else {
      setTimeout(() => playSound('correct'), 300);
    }
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    playSound('click');
    const userMsg = { role: 'user', text: chatInput };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput('');
    setIsChatting(true);
    try {
      const historyText = newHistory.map(m => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.text}`).join('\n');
      const prompt = `あなたは論理的で厳密な学習支援AIです。対象: ${userProfile.grade}。客観的かつ簡潔な文体（だ・である調）で返信してください。無駄な愛想や冗長な表現は不要です。\n【会話履歴】\n${historyText}\nAI:`;
      const reply = await generateGeminiContent(prompt, false);
      setChatMessages([...newHistory, { role: 'ai', text: reply }]);
      playSound('correct'); 
    } catch (error) {
      console.error(error);
      setChatMessages([...newHistory, { role: 'ai', text: error.message }]);
    } finally { setIsChatting(false); }
  };

  // 単語カードの「覚えた」処理
  const handleMemorizedCard = async (e, cardId) => {
    e.stopPropagation();
    if(!user) return;
    playSound('correct');
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'flashcards', cardId), { isMemorized: true });
      setIsCardFlipped(false);
    } catch(err) { console.error(err); showToast("更新に失敗しました"); }
  };

  const deleteFlashcard = async (id) => {
    playSound('click');
    if(!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'flashcards', id));
      showToast('カードを削除しました', 'success');
    } catch(err) { console.error(err); showToast("削除に失敗しました"); }
  };

  const saveFlashcardEdit = async () => {
    playSound('click');
    if(!user || !editCardData) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'flashcards', editCardData.id), {
        front: editCardData.front, back: editCardData.back, subject: editCardData.subject, folder: editCardData.folder
      });
      setIsEditingCardId(null);
      showToast('カードを保存しました', 'success');
    } catch(err) { console.error(err); showToast("保存に失敗しました"); }
  };

  // ==========================================
  // UI レンダリング関数
  // ==========================================

  if (authLoading || isSetupComplete === null) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100">
        <div className="bg-white p-4 rounded-full shadow-lg text-indigo-600 mb-6 animate-bounce">
          <Cloud size={48} />
        </div>
        <h2 className="text-2xl font-black text-indigo-900 mb-2">アカウント情報を同期中...</h2>
        <p className="text-indigo-700 font-bold flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin"/> クラウドからデータを読み込んでいます</p>
      </div>
    );
  }

  const renderDashboard = () => {
    const roadmapSteps = getRoadmapSteps();
    const overallProgress = Math.round(roadmapSteps.reduce((acc, step) => acc + step.progress, 0) / roadmapSteps.length);

    return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-gray-100 pb-4 mb-8 gap-4">
        <h2 className="text-3xl font-extrabold text-gray-800 tracking-tight">ダッシュボード</h2>
        <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100 shadow-sm flex items-center self-start md:self-auto">
          <GraduationCap className="w-4 h-4 mr-1" /> {userProfile.grade}
        </span>
      </div>
      
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-6 md:p-8 rounded-3xl border border-white shadow-md flex items-start space-x-6 relative overflow-hidden group hover:shadow-lg transition-shadow">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-50 transform translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform duration-700"></div>
        <div className="bg-white p-4 rounded-full shadow-lg text-blue-600 shrink-0 relative z-10 animate-float hidden sm:block">
          <MessageCircle size={36} className="text-indigo-600" />
        </div>
        <div className="relative z-10 pt-2 w-full">
          <h3 className="font-extrabold text-gray-800 text-xl mb-4 flex items-center">
            目標 & 総合進行度
          </h3>
          {userProfile.goals.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {userProfile.goals.map((g, i) => (
                <span key={i} className="bg-white text-indigo-800 border border-indigo-200 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center shadow-sm">
                  <Flag size={14} className="mr-1.5 text-indigo-500"/>{g}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm mb-4">目標が設定されていません。</p>
          )}

          {/* 総合進行度プログレスバー */}
          <div className="mb-4 bg-white/40 p-3 rounded-xl border border-white/50 shadow-inner">
            <div className="flex justify-between text-sm font-bold text-indigo-900 mb-1.5">
              <span className="flex items-center"><Map size={16} className="mr-1"/> ロードマップ達成率</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="w-full bg-white/60 rounded-full h-2.5 overflow-hidden relative">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${overallProgress}%` }}>
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[pan_1s_linear_infinite]"></div>
              </div>
            </div>
          </div>

          <p className="text-gray-700 text-base md:text-lg leading-relaxed font-bold bg-white/60 p-4 rounded-xl">
            現在の正答率は{accuracyRate}%です。
            {weaknesses.length > 0 ? ` 優先課題は「${weaknesses[0]}」。タスクに追加し、復習を実施してください。` : '継続して学習を進めてください。'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '正答率', value: `${accuracyRate}%`, icon: Target, color: 'text-green-500', bg: 'bg-green-50' },
              { label: '解答数', value: `${stats.totalQuestions}問`, icon: FileQuestion, color: 'text-blue-500', bg: 'bg-blue-50' },
              { label: '弱点', value: `${weaknesses.length}個`, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
              { label: 'リベンジ待機', value: `${mistakes.length}問`, icon: RefreshCw, color: 'text-orange-500', bg: 'bg-orange-50' }
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 text-center transform hover:-translate-y-1 hover:shadow-md transition-all">
                  <div className={`w-10 h-10 md:w-12 md:h-12 mx-auto rounded-full ${stat.bg} ${stat.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <p className="text-xs md:text-sm font-bold text-gray-500 mb-1">{stat.label}</p>
                  <p className="text-xl md:text-2xl font-black text-gray-800">{stat.value}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <h3 className="text-xl font-bold text-gray-800 flex items-center mb-6">
              <Calendar className="w-6 h-6 mr-2 text-indigo-500" /> 直近のアクティビティ
            </h3>
            <div className="flex justify-between items-end h-32 md:h-40 mt-6 px-2">
              {activityLog.map((log, i) => {
                const height = log.count === 0 ? 4 : Math.min(100, log.count * 10);
                const isToday = i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
                return (
                  <div key={i} className="flex flex-col items-center w-full group">
                    <div className="w-full px-1 md:px-3 flex justify-center items-end h-24 md:h-32 relative">
                      <span className="absolute -top-8 text-xs font-bold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-1 rounded shadow-sm z-10">
                        {log.count}
                      </span>
                      <div 
                        className={`w-full max-w-[40px] rounded-t-lg transition-all duration-500 ease-out ${log.count > 0 ? 'bg-gradient-to-t from-indigo-500 to-blue-400' : 'bg-gray-100'} ${isToday ? 'ring-2 ring-offset-2 ring-indigo-300' : ''}`}
                        style={{ height: `${height}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs md:text-sm mt-3 font-bold ${isToday ? 'text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full' : 'text-gray-400'}`}>{log.day}</span>
                  </div>
                )
              })}
            </div>
          </div>
          
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-gray-800 flex items-center mb-6">
              <Zap className="w-6 h-6 mr-2 text-yellow-500" /> 弱点リスト
            </h3>
            <div className="flex flex-wrap gap-3">
              {weaknesses.map((w, i) => (
                <span key={i} className="bg-red-50 text-red-700 px-4 py-2 rounded-xl text-sm font-bold border border-red-100 shadow-sm flex items-center animate-pop" style={{animationDelay: `${i*0.1}s`}}>
                  <AlertCircle className="w-4 h-4 mr-1.5 opacity-70" /> {w}
                </span>
              ))}
              {weaknesses.length === 0 && (
                <div className="w-full text-center py-6 bg-green-50 rounded-xl border border-green-100 border-dashed">
                  <p className="text-green-600 font-bold flex items-center justify-center text-lg">
                    <CheckCircle className="w-6 h-6 mr-2" /> 該当データなし
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
            <h3 className="text-xl font-bold text-gray-800 flex items-center mb-6 pb-4 border-b">
              <CheckSquare className="w-6 h-6 mr-2 text-green-500" /> タスク
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2">
              {todos.map(todo => (
                <div 
                  key={todo.id} 
                  className={`flex items-start p-4 rounded-xl border-2 transition-all cursor-pointer transform hover:scale-[1.02] ${todo.completed ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200 hover:border-indigo-300 shadow-sm'}`}
                  onClick={() => toggleTodo(todo.id)}
                >
                  <div className={`mt-0.5 mr-3 transition-colors ${todo.completed ? 'text-gray-400' : 'text-indigo-500'}`}>
                    {todo.completed ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                  </div>
                  <span className={`text-base font-bold ${todo.completed ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                    {todo.text}
                  </span>
                </div>
              ))}
              {todos.length === 0 && <p className="text-sm font-bold text-gray-400 text-center py-8">タスクなし</p>}
            </div>

            <form onSubmit={addTodo} className="mt-auto relative">
              <input 
                type="text" value={newTodo} onChange={(e) => setNewTodo(e.target.value)}
                placeholder="新規タスク追加..."
                className="w-full border-2 border-gray-200 rounded-xl py-4 pl-4 pr-12 text-sm focus:border-indigo-500 outline-none bg-gray-50 hover:bg-white transition-colors font-bold"
              />
              <button type="submit" className="absolute right-3 top-3 bottom-3 bg-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg px-3 transition-colors flex items-center justify-center">
                <Plus className="w-5 h-5 font-bold" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
    );
  };

  const renderMaterials = () => {
    if (noteViewState === 'create') {
      return (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-12">
          <div className="flex items-center justify-between border-b-2 border-gray-200 pb-4 mb-8">
            <div className="flex items-center">
              <button onClick={() => { playSound('click'); setNoteViewState('list'); }} className="mr-4 p-2 hover:bg-gray-200 rounded-full transition-colors">
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <FileText className="w-8 h-8 mr-3 text-blue-600" />
              <div>
                <h2 className="text-2xl font-black text-gray-800">新規AIノート作成</h2>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 md:p-10 rounded-3xl shadow-lg border border-gray-100">
            <form onSubmit={handleAddMaterial} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-3">
                  <label className="block text-base font-bold text-gray-700 mb-3">
                    テーマ・単元 <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" required placeholder="例：光合成のメカニズム" 
                    value={newMatTitle} onChange={(e) => setNewMatTitle(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors font-bold text-lg"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-base font-bold text-gray-700 mb-3">
                    科目 <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={newMatSubject} onChange={(e) => setNewMatSubject(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors font-bold text-lg"
                  >
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-base font-bold text-gray-700 mb-3">
                    保存先フォルダー
                  </label>
                  <select 
                    value={newMatFolder} onChange={(e) => setNewMatFolder(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors font-bold text-lg"
                  >
                    {folders.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-base font-bold text-gray-700 mb-3">
                  参考テキスト（任意）
                </label>
                <textarea 
                  rows={4} placeholder="参考にする情報があれば入力。" 
                  value={newMatContent} onChange={(e) => setNewMatContent(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-500 resize-y transition-colors font-medium text-base leading-relaxed"
                />
              </div>
              
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                <label className="block text-base font-bold text-blue-800 mb-3 flex items-center">
                  フォーマット指定（オプション）
                </label>
                <textarea 
                  rows={2} 
                  value={userProfile.notePreference} 
                  onChange={(e) => setUserProfile({...userProfile, notePreference: e.target.value})}
                  className="w-full border-2 border-blue-200 rounded-xl px-5 py-3 bg-white focus:outline-none focus:border-blue-500 resize-y transition-colors font-medium text-sm leading-relaxed text-gray-700"
                />
              </div>

              <button 
                type="submit" disabled={isAddingMaterial}
                className="w-full bg-blue-600 disabled:bg-gray-400 hover:bg-blue-700 text-white px-8 py-5 rounded-2xl font-black text-xl flex items-center justify-center transition-all shadow-xl transform hover:-translate-y-1 active:scale-95"
              >
                {isAddingMaterial ? (
                  <><Loader2 className="w-6 h-6 mr-3 animate-spin" /> 処理中...</>
                ) : (
                  <><Zap className="w-6 h-6 mr-3" /> ノートを生成</>
                )}
              </button>
            </form>
          </div>
        </div>
      );
    }

    if (noteViewState === 'view' && activeMaterial) {
      if (isEditingNote) {
        return (
          <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
            <div className="flex items-center border-b-2 border-blue-500 pb-4 mb-8">
              <Edit size={28} className="text-blue-600 mr-3"/>
              <h2 className="text-2xl font-black text-gray-800">ノートを編集</h2>
            </div>
            <div className="bg-white p-6 md:p-10 rounded-3xl shadow-xl border border-gray-200 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">タイトル</label>
                <input 
                  type="text" value={editNoteData.title} 
                  onChange={e => setEditNoteData({...editNoteData, title: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-lg outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">科目</label>
                  <select 
                    value={editNoteData.subject} 
                    onChange={e => setEditNoteData({...editNoteData, subject: e.target.value})}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-base outline-none focus:border-blue-500"
                  >
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">保存先フォルダー</label>
                  <select 
                    value={editNoteData.folder || '未分類'} 
                    onChange={e => setEditNoteData({...editNoteData, folder: e.target.value})}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-base outline-none focus:border-blue-500"
                  >
                    {folders.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">ノート内容（HTMLタグ使用可）</label>
                <textarea 
                  rows={15} value={editNoteData.summary} 
                  onChange={e => setEditNoteData({...editNoteData, summary: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-medium text-sm font-mono outline-none focus:border-blue-500 leading-relaxed"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button onClick={() => setIsEditingNote(false)} className="px-6 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">キャンセル</button>
                <button onClick={saveNoteEdit} className="px-8 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-colors flex items-center"><Save size={18} className="mr-2"/> 保存する</button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b-2 border-gray-200 pb-4 mb-6 gap-4">
            <div className="flex items-center">
              <button onClick={() => { playSound('click'); setNoteViewState('list'); }} className="mr-4 p-2 hover:bg-gray-200 rounded-full transition-colors shrink-0">
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 flex items-center">
                  {activeMaterial.subject}
                </span>
                <span className="text-sm font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-lg border border-gray-200 flex items-center">
                  <Folder size={14} className="mr-1.5"/>{activeMaterial.folder || '未分類'}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 md:gap-3 w-full md:w-auto">
              <div className="flex gap-2 flex-1 sm:flex-none mr-2">
                <button onClick={() => { setEditNoteData(activeMaterial); setIsEditingNote(true); playSound('click'); }} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-1 sm:flex-none flex justify-center" title="編集">
                  <Edit size={20}/>
                </button>
                {noteToDelete === activeMaterial.id ? (
                   <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg text-red-700 font-bold text-xs">
                     消去?
                     <button onClick={() => deleteNote(activeMaterial.id)} className="bg-red-600 text-white px-2 py-1 rounded">はい</button>
                     <button onClick={() => setNoteToDelete(null)} className="bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300">❌</button>
                   </div>
                ) : (
                  <button onClick={() => { playSound('click'); setNoteToDelete(activeMaterial.id); }} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-1 sm:flex-none flex justify-center" title="削除">
                    <Trash2 size={20}/>
                  </button>
                )}
              </div>

              <button 
                onClick={() => { playSound('click'); handleTabChange('study'); setStudyMode('material'); }}
                className="bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-2.5 rounded-full font-bold flex items-center justify-center transition-all shadow-md text-sm md:text-base flex-1 sm:flex-none"
              >
                 <Brain className="w-4 h-4 mr-2" /> テスト
              </button>
              <button 
                onClick={generateFlashcardsFromNote}
                disabled={isGeneratingCards}
                className="bg-green-600 disabled:bg-green-400 text-white hover:bg-green-700 px-5 py-2.5 rounded-full font-bold flex items-center justify-center transition-all shadow-md text-sm md:text-base flex-1 sm:flex-none"
              >
                 {isGeneratingCards ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Layers className="w-4 h-4 mr-2" />} 
                 単語抽出
              </button>
            </div>
          </div>

          <div className="bg-white p-6 md:p-14 rounded-3xl shadow-xl border border-gray-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
            <h4 className="text-2xl md:text-4xl font-black text-gray-900 mb-8 pb-6 border-b-2 border-gray-100 leading-tight">
              {activeMaterial.title}
            </h4>
            
            <div 
              className="text-gray-800 text-base md:text-lg font-bold leading-relaxed custom-note-content whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ 
                __html: activeMaterial.summary
                  .replace(/<br\s*\/?>/gi, '\n')
                  .replace(/\n{3,}/g, '\n\n')
                  .trim() 
              }}
            />
          </div>
        </div>
      );
    }

    const filteredMaterials = materials.filter(m => 
      (filterSubject === 'すべて' || m.subject === filterSubject) &&
      (filterNoteFolder === 'すべて' || (m.folder || '未分類') === filterNoteFolder) &&
      (m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.summary.toLowerCase().includes(searchQuery.toLowerCase()))
    ).sort((a, b) => {
      if (sortOrder === 'newest') return b.createdAt ? b.createdAt - a.createdAt : b.id - a.id;
      if (sortOrder === 'oldest') return a.createdAt ? a.createdAt - b.createdAt : a.id - b.id;
      if (sortOrder === 'a-z') return a.title.localeCompare(b.title);
      return 0;
    });

    return (
      <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-gray-200 pb-4 mb-6 gap-4">
          <div className="flex items-center">
            <BookOpen className="w-8 h-8 mr-3 text-blue-600" />
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-800">ノート管理</h2>
              <p className="text-sm font-bold text-gray-500">作成したAIノートの分類と検索</p>
            </div>
          </div>
          <button 
            onClick={() => { playSound('click'); setNoteViewState('create'); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-black flex items-center justify-center transition-all shadow-md transform hover:scale-105 active:scale-95 w-full md:w-auto"
          >
            <Plus className="w-5 h-5 mr-1" /> 新規ノート作成
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-4 top-3.5 text-gray-400" />
            <input 
              type="text" placeholder="ノートを検索..." 
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 font-bold text-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="flex flex-wrap md:flex-nowrap gap-3 items-center w-full">
            <div className="relative flex-1 min-w-[120px]">
              <Filter className="w-4 h-4 absolute left-3 top-3.5 text-gray-500" />
              <select 
                value={filterSubject} onChange={(e) => { playSound('click'); setFilterSubject(e.target.value); }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-9 pr-4 font-bold text-gray-700 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer text-sm"
              >
                <option value="すべて">全科目</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="relative flex-1 min-w-[120px]">
              <Folder className="w-4 h-4 absolute left-3 top-3.5 text-gray-500" />
              <select 
                value={filterNoteFolder} onChange={(e) => { playSound('click'); setFilterNoteFolder(e.target.value); }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-9 pr-4 font-bold text-gray-700 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer text-sm"
              >
                <option value="すべて">全フォルダー</option>
                {folders.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="relative flex-1 min-w-[120px]">
              <SortDesc className="w-4 h-4 absolute left-3 top-3.5 text-gray-500" />
              <select 
                value={sortOrder} onChange={(e) => { playSound('click'); setSortOrder(e.target.value); }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-9 pr-4 font-bold text-gray-700 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer text-sm"
              >
                <option value="newest">新しい順</option>
                <option value="oldest">古い順</option>
                <option value="a-z">名前順</option>
              </select>
            </div>
            {renderFolderManager()}
          </div>
        </div>

        {filteredMaterials.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMaterials.map(mat => (
              <div 
                key={mat.id} 
                onClick={() => { playSound('click'); setActiveMaterialId(mat.id); setNoteViewState('view'); }}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 cursor-pointer transform hover:-translate-y-1 hover:shadow-md transition-all group flex flex-col h-64"
              >
                <div className="flex justify-between items-start mb-4 shrink-0">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-black bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-md w-max">
                      {mat.subject}
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 flex items-center"><Folder size={10} className="mr-1"/>{mat.folder || '未分類'}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-400">{mat.date}</span>
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {mat.title}
                </h3>
                <p className="text-sm font-bold text-gray-500 line-clamp-3 flex-1">
                  {mat.summary.replace(/<[^>]*>?/gm, '')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-black text-gray-500 mb-2">ノートが見つかりません</h3>
            <p className="text-sm font-bold text-gray-400">検索条件を変えるか、新しいノートを作成してください。</p>
          </div>
        )}
      </div>
    );
  };

  const renderStudySettings = () => (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      <div className="text-center mb-10 pt-6">
        <div className="inline-block p-4 bg-indigo-50 rounded-full mb-4 animate-float">
          <Brain className="w-12 h-12 text-indigo-600" />
        </div>
        <h2 className="text-3xl font-extrabold text-gray-800 mb-2">演習テスト生成</h2>
        <p className="text-gray-600 font-bold">条件を設定し、実力測定テストを出力します。</p>
      </div>

      <div className="flex flex-wrap gap-2 bg-gray-200/50 p-2 rounded-2xl mb-8">
        {[
          { id: 'custom', label: '条件指定', icon: Target },
          { id: 'weakness', label: '弱点特訓', icon: AlertCircle },
          { id: 'review', label: 'リベンジ', icon: RefreshCw },
          { id: 'material', label: 'ノート確認', icon: BookOpen }
        ].map(mode => {
          const Icon = mode.icon;
          const isDisabled = (mode.id === 'review' && mistakes.length === 0);
          return (
            <button 
              key={mode.id} 
              onClick={() => { 
                if(!isDisabled) { 
                  playSound('click'); 
                  setStudyMode(mode.id); 
                  if(mode.id === 'review') setSelectedMistakes([]); 
                } 
              }}
              disabled={isDisabled}
              className={`flex-1 py-3 px-2 rounded-xl font-black text-sm md:text-base flex items-center justify-center transition-all min-w-[120px] ${
                isDisabled ? 'opacity-40 cursor-not-allowed text-gray-500' :
                studyMode === mode.id ? 'bg-white shadow-md text-indigo-700' : 'text-gray-500 hover:bg-gray-200/80'
              }`}
            >
              <Icon className="w-4 h-4 md:w-5 md:h-5 mr-1.5" /> {mode.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white p-6 md:p-10 rounded-3xl shadow-lg border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
        {studyMode === 'custom' && (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">科目</label>
                <select 
                  value={customSettings.subject} onChange={e => setCustomSettings({...customSettings, subject: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl p-4 bg-gray-50 focus:border-indigo-500 outline-none font-bold text-lg"
                >
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">単元・範囲</label>
                <input 
                  type="text" placeholder="例：二次関数"
                  value={customSettings.topic} onChange={e => setCustomSettings({...customSettings, topic: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl p-4 bg-gray-50 focus:border-indigo-500 outline-none font-bold text-lg"
                />
              </div>
            </div>
          </div>
        )}

        {studyMode === 'weakness' && (
          <div className="space-y-6 animate-fade-in text-center py-8">
            <div className="inline-block p-4 bg-red-50 rounded-full mb-2 animate-pulse">
              <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h3 className="text-2xl font-black text-gray-800">弱点特訓</h3>
            <p className="text-sm font-bold text-gray-500">AIが判断したあなたの弱点分野から優先して出題します。</p>
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              {weaknesses.length > 0 ? weaknesses.map((w,i) => <span key={i} className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-xl text-base font-bold shadow-sm">{w}</span>) : <span className="text-gray-500 font-bold p-6 bg-gray-50 rounded-xl w-full border-2 border-dashed">該当データなし</span>}
            </div>
          </div>
        )}

        {studyMode === 'review' && (
          <div className="space-y-6 animate-fade-in py-4 md:py-8">
            <div className="text-center mb-6">
              <div className="inline-block p-4 bg-orange-50 rounded-full mb-2 animate-spin-slow" style={{animationDuration: '4s'}}>
                <RefreshCw className="w-12 h-12 text-orange-500" />
              </div>
              <h3 className="text-2xl font-black text-gray-800">リベンジ特訓</h3>
              <p className="text-sm font-bold text-gray-500 mt-2">復習したい問題を選択してください。AIが数値や条件を変えた「類題」を生成します。</p>
            </div>
            
            {mistakes.length > 0 ? (
              <div className="max-h-72 overflow-y-auto bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3 shadow-inner">
                {mistakes.map(m => (
                  <label key={m.id} className={`flex items-start space-x-3 p-4 bg-white rounded-xl border-2 cursor-pointer transition-all transform hover:scale-[1.01] ${selectedMistakes.includes(m.id) ? 'border-orange-400 bg-orange-50/30 shadow-sm' : 'border-gray-100 hover:border-orange-200'}`}>
                    <input 
                      type="checkbox" 
                      checked={selectedMistakes.includes(m.id)}
                      onChange={(e) => {
                        playSound('click');
                        if (e.target.checked) setSelectedMistakes([...selectedMistakes, m.id]);
                        else setSelectedMistakes(selectedMistakes.filter(id => id !== m.id));
                      }}
                      className="mt-1 w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-black bg-gray-200 text-gray-600 px-2 py-0.5 rounded mb-2 inline-block">{m.subject}</span>
                      <p className="text-sm md:text-base font-bold text-gray-800 line-clamp-3 leading-relaxed">{m.question}</p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-center mt-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="font-bold text-gray-500">ストック中の問題はありません。</span>
              </div>
            )}
            <p className="text-right text-sm font-bold text-orange-600">選択中: {selectedMistakes.length} 問</p>
          </div>
        )}

        {studyMode === 'material' && (
          <div className="space-y-6 animate-fade-in py-8 text-center">
            {materials.length > 0 ? (
              <>
                <FileText className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-float" />
                <label className="block text-lg font-bold text-gray-700 mb-4">対象ノート</label>
                <select 
                  value={activeMaterialId || (materials.length > 0 ? materials[0].id : '')} 
                  onChange={(e) => setActiveMaterialId(Number(e.target.value))}
                  className="w-full max-w-lg mx-auto block border-2 border-gray-200 rounded-xl p-4 bg-gray-50 focus:border-indigo-500 outline-none text-left font-bold text-lg cursor-pointer"
                >
                  {materials.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </>
            ) : (
               <div className="text-gray-500 font-bold p-8 bg-gray-50 rounded-xl border-2 border-dashed">ノート未作成</div>
            )}
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-gray-100">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8">
              {studyMode === 'custom' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">難易度</label>
                <div className="flex space-x-2">
                  {['基礎', '標準', '応用'].map(level => (
                    <button
                      key={level} onClick={() => { playSound('click'); setCustomSettings({...customSettings, difficulty: level}); }}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm md:text-base font-bold transition-all ${customSettings.difficulty === level ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              )}
              <div className={studyMode !== 'custom' ? 'col-span-2' : ''}>
                <label className="block text-sm font-bold text-gray-700 mb-3">問題数</label>
                <div className="flex space-x-2">
                  {['おまかせ', 3, 5, 10].map(num => (
                    <button
                      key={num} onClick={() => { playSound('click'); setCustomSettings({...customSettings, count: num}); }}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm md:text-base font-black transition-all ${customSettings.count === num ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >
                      {num}{typeof num === 'number' && '問'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          <div className="flex justify-center">
            <button 
              onClick={startQuiz}
              disabled={isGeneratingQuiz || (studyMode === 'weakness' && weaknesses.length === 0) || (studyMode === 'material' && materials.length === 0) || (studyMode === 'review' && selectedMistakes.length === 0)}
              className={`px-12 py-5 rounded-full font-black text-xl text-white shadow-xl transition-all transform flex items-center w-full justify-center ${
                isGeneratingQuiz || (studyMode === 'weakness' && weaknesses.length === 0) || (studyMode === 'material' && materials.length === 0) || (studyMode === 'review' && selectedMistakes.length === 0)
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 hover:scale-105 active:scale-95'
              }`}
            >
              {isGeneratingQuiz ? (
                <><Loader2 className="w-7 h-7 mr-3 animate-spin" /> 生成中...</>
              ) : (
                <><Play className="w-7 h-7 mr-3 fill-current" /> 演習を開始</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlayingQuiz = () => (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pb-12">
      <div className="flex justify-between items-center bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 sticky top-0 z-20">
        <h2 className="text-xl md:text-2xl font-black text-gray-800 flex items-center">
          <Brain className="w-6 h-6 md:w-8 md:h-8 mr-2 md:mr-3 text-indigo-600" /> 演習実行中
        </h2>
        <span className="bg-indigo-100 text-indigo-800 px-4 py-1.5 md:px-5 md:py-2 rounded-full text-sm md:text-base font-black shadow-inner">
          全 {quizData.length} 問
        </span>
      </div>
      
      <div className="space-y-10">
        {quizData.map((q, index) => (
          <div key={q.id} className="bg-white p-6 md:p-10 rounded-3xl shadow-md border border-gray-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
            <p className="font-extrabold text-lg md:text-2xl mb-8 text-gray-800 leading-relaxed">
              <span className="text-blue-600 mr-2 md:mr-3 text-2xl md:text-3xl font-black font-mono">Q{index + 1}.</span>
              {q.question}
            </p>
            <div className="grid grid-cols-1 gap-4">
              {q.options.map((optObj, optIdx) => {
                const isSelected = currentAnswers[q.id] === optObj.text;
                return (
                  <button
                    key={optIdx} onClick={() => handleAnswerSelect(q.id, optObj.text)}
                    className={`w-full p-4 md:p-5 rounded-2xl border-2 text-left transition-all text-base md:text-xl transform ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 text-blue-900 font-black shadow-md scale-[1.01] ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 text-gray-700 font-bold hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className={`inline-flex shrink-0 items-center justify-center w-8 h-8 rounded-full mr-4 text-sm font-black ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {['A', 'B', 'C', 'D'][optIdx]}
                      </span>
                      {optObj.text}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center pt-8 sticky bottom-8 z-20">
        <button 
          onClick={submitQuiz}
          disabled={Object.keys(currentAnswers).length !== quizData.length}
          className="bg-gray-900 disabled:bg-gray-400 hover:bg-black shadow-2xl text-white font-black py-4 px-12 md:py-5 md:px-16 rounded-full transition-all transform hover:scale-105 active:scale-95 flex items-center text-lg md:text-xl w-full md:w-auto justify-center"
        >
          採点して結果を見る <ArrowRight className="ml-3 w-6 h-6" />
        </button>
      </div>
    </div>
  );

  const renderQuizResults = () => {
    const correctCount = quizData.filter(q => currentAnswers[q.id] === q.answer).length;
    const score = quizData.length > 0 ? Math.round((correctCount / quizData.length) * 100) : 0;
    const isHighScore = score >= 80;

    return (
      <div className="animate-fade-in flex flex-col max-w-6xl mx-auto pb-12 relative">
        {showConfetti && <Confetti />}
        
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 gap-4">
          <h2 className="text-2xl font-black text-gray-800 flex items-center">
            <CheckCircle className="w-8 h-8 mr-3 text-green-500" /> 結果
          </h2>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 mb-8">
           <div className={`flex flex-col items-center justify-center rounded-3xl p-8 md:p-10 flex-1 relative overflow-hidden animate-pop shadow-lg border-2 ${isHighScore ? 'bg-gradient-to-br from-yellow-50 to-orange-100 border-yellow-300' : 'bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200'}`}>
              <div className="relative z-10 text-center">
                <p className="text-lg font-bold text-gray-600 mb-2">スコア</p>
                <p className={`text-6xl md:text-7xl font-black drop-shadow-sm ${isHighScore ? 'text-yellow-600' : 'text-blue-700'}`}>
                  {score}<span className="text-2xl md:text-3xl ml-2">点</span>
                </p>
                <p className="text-lg md:text-xl font-bold text-gray-600 mt-4 bg-white/50 px-6 py-2 rounded-full inline-block backdrop-blur-sm">正答: {correctCount} / {quizData.length}</p>
              </div>
           </div>
           
           <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-md flex-1 lg:flex-[2]">
              <h3 className="font-extrabold text-xl mb-6 text-gray-800 border-b-2 border-gray-100 pb-4 flex items-center">
                <MessageCircle className="w-6 h-6 mr-2 text-indigo-500" /> 評価
              </h3>
              <p className="text-base md:text-lg text-gray-700 leading-relaxed font-bold bg-gray-50 p-6 rounded-2xl">
                {isHighScore 
                  ? `得点は${score}点です。該当範囲の理解度は十分に達しています。次のステップへ移行してください。` 
                  : `得点は${score}点です。基礎知識の欠落が見られます。解説を確認し、弱点の補強を行ってください。間違えた問題は自動的に「リベンジ特訓」にストックされました。`}
              </p>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h3 className="font-extrabold text-xl text-gray-800 sticky top-0 bg-[#F8FAFC] py-4 z-10 border-b">解答状況</h3>
            {quizData.map((q, i) => {
              const isCorrect = currentAnswers[q.id] === q.answer;
              return (
                <div key={q.id} className={`p-5 md:p-6 rounded-2xl border-2 transition-all ${isCorrect ? 'bg-white border-green-300 shadow-sm' : 'bg-red-50/80 border-red-300'}`}>
                  <p className="font-bold text-base md:text-lg mb-4 text-gray-800">
                    <span className="text-gray-500 mr-2">Q{i + 1}.</span>{q.question}
                  </p>
                  <div className="bg-white/80 p-4 rounded-xl border border-gray-100 shadow-inner">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <span className="text-sm font-bold text-gray-500">あなたの解答:</span>
                      <span className={`font-black text-lg ${isCorrect ? 'text-green-600' : 'text-red-600 line-through decoration-2'}`}>
                        {currentAnswers[q.id] || "無回答"}
                      </span>
                    </div>
                    {!isCorrect && currentAnswers[q.id] && (
                      <div className="mt-2 text-xs font-bold text-orange-600 bg-orange-50 inline-block px-2 py-1 rounded">
                        分析: {
                          q.options.find(o => o.text === currentAnswers[q.id])?.errorCategory === 'concept' ? '概念理解の欠如' :
                          q.options.find(o => o.text === currentAnswers[q.id])?.errorCategory === 'prerequisite' ? '前提知識の抜け漏れ' :
                          q.options.find(o => o.text === currentAnswers[q.id])?.errorCategory === 'careless' ? '処理・計算ミス' :
                          q.options.find(o => o.text === currentAnswers[q.id])?.errorCategory === 'reading' ? '読解力・条件見落とし' : '不明なエラー'
                        }
                      </div>
                    )}
                    {!isCorrect && (
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-3 border-t border-gray-200 mt-3 gap-2">
                         <span className="text-sm font-bold text-gray-500">正解:</span>
                         <span className="text-lg font-black text-green-700">{q.answer}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-6">
            <h3 className="font-extrabold text-xl text-blue-700 sticky top-0 bg-[#F8FAFC] py-4 z-10 border-b flex items-center">
              <Brain className="w-6 h-6 mr-2" /> 解説
            </h3>
            {quizData.map((q, i) => {
              const isCorrect = currentAnswers[q.id] === q.answer;
              return (
                <div key={q.id} className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6 shadow-sm">
                  <div className="flex items-center mb-5">
                    <span className={`w-8 h-8 md:w-10 md:h-10 rounded-full inline-flex items-center justify-center text-white font-black text-base md:text-lg mr-4 shadow-md ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                      Q{i+1}
                    </span>
                    <h4 className={`font-extrabold text-lg md:text-xl ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                      {isCorrect ? '正解' : '不正解'}
                    </h4>
                  </div>
                  
                  {!isCorrect && (
                    <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-5 rounded-r-xl">
                      <strong className="block mb-1 text-orange-900 font-bold flex items-center text-sm md:text-base">
                        <AlertCircle className="w-4 h-4 mr-1" /> 弱点判定
                      </strong>
                      <p className="text-sm text-orange-800 font-bold">
                        「{q.weaknessTag}」の理解不足。
                      </p>
                    </div>
                  )}
                  
                  <div className="bg-indigo-50/50 border border-indigo-100 p-4 md:p-5 rounded-2xl text-gray-800 text-sm md:text-base leading-relaxed font-bold relative">
                    {q.explanation.split('\n').map((line, idx) => <span key={idx}>{line}<br /></span>)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t-2 border-gray-200 flex justify-center">
          <button 
            onClick={() => { playSound('click'); setQuizState('start'); }}
            className="bg-gray-900 hover:bg-black text-white px-10 py-4 md:px-16 md:py-5 rounded-full font-black text-lg md:text-xl transition-all shadow-xl transform hover:scale-105 active:scale-95 flex items-center w-full md:w-auto justify-center"
          >
            終了してテストメニューへ戻る <ChevronRight className="w-6 h-6 ml-2" />
          </button>
        </div>
      </div>
    );
  };

  const renderExam = () => {
    if (examState === 'start') {
      return (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
          <div className="text-center mb-10 pt-6">
            <div className="inline-block p-4 bg-purple-50 rounded-full mb-4 animate-pop">
              <Award className="w-12 h-12 md:w-14 md:h-14 text-purple-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800 mb-2">実践模試モード</h2>
            <p className="text-gray-600 font-medium text-sm md:text-base">大学受験・高校受験レベルの本格的な模試（大問＋小問形式）を生成します。</p>
          </div>
          <div className="bg-white p-6 md:p-10 rounded-3xl shadow-xl border border-gray-100">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">受験科目</label>
                <select 
                  value={examSettings.subject} onChange={e => setExamSettings({...examSettings, subject: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl p-4 bg-gray-50 focus:border-purple-500 outline-none font-bold text-lg cursor-pointer"
                >
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">志望レベル・難易度</label>
                <select 
                  value={examSettings.level} onChange={e => setExamSettings({...examSettings, level: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl p-4 bg-gray-50 focus:border-purple-500 outline-none font-bold text-base cursor-pointer"
                >
                  <optgroup label="中学・高校受験">
                    <option value="基礎固めレベル">基礎固めレベル</option>
                    <option value="高校受験（標準）">高校受験（標準レベル）</option>
                    <option value="高校受験（難関）">高校受験（難関レベル）</option>
                  </optgroup>
                  <optgroup label="大学受験">
                    <option value="大学受験（共通テスト）">大学受験（共通テストレベル）</option>
                    <option value="大学受験（中堅私大）">大学受験（中堅大・MARCH/地方国公立レベル）</option>
                    <option value="大学受験（難関二次）">大学受験（難関国公立・早慶レベル）</option>
                  </optgroup>
                </select>
              </div>
            </div>
            
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-700 mb-3">問題数（制限時間は1問=1分で自動設定されます）</label>
              <div className="flex flex-wrap gap-2 md:gap-3">
                {[
                  { label: 'ミニ模試', count: 5, desc: 'サクッと実力試し' },
                  { label: 'ハーフ模試', count: 15, desc: '標準的な演習量' },
                  { label: 'フル模試', count: 30, desc: '本番さながらの分量' }
                ].map(opt => (
                  <button
                    key={opt.count} 
                    onClick={() => { playSound('click'); setExamSettings({...examSettings, count: opt.count}); }}
                    className={`flex-1 min-w-[100px] md:min-w-[120px] p-3 md:p-4 rounded-xl border-2 text-left transition-all ${examSettings.count === opt.count ? 'bg-purple-50 border-purple-500 shadow-md ring-2 ring-purple-100' : 'bg-white border-gray-200 hover:border-purple-300'}`}
                  >
                    <p className={`font-black text-base md:text-lg ${examSettings.count === opt.count ? 'text-purple-700' : 'text-gray-800'}`}>{opt.count}問 <span className="text-xs md:text-sm font-bold text-gray-500">({opt.count}分)</span></p>
                    <p className={`text-[10px] md:text-xs font-bold mt-1 ${examSettings.count === opt.count ? 'text-purple-600' : 'text-gray-500'}`}>{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-purple-50 p-5 md:p-6 rounded-2xl border border-purple-100 mb-10">
              <h4 className="font-black text-purple-900 mb-3 flex items-center text-base md:text-lg">
                <Timer className="w-5 h-5 md:w-6 md:h-6 mr-2" /> 試験概要
              </h4>
              <ul className="text-sm md:text-base text-purple-800 font-medium space-y-2 list-disc list-inside">
                <li>問題数：{examSettings.count}問（制限時間: {examSettings.count}分）</li>
                <li>「{examSettings.level}」に対応した長文や資料ベースの大問形式で出題されます。</li>
                {examSettings.count >= 15 && <li className="text-red-600 font-bold">※問題数が多い場合、AIの生成に30秒〜1分程度かかる場合があります。</li>}
              </ul>
            </div>
            <div className="flex justify-center">
              <button 
                onClick={startExam} disabled={isGeneratingQuiz}
                className={`px-10 py-4 md:px-14 md:py-5 rounded-full font-black text-lg md:text-xl text-white shadow-xl transition-all flex items-center transform w-full justify-center md:w-auto ${
                  isGeneratingQuiz ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 hover:scale-105 active:scale-95'
                }`}
              >
                {isGeneratingQuiz ? (
                  <><Loader2 className="w-6 h-6 mr-3 animate-spin" /> {examSettings.count}問の模試を生成中...</>
                ) : (
                  <>模試を開始する <ChevronRight className="w-6 h-6 ml-2" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (examState === 'playing') {
       const currentQ = examData[examCurrentIndex];
       const isLast = examCurrentIndex === examData.length - 1;
       const answeredCount = Object.keys(examAnswers).length;

       return (
        <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-140px)] flex flex-col animate-fade-in max-w-5xl mx-auto pb-10 md:pb-0">
          <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900 text-white p-4 md:p-5 rounded-t-3xl shrink-0 shadow-lg relative z-20 gap-3">
            <div className="flex items-center justify-between w-full md:w-auto">
              <span className="font-black text-lg md:text-xl flex items-center"><Award className="w-5 h-5 md:w-6 md:h-6 mr-2 text-yellow-400"/> 実践模試：{examSettings.subject}</span>
            </div>
            <div className="flex items-center space-x-4 w-full md:w-auto justify-between md:justify-end">
              <span className="text-xs md:text-sm font-bold text-gray-300 bg-gray-800 px-3 py-1 rounded-full">解答済み: {answeredCount}/{examData.length}</span>
              <div className={`flex items-center font-mono text-xl md:text-3xl font-black px-4 md:px-5 py-1.5 md:py-2 rounded-xl transition-colors ${examTimeRemaining < 60 ? 'bg-red-600 text-white animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.7)]' : 'bg-gray-800 text-green-400'}`}>
                <Timer className="w-5 h-5 md:w-8 md:h-8 mr-2 md:mr-3" />
                {formatTime(examTimeRemaining)}
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden bg-white border-x border-b border-gray-200 rounded-b-3xl shadow-md">
            
            {/* モバイル用ナビゲーション（上部配置） */}
            <div className="md:hidden w-full bg-gray-50 border-b border-gray-200 p-3 flex overflow-x-auto gap-2 shrink-0">
               {examData.map((q, idx) => {
                  const isAnswered = !!examAnswers[q.id];
                  const isCurrent = idx === examCurrentIndex;
                  const isFlagged = examReviewFlags[q.id];
                  return (
                    <button 
                      key={q.id} onClick={() => { playSound('click'); setExamCurrentIndex(idx); }}
                      className={`relative px-4 py-2 rounded-lg font-black border-2 transition-all flex-shrink-0 text-sm ${
                        isCurrent ? 'border-indigo-600 bg-indigo-50 shadow-md text-indigo-700' :
                        isAnswered ? 'border-gray-300 bg-gray-100 text-gray-600' : 'border-gray-200 bg-white text-gray-400'
                      }`}
                    >
                      問{q.groupSubIndex}
                      {isFlagged && <Flag className="absolute -top-1.5 -right-1.5 w-4 h-4 text-yellow-500 fill-current drop-shadow-sm" />}
                    </button>
                  )
                })}
            </div>

            <div className="flex-1 p-5 md:p-10 overflow-y-auto relative bg-gray-50/50">
              
              <div className="flex justify-between items-start mb-6">
                 <span className="text-xl md:text-3xl font-black text-gray-800 border-b-4 border-indigo-500 pb-1 md:pb-2">
                   {currentQ.groupTitle} <span className="text-base md:text-xl text-gray-500 ml-2">問 {currentQ.groupSubIndex}</span>
                 </span>
                 <button 
                   onClick={() => { playSound('click'); setExamReviewFlags({...examReviewFlags, [currentQ.id]: !examReviewFlags[currentQ.id]}); }}
                   className={`flex items-center px-3 py-1.5 md:px-5 md:py-2 rounded-full text-xs md:text-sm font-bold transition-all ${examReviewFlags[currentQ.id] ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-400 shadow-sm transform scale-105' : 'bg-white border-2 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                 >
                   <Flag className={`w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 ${examReviewFlags[currentQ.id] ? 'fill-current text-yellow-500 animate-pulse' : ''}`} /> 
                   見直す
                 </button>
              </div>

              <div className="bg-indigo-50/50 p-4 md:p-8 rounded-2xl border border-indigo-100 mb-6 md:mb-8 text-gray-800 text-sm md:text-lg leading-relaxed md:leading-loose font-medium whitespace-pre-wrap shadow-inner">
                 <strong className="flex items-center text-indigo-800 mb-2"><BookOpen className="w-4 h-4 md:w-5 md:h-5 mr-2" />共通の資料・リード文</strong>
                 {currentQ.theme}
              </div>

              <p className="text-lg md:text-2xl text-gray-900 leading-relaxed mb-6 md:mb-8 font-bold bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-indigo-600 mr-2 font-black text-xl md:text-3xl">Q.</span>{currentQ.question}
              </p>

              <div className="space-y-3 md:space-y-4">
                {currentQ.options.map((optObj, idx) => (
                  <button
                    key={idx} onClick={() => { playSound('click'); setExamAnswers({...examAnswers, [currentQ.id]: optObj.text}); }}
                    className={`w-full p-4 md:p-6 rounded-2xl border-2 text-left transition-all text-base md:text-xl font-bold transform ${
                      examAnswers[currentQ.id] === optObj.text 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-md ring-4 ring-indigo-100 scale-[1.01]' 
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-white bg-white text-gray-700 hover:scale-[1.01]'
                    }`}
                  >
                    <span className="inline-block w-8 md:w-10 font-black text-gray-400 mr-2 md:mr-3">{idx + 1}.</span> {optObj.text}
                  </button>
                ))}
              </div>

              <div className="mt-10 md:mt-16 flex flex-col sm:flex-row justify-between items-center pt-6 md:pt-8 border-t-2 border-gray-200 gap-4">
                <button 
                  onClick={() => { playSound('click'); setExamCurrentIndex(prev => Math.max(0, prev - 1)); }} disabled={examCurrentIndex === 0}
                  className="flex items-center justify-center w-full sm:w-auto px-6 py-4 rounded-xl font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition-colors text-base md:text-lg"
                >
                  <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 mr-2" /> 前の問題
                </button>
                {isLast ? (
                  <button 
                    onClick={() => { playSound('click'); submitExam(false); }}
                    className="flex items-center justify-center w-full sm:w-auto px-8 md:px-10 py-4 rounded-full font-black text-white bg-red-600 hover:bg-red-700 shadow-xl transform hover:scale-105 active:scale-95 text-lg md:text-xl"
                  >
                    模試を終了して提出 <CheckCircle className="w-5 h-5 md:w-6 md:h-6 ml-2 md:ml-3" />
                  </button>
                ) : (
                  <button 
                    onClick={() => { playSound('click'); setExamCurrentIndex(prev => Math.min(examData.length - 1, prev + 1)); }}
                    className="flex items-center justify-center w-full sm:w-auto px-8 py-4 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-colors text-base md:text-lg"
                  >
                    次の問題 <ChevronRight className="w-5 h-5 md:w-6 md:h-6 ml-2" />
                  </button>
                )}
              </div>
            </div>
            
            {/* PC用ナビゲーション（右側） */}
            <div className="hidden md:flex w-72 bg-white border-l-2 border-gray-100 p-6 flex-col shrink-0 shadow-inner z-10">
              <h3 className="text-base font-black text-gray-500 mb-6 flex items-center border-b pb-3"><LayoutDashboard className="w-5 h-5 mr-2" /> 問題一覧</h3>
              <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto content-start p-1">
                {examData.map((q, idx) => {
                  const isAnswered = !!examAnswers[q.id];
                  const isCurrent = idx === examCurrentIndex;
                  const isFlagged = examReviewFlags[q.id];
                  return (
                    <button 
                      key={q.id} onClick={() => { playSound('click'); setExamCurrentIndex(idx); }}
                      className={`relative py-3 rounded-xl font-black border-2 transition-all transform hover:scale-105 ${
                        isCurrent ? 'border-indigo-600 bg-indigo-50 shadow-md text-indigo-700 ring-2 ring-indigo-200' :
                        isAnswered ? 'border-gray-300 bg-gray-100 text-gray-600' : 'border-gray-200 bg-white text-gray-400'
                      }`}
                    >
                      <div className="text-xs text-gray-400 mb-1">{q.groupTitle}</div>
                      <div className="text-lg">問 {q.groupSubIndex}</div>
                      {isFlagged && <Flag className="absolute -top-2 -right-2 w-6 h-6 text-yellow-500 fill-current drop-shadow-sm animate-bounce" />}
                    </button>
                  )
                })}
              </div>
              <button 
                onClick={() => { playSound('click'); submitExam(false); }}
                className="mt-6 w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-lg hover:bg-black transition-colors shadow-lg"
              >
                途中提出
              </button>
            </div>
          </div>
        </div>
       );
    }

    // Results logic...
    const correctCount = examData.filter(q => examAnswers[q.id] === q.answer).length;
    const score = examData.length > 0 ? Math.round((correctCount / examData.length) * 100) : 0;
    const isHighScore = score >= 80;
    
    let grade = 'E'; let gradeColor = 'text-gray-600'; let gradeBg = 'bg-gray-100'; let feedback = '';
    if (score >= 90) { grade = 'S'; gradeColor = 'text-yellow-500'; gradeBg = 'bg-yellow-50 border-yellow-200 shadow-[0_0_30px_rgba(234,179,8,0.3)]'; feedback = '完璧に近い素晴らしい成績です！このレベルは完全にマスターしています。'; }
    else if (score >= 80) { grade = 'A'; gradeColor = 'text-blue-500'; gradeBg = 'bg-blue-50 border-blue-200'; feedback = '優秀な成績です。合格圏内に十分入っています。間違えた少数の問題を確実に復習しましょう。'; }
    else if (score >= 60) { grade = 'B'; gradeColor = 'text-green-500'; gradeBg = 'bg-green-50 border-green-200'; feedback = '標準的な成績です。基礎はできていますが、応用問題で失点している可能性があります。'; }
    else if (score >= 40) { grade = 'C'; gradeColor = 'text-orange-500'; gradeBg = 'bg-orange-50 border-orange-200'; feedback = 'もう一歩です。理解が曖昧な単元がいくつかあるようです。間違えた問題は「リベンジ特訓」で復習しましょう。'; }
    else { feedback = '基礎からしっかり復習し直す必要があります。AIノートを使って根本的な理解を深めましょう。'; }

    return (
      <div className="animate-fade-in max-w-5xl mx-auto space-y-6 md:space-y-8 pb-12 relative">
        {showConfetti && <Confetti />}
        
        <div className="flex justify-between items-center border-b-2 border-gray-200 pb-4 md:pb-5 mb-4">
          <h2 className="text-2xl md:text-3xl font-black text-gray-800 flex items-center">
            <Award className="w-6 h-6 md:w-8 md:h-8 mr-2 md:mr-3 text-indigo-600" /> 模試成績表
          </h2>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-10 flex flex-col md:flex-row items-center md:items-stretch gap-6 md:gap-10">
          <div className={`flex flex-col items-center justify-center rounded-3xl p-6 md:p-8 border-4 w-full md:min-w-[240px] animate-pop relative overflow-hidden ${gradeBg}`}>
            {grade === 'S' && <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0,transparent_100%)] opacity-70 animate-pulse-glow"></div>}
            <span className="text-sm md:text-base font-bold text-gray-500 mb-1 md:mb-2 relative z-10">総合評価</span>
            <div className="relative z-10">
               {grade === 'S' && <Crown className="w-10 h-10 md:w-12 md:h-12 text-yellow-500 absolute -top-8 md:-top-10 left-1/2 transform -translate-x-1/2 drop-shadow-md animate-bounce" />}
               <span className={`text-6xl md:text-8xl font-black ${gradeColor} drop-shadow-lg font-mono`}>{grade}</span>
            </div>
            <span className="text-sm md:text-base font-bold text-gray-500 mt-1 md:mt-2 relative z-10">判定</span>
          </div>
          
          <div className="flex-1 flex flex-col justify-center w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 md:mb-6 border-b-2 border-gray-100 pb-4 md:pb-6 gap-4">
              <div>
                <p className="text-gray-500 font-bold mb-2 flex items-center bg-gray-100 inline-block px-3 py-1 rounded-md text-xs md:text-sm"><Target className="w-3 h-3 md:w-4 md:h-4 mr-1"/> {examSettings.subject} / {examSettings.level}</p>
                <p className="text-5xl md:text-6xl font-black text-gray-800">{score} <span className="text-xl md:text-2xl text-gray-500">点</span></p>
              </div>
              <div className="text-left sm:text-right bg-gray-50 p-4 rounded-xl border border-gray-200 w-full sm:w-auto">
                <p className="text-xs md:text-sm font-bold text-gray-500 mb-1">正答数</p>
                <p className="text-2xl md:text-3xl font-black text-gray-700">{correctCount} <span className="text-base md:text-lg text-gray-400">/ {examData.length}</span></p>
              </div>
            </div>
            <div className="bg-indigo-50 p-4 md:p-6 rounded-2xl text-indigo-900 text-sm md:text-lg leading-relaxed border border-indigo-100 shadow-sm font-medium">
              <strong className="flex items-center text-indigo-700 mb-2"><MessageCircle className="w-4 h-4 md:w-5 md:h-5 mr-2" />AI講評</strong>
              {feedback}
            </div>
          </div>
        </div>

        <h3 className="text-xl md:text-2xl font-black text-gray-800 pt-6 md:pt-8 pb-3 md:pb-4 border-b-2">解答・詳細解説</h3>
        <div className="space-y-8 md:space-y-12">
          {examData.map((q, i) => {
            const isCorrect = examAnswers[q.id] === q.answer;
            return (
              <div key={q.id} className="bg-white rounded-3xl shadow-md border border-gray-200 overflow-hidden">
                <div className={`px-5 py-4 md:px-8 md:py-5 border-b-2 flex flex-col sm:flex-row justify-between sm:items-center gap-3 ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center space-x-3 md:space-x-4">
                    <span className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full text-white font-black text-lg md:text-xl shadow-sm ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                      {i + 1}
                    </span>
                    <span className="font-bold text-gray-500 text-sm md:text-base">{q.groupTitle} - 問{q.groupSubIndex}</span>
                    <span className={`font-black text-lg md:text-xl ml-1 md:ml-2 ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                      {isCorrect ? '正解' : '不正解'}
                    </span>
                  </div>
                  {!isCorrect && <span className="text-xs md:text-sm font-bold bg-white text-red-600 px-3 py-1.5 md:px-4 md:py-2 rounded-lg border border-red-200 shadow-sm flex items-center self-start sm:self-auto"><AlertCircle className="w-3 h-3 md:w-4 md:h-4 mr-1"/>弱点: {q.weaknessTag}</span>}
                </div>
                
                <div className="p-5 md:p-8">
                  <div className="bg-gray-50 p-4 md:p-6 rounded-2xl border border-gray-200 mb-6 md:mb-8 text-gray-600 text-xs md:text-sm leading-relaxed whitespace-pre-wrap">
                    <strong className="block mb-2 text-gray-800"><BookOpen className="w-3 h-3 md:w-4 md:h-4 inline mr-1"/>リード文・資料</strong>
                    {q.theme}
                  </div>

                  <p className="font-extrabold text-gray-800 text-lg md:text-xl mb-6 md:mb-8 leading-relaxed"><span className="text-indigo-500 mr-2">Q.</span>{q.question}</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8 mb-6 md:mb-8">
                    <div className="bg-gray-50 p-4 md:p-5 rounded-2xl border border-gray-200">
                      <p className="text-xs md:text-sm text-gray-500 font-bold mb-2 md:mb-3 flex items-center"><UserCircle className="w-3 h-3 md:w-4 md:h-4 mr-1"/> あなたの解答</p>
                      <p className={`p-3 md:p-4 rounded-xl border-2 font-black text-sm md:text-lg ${isCorrect ? 'border-green-300 bg-green-100 text-green-800' : 'border-red-300 bg-red-100 text-red-800 line-through decoration-2'}`}>
                        {examAnswers[q.id] || '無回答'}
                      </p>
                      {!isCorrect && examAnswers[q.id] && (
                        <div className="mt-3 text-xs font-bold text-orange-600 bg-orange-50 inline-block px-3 py-1.5 rounded-lg border border-orange-100">
                          エラー分析: {
                            q.options.find(o => o.text === examAnswers[q.id])?.errorCategory === 'concept' ? '概念理解の欠如' :
                            q.options.find(o => o.text === examAnswers[q.id])?.errorCategory === 'prerequisite' ? '前提知識の抜け漏れ' :
                            q.options.find(o => o.text === examAnswers[q.id])?.errorCategory === 'careless' ? '処理・計算ミス' :
                            q.options.find(o => o.text === examAnswers[q.id])?.errorCategory === 'reading' ? '読解力・条件見落とし' : '不明'
                          }
                        </div>
                      )}
                    </div>
                    <div className="bg-indigo-50 p-4 md:p-5 rounded-2xl border border-indigo-100">
                      <p className="text-xs md:text-sm text-indigo-500 font-bold mb-2 md:mb-3 flex items-center"><CheckCircle className="w-3 h-3 md:w-4 md:h-4 mr-1"/> 正解</p>
                      <p className="p-3 md:p-4 rounded-xl border-2 border-indigo-300 bg-white text-indigo-800 font-black text-sm md:text-lg">
                        {q.answer}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-5 md:p-8 rounded-2xl border border-gray-200 text-gray-800 text-sm md:text-base leading-relaxed font-medium relative shadow-inner">
                    <strong className="flex items-center text-gray-900 mb-3 md:mb-4 text-base md:text-lg border-b pb-2"><FileText className="w-4 h-4 md:w-5 md:h-5 mr-2 text-indigo-600"/>詳細解説</strong>
                    {q.explanation.split('\n').map((line, idx) => <span key={idx}>{line}<br /></span>)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        <div className="mt-10 md:mt-12 pt-6 md:pt-8 border-t-2 border-gray-200 flex justify-center">
          <button 
            onClick={() => { playSound('click'); setExamState('start'); }}
            className="bg-gray-900 hover:bg-black text-white px-10 py-4 md:px-16 md:py-5 rounded-full font-black text-base md:text-xl transition-all shadow-xl transform hover:scale-105 active:scale-95 flex items-center w-full md:w-auto justify-center"
          >
            終了して模試メニューへ戻る <ChevronRight className="w-5 h-5 md:w-6 md:h-6 ml-2" />
          </button>
        </div>
      </div>
    );
  };

  const renderFlashcards = () => {
    const currentCard = pendingFlashcards.length > 0 && currentCardIndex < pendingFlashcards.length 
      ? pendingFlashcards[currentCardIndex] 
      : null;

    return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto h-full flex flex-col pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-gray-200 pb-4 shrink-0 gap-4">
        <div className="flex items-center">
          <Layers className="w-8 h-8 mr-3 text-indigo-600" />
          <div>
            <h2 className="text-2xl font-black text-gray-800">重要語句 単語帳</h2>
            <p className="text-sm font-bold text-gray-500">AIノートやテーマから抽出したキーワードの反復学習</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 w-full md:w-auto">
          <div className="flex bg-gray-200 p-1 rounded-xl w-max self-start md:self-end">
            <button onClick={() => setFlashcardTab('study')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center ${flashcardTab === 'study' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <Brain size={16} className="mr-1.5"/> 学習する
            </button>
            <button onClick={() => setFlashcardTab('list')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center ${flashcardTab === 'list' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <ListIcon size={16} className="mr-1.5"/> 一覧・管理
            </button>
          </div>
        </div>
      </div>

      {flashcardTab === 'list' ? (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col h-full animate-fade-in">
          <div className="flex flex-wrap md:flex-nowrap gap-3 items-center w-full mb-6 border-b border-gray-100 pb-4">
            <button 
              onClick={() => { playSound('click'); setShowFlashcardGenerator(!showFlashcardGenerator); }}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center justify-center flex-1 md:flex-none h-11 ${showFlashcardGenerator ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'}`}
            >
              <Zap className="w-4 h-4 mr-1.5" /> AIで作成
            </button>
            <select 
              value={flashcardSubject} 
              onChange={(e) => { setFlashcardSubject(e.target.value); setFlashcardTheme('すべて'); playSound('click'); }}
              className="border-2 border-gray-200 rounded-xl px-4 py-2.5 font-bold text-gray-700 focus:outline-none focus:border-indigo-500 bg-white flex-1 md:flex-none text-sm h-11"
            >
              <option value="すべて">全科目</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select 
              value={filterCardFolder} 
              onChange={(e) => { setFilterCardFolder(e.target.value); playSound('click'); }}
              className="border-2 border-gray-200 rounded-xl px-4 py-2.5 font-bold text-gray-700 focus:outline-none focus:border-indigo-500 bg-white flex-1 md:flex-none text-sm h-11"
            >
              <option value="すべて">全フォルダー</option>
              {folders.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {renderFolderManager()}
          </div>

          {showFlashcardGenerator && (
            <form onSubmit={handleGenerateFlashcards} className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 flex flex-col md:flex-row gap-4 mb-6 animate-fade-in shadow-inner shrink-0">
               <div className="flex flex-col flex-1">
                 <label className="text-xs font-bold text-indigo-800 mb-1">科目</label>
                 <select value={flashcardGenSubject} onChange={e => setFlashcardGenSubject(e.target.value)} className="p-3 rounded-xl border-2 border-indigo-200 focus:border-indigo-500 outline-none font-bold text-gray-700 bg-white">
                   {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
               </div>
               <div className="flex flex-col flex-[1.5]">
                 <label className="text-xs font-bold text-indigo-800 mb-1">テーマ・単元を入力</label>
                 <input type="text" placeholder="例: 平安時代の文化" value={flashcardPrompt} onChange={e => setFlashcardPrompt(e.target.value)} className="p-3 rounded-xl border-2 border-indigo-200 focus:border-indigo-500 outline-none font-bold text-gray-800" />
               </div>
               <div className="flex flex-col flex-1">
                 <label className="text-xs font-bold text-indigo-800 mb-1">保存先フォルダー</label>
                 <select value={flashcardGenFolder} onChange={e => setFlashcardGenFolder(e.target.value)} className="p-3 rounded-xl border-2 border-indigo-200 focus:border-indigo-500 outline-none font-bold text-gray-700 bg-white">
                   {folders.map(f => <option key={f} value={f}>{f}</option>)}
                 </select>
               </div>
               <div className="flex flex-col justify-end">
                 <button type="submit" disabled={isGeneratingCardsDirectly || !flashcardPrompt.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-black px-6 py-3 rounded-xl flex items-center justify-center transition-all shadow-md transform hover:scale-105 active:scale-95 h-[52px]">
                   {isGeneratingCardsDirectly ? <Loader2 className="w-5 h-5 mr-2 animate-spin"/> : <Zap className="w-5 h-5 mr-2"/>} 生成する
                 </button>
               </div>
            </form>
          )}

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {filteredListCards.length > 0 ? filteredListCards.map(card => (
              isEditingCardId === card.id && editCardData ? (
                <div key={card.id} className="border-2 border-indigo-300 bg-indigo-50/30 p-4 rounded-xl flex flex-col gap-3 animate-fade-in shadow-inner">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-500 mb-1 block">表面（問題）</label>
                      <input value={editCardData.front || ''} onChange={e => setEditCardData({...editCardData, front: e.target.value})} className="w-full border p-2 rounded-lg font-bold" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-500 mb-1 block">裏面（解答）</label>
                      <textarea value={editCardData.back || ''} onChange={e => setEditCardData({...editCardData, back: e.target.value})} className="w-full border p-2 rounded-lg font-medium text-sm" rows={2} />
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-3 items-end justify-between border-t border-indigo-100 pt-3">
                    <div className="flex gap-3 w-full md:w-auto">
                      <div className="flex-1 md:flex-none">
                        <label className="text-xs font-bold text-gray-500 mb-1 block">科目</label>
                        <select value={editCardData.subject || SUBJECTS[0]} onChange={e => setEditCardData({...editCardData, subject: e.target.value})} className="w-full border p-2 rounded-lg font-bold text-sm bg-white">
                          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="flex-1 md:flex-none">
                        <label className="text-xs font-bold text-gray-500 mb-1 block">フォルダー</label>
                        <select value={editCardData.folder || '未分類'} onChange={e => setEditCardData({...editCardData, folder: e.target.value})} className="w-full border p-2 rounded-lg font-bold text-sm bg-white">
                          {folders.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto mt-3 md:mt-0">
                      <button onClick={() => setIsEditingCardId(null)} className="flex-1 md:flex-none px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">キャンセル</button>
                      <button onClick={saveFlashcardEdit} className="flex-1 md:flex-none px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center"><Save size={16} className="mr-1.5"/>保存</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={card.id} className="border-2 border-gray-100 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center hover:border-indigo-200 hover:shadow-md transition-all bg-white group gap-4">
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">{card.subject}</span>
                      <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 flex items-center"><Folder size={12} className="mr-1"/>{card.folder || '未分類'}</span>
                      {card.isMemorized && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200 flex items-center"><CheckCircle size={12} className="mr-1"/>暗記済</span>}
                    </div>
                    <div className="flex flex-col md:flex-row gap-2 md:gap-4">
                      <div className="flex-1"><span className="text-xs text-gray-400 font-bold block mb-0.5">表面</span><h4 className="font-black text-lg text-gray-800">{card.front}</h4></div>
                      <div className="flex-[2]"><span className="text-xs text-gray-400 font-bold block mb-0.5">裏面</span><p className="text-gray-600 text-sm font-medium">{card.back}</p></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 md:gap-2 self-end md:self-auto shrink-0">
                    <button onClick={() => { playSound('click'); setEditCardData(card); setIsEditingCardId(card.id); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={18}/></button>
                    <button onClick={() => deleteFlashcard(card.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                  </div>
                </div>
              )
            )) : (
              <div className="text-center py-12 text-gray-400 font-bold bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <Layers className="w-12 h-12 mx-auto mb-2 opacity-50"/>
                カードがありません
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* 学習モードのフィルター */}
          <div className="flex flex-wrap gap-2 md:gap-3 w-full border-b border-gray-200 pb-4">
            <select 
              value={flashcardSubject} 
              onChange={(e) => { setFlashcardSubject(e.target.value); setFlashcardTheme('すべて'); playSound('click'); }}
              className="border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-gray-700 focus:outline-none focus:border-indigo-500 bg-white flex-1 md:flex-none min-w-[100px] text-sm"
            >
              <option value="すべて">全科目</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select 
              value={filterCardFolder} 
              onChange={(e) => { setFilterCardFolder(e.target.value); playSound('click'); }}
              className="border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-gray-700 focus:outline-none focus:border-indigo-500 bg-white flex-1 md:flex-none min-w-[120px] text-sm"
            >
              <option value="すべて">全フォルダー</option>
              {folders.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select 
              value={flashcardTheme} 
              onChange={(e) => { setFlashcardTheme(e.target.value); playSound('click'); }}
              className="border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-gray-700 focus:outline-none focus:border-indigo-500 bg-white flex-[2] md:flex-none md:max-w-xs text-sm"
            >
              <option value="すべて">全テーマ(AI自動分類)</option>
              {availableThemes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-4">
            {pendingFlashcards.length > 0 && currentCard ? (
              <>
                <div className="w-full max-w-2xl aspect-[4/3] md:aspect-video perspective-1000 cursor-pointer group" onClick={() => { playSound('click'); setIsCardFlipped(!isCardFlipped); }}>
                  <div className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${isCardFlipped ? 'rotate-y-180' : ''}`}>
                    {/* 表面 */}
                    <div className="absolute inset-0 backface-hidden bg-white border-2 border-gray-200 rounded-3xl shadow-lg flex flex-col items-center justify-center p-6 md:p-8 group-hover:shadow-xl transition-shadow">
                       <span className="absolute top-4 left-4 md:top-6 md:left-6 text-gray-400 font-bold">Q.</span>
                       <span className="absolute top-4 right-4 md:top-6 md:right-6 text-indigo-500 font-bold bg-indigo-50 px-2 py-1 md:px-3 md:py-1 rounded-lg text-xs md:text-sm">
                         {currentCard?.subject} {currentCard?.folder && currentCard.folder !== '未分類' ? `- ${currentCard.folder}` : ''}
                       </span>
                       <h3 className="text-3xl md:text-5xl font-black text-gray-800 text-center leading-tight">{currentCard?.front}</h3>
                       <p className="absolute bottom-4 md:bottom-6 text-xs md:text-sm font-bold text-indigo-400 flex items-center"><RefreshCcw className="w-3 h-3 md:w-4 md:h-4 mr-1"/>タップして裏返す</p>
                    </div>
                    {/* 裏面 */}
                    <div className="absolute inset-0 backface-hidden bg-indigo-50 border-2 border-indigo-200 rounded-3xl shadow-lg flex flex-col items-center justify-center p-6 md:p-12 rotate-y-180">
                       <span className="absolute top-4 left-4 md:top-6 md:left-6 text-indigo-400 font-bold">A.</span>
                       <p className="text-lg md:text-2xl font-bold text-gray-800 text-center leading-relaxed">{currentCard?.back}</p>
                    </div>
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="flex items-center space-x-4 md:space-x-8 mt-8">
                  <button 
                    onClick={(e) => { e.stopPropagation(); playSound('click'); setIsCardFlipped(false); setTimeout(() => setCurrentCardIndex(prev => prev > 0 ? prev - 1 : pendingFlashcards.length - 1), 150); }}
                    className="p-3 md:p-4 bg-white rounded-full shadow-md hover:bg-gray-50 border border-gray-100 transition-transform hover:scale-110"
                  >
                    <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
                  </button>
                  
                  <button
                    onClick={(e) => handleMemorizedCard(e, currentCard.id)}
                    className="px-6 py-3 md:px-8 md:py-4 bg-green-500 hover:bg-green-600 text-white rounded-full font-black shadow-lg flex items-center transition-all transform hover:scale-105 active:scale-95 text-sm md:text-lg"
                  >
                    <CheckCircle className="w-5 h-5 md:w-6 md:h-6 mr-2" /> 覚えた！
                  </button>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); playSound('click'); setIsCardFlipped(false); setTimeout(() => setCurrentCardIndex(prev => prev < pendingFlashcards.length - 1 ? prev + 1 : 0), 150); }}
                    className="p-3 md:p-4 bg-indigo-600 rounded-full shadow-md hover:bg-indigo-700 text-white transition-transform hover:scale-110"
                  >
                    <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>
                <p className="font-bold text-gray-400 mt-4 text-sm">残り {pendingFlashcards.length} 枚</p>
              </>
            ) : (
              <div className="text-center text-gray-500 font-bold bg-white p-10 rounded-3xl border-2 border-dashed border-gray-200 animate-pop">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
                <h3 className="text-2xl font-black text-gray-800 mb-2">すべて覚えました！</h3>
                <p className="mb-6">この条件の未学習カードはありません。</p>
                <button
                  onClick={() => {
                    playSound('click');
                    if(!user) return;
                    flashcards.forEach(async (c) => {
                      if ((flashcardSubject === 'すべて' || c.subject === flashcardSubject) && 
                          (flashcardTheme === 'すべて' || c.theme === flashcardTheme) &&
                          (filterCardFolder === 'すべて' || (c.folder || '未分類') === filterCardFolder)) {
                            try {
                              await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'flashcards', c.id), { isMemorized: false });
                            } catch(e){}
                      }
                    });
                  }}
                  className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-full font-bold shadow-sm hover:bg-indigo-100 border border-indigo-200 transition-colors"
                >
                  もう一度最初から学習する
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

  const renderRoadmap = () => {
    const currentRoadmapSteps = getRoadmapSteps();
    
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-12">
        <div className="flex items-center border-b-2 border-gray-200 pb-4 mb-8">
          <Map className="w-8 h-8 mr-3 text-indigo-600" />
          <div>
            <h2 className="text-2xl font-black text-gray-800">学習ロードマップ</h2>
            <p className="text-sm font-bold text-gray-500">あなたの実際の学習状況と連動して進行します</p>
          </div>
        </div>

        <div className="relative border-l-4 border-indigo-100 ml-6 space-y-8 md:space-y-10 pl-6 md:pl-8 pb-4">
          {currentRoadmapSteps.map((step, i) => (
            <div key={step.id} className="relative">
              <span className={`absolute -left-[35px] md:-left-[43px] top-1 w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center font-black text-xs md:text-sm border-4 border-white shadow-sm ${
                step.status === 'completed' ? 'bg-green-500 text-white' : 
                step.status === 'current' ? 'bg-indigo-600 text-white animate-pulse' : 
                'bg-gray-200 text-gray-500'
              }`}>
                {step.status === 'completed' ? <CheckCircle className="w-3 h-3 md:w-4 md:h-4" /> : i + 1}
              </span>
              <div className={`p-4 md:p-6 rounded-2xl border-2 transition-all flex flex-col h-full ${
                step.status === 'completed' ? 'bg-white border-green-200 opacity-80' : 
                step.status === 'current' ? 'bg-indigo-50 border-indigo-300 shadow-md transform scale-[1.02]' : 
                'bg-gray-50 border-gray-200 opacity-60'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                  <h3 className={`text-base md:text-lg font-black ${step.status === 'current' ? 'text-indigo-900' : 'text-gray-800'}`}>{step.title}</h3>
                  <span className={`text-[10px] md:text-xs font-bold px-2 py-1 rounded w-max ${
                    step.status === 'completed' ? 'bg-green-100 text-green-700' : 
                    step.status === 'current' ? 'bg-indigo-200 text-indigo-800' : 
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {step.status === 'completed' ? 'クリア！' : step.status === 'current' ? '進行中' : '未解放'}
                  </span>
                </div>
                <p className="text-xs md:text-sm font-bold text-gray-600 mb-4">{step.desc}</p>
                
                {/* ステップごとの進行度プログレスバー */}
                <div className="mt-auto pt-2">
                  <div className="flex justify-between text-xs font-bold text-gray-500 mb-1.5">
                    <span>進行度</span>
                    <span className={step.progress === 100 ? 'text-green-600' : 'text-indigo-600'}>{step.progress}%</span>
                  </div>
                  <div className={`w-full rounded-full h-2.5 overflow-hidden shadow-inner ${step.status === 'locked' ? 'bg-gray-200' : 'bg-white'}`}>
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${step.progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} 
                      style={{ width: `${step.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAnalytics = () => {
    const validSubjects = Object.keys(subjectStats).filter(s => subjectStats[s].total > 0);
    const subjectScores = validSubjects.map(s => ({
      subject: s,
      score: Math.round((subjectStats[s].correct / subjectStats[s].total) * 100),
      total: subjectStats[s].total
    })).sort((a, b) => b.total - a.total); 

    const totalErrors = errorStats.concept + errorStats.prerequisite + errorStats.careless + errorStats.reading;
    const errorPercentages = totalErrors > 0 ? {
      concept: Math.round((errorStats.concept / totalErrors) * 100),
      prerequisite: Math.round((errorStats.prerequisite / totalErrors) * 100),
      careless: Math.round((errorStats.careless / totalErrors) * 100),
      reading: Math.round((errorStats.reading / totalErrors) * 100),
    } : { concept: 0, prerequisite: 0, careless: 0, reading: 0 };

    const getPrimaryBottleneck = () => {
      if (totalErrors === 0) return null;
      let maxKey = 'concept';
      let maxVal = errorStats.concept;
      if (errorStats.prerequisite > maxVal) { maxKey = 'prerequisite'; maxVal = errorStats.prerequisite; }
      if (errorStats.careless > maxVal) { maxKey = 'careless'; maxVal = errorStats.careless; }
      if (errorStats.reading > maxVal) { maxKey = 'reading'; maxVal = errorStats.reading; }
      
      const details = {
        concept: { title: "概念理解の欠如", desc: "単元の根本的な意味が掴めていません。AIノートで「図解・全体像」を読み直しましょう。", color: "bg-red-500", bg: "bg-red-50", text: "text-red-700" },
        prerequisite: { title: "前提知識の抜け漏れ", desc: "今の単元を解くための、前の学年の知識が抜けています。「AIアシスタント」に前提知識の解説を頼んでみましょう。", color: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-700" },
        careless: { title: "処理・計算ミス", desc: "考え方は合っていますが、最後の処理でミスをしています。見直しを徹底し、基礎計算ドリルを反復しましょう。", color: "bg-yellow-500", bg: "bg-yellow-50", text: "text-yellow-700" },
        reading: { title: "読解力・条件見落とし", desc: "問題文の「〜ではないもの」などの条件を読み飛ばしています。問題に線を引くなど、読解のクセをつけましょう。", color: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700" }
      };
      return details[maxKey];
    };
    
    const bottleneck = getPrimaryBottleneck();

    return (
      <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pb-12">
        <div className="flex items-center border-b-2 border-gray-200 pb-4 mb-6">
          <BarChart2 className="w-8 h-8 mr-3 text-indigo-600" />
          <div>
            <h2 className="text-2xl font-black text-gray-800">学習レポート・分析</h2>
            <p className="text-sm font-bold text-gray-500">CBRA（認知ボトルネック・リバース解析）に基づく習熟度とエラー原因</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8">
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center"><Target className="w-5 h-5 mr-2 text-blue-500"/>科目別 習熟度（実データ）</h3>
            {subjectScores.length > 0 ? (
              <div className="space-y-6">
                {subjectScores.map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-end text-sm font-bold text-gray-700 mb-2">
                      <span className="text-base">{item.subject}</span>
                      <div className="text-right">
                        <span className="text-xs text-gray-400 mr-2">演習: {item.total}問</span>
                        <span className="text-lg">{item.score}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full transition-all duration-1000 ${item.score >= 80 ? 'bg-green-500' : item.score >= 60 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{width: `${item.score}%`}}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 font-bold py-10 bg-gray-50 rounded-2xl border-2 border-dashed">
                <Target className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>まだ演習データがありません。</p>
                <p className="text-xs mt-1">テストや模試を実施するとここに記録されます。</p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-200">
             <h3 className="text-lg font-black text-gray-800 mb-2 flex items-center"><Brain className="w-5 h-5 mr-2 text-purple-500"/>エラー要因分析 (CBRA)</h3>
             <p className="text-xs font-bold text-gray-500 mb-6">AIが不正解の「なぜ」を4次元で分類した結果です。</p>
             
             {totalErrors > 0 ? (
               <div className="space-y-4">
                 {[
                   { label: '概念理解の欠如', value: errorPercentages.concept, count: errorStats.concept, color: 'bg-red-500' },
                   { label: '前提知識の抜け', value: errorPercentages.prerequisite, count: errorStats.prerequisite, color: 'bg-orange-500' },
                   { label: '処理・計算ミス', value: errorPercentages.careless, count: errorStats.careless, color: 'bg-yellow-500' },
                   { label: '読解・条件見落とし', value: errorPercentages.reading, count: errorStats.reading, color: 'bg-blue-500' }
                 ].map((stat, i) => (
                   <div key={i}>
                      <div className="flex justify-between items-center text-xs font-bold text-gray-600 mb-1.5">
                        <span>{stat.label}</span>
                        <span>{stat.value}% <span className="text-gray-400 font-normal ml-1">({stat.count}回)</span></span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div className={`h-2.5 rounded-full transition-all duration-1000 ${stat.color}`} style={{width: `${stat.value}%`}}></div>
                      </div>
                   </div>
                 ))}
               </div>
             ) : (
                <div className="text-center text-gray-500 font-bold py-10 bg-gray-50 rounded-2xl border-2 border-dashed">
                  <p>エラーデータなし</p>
                </div>
             )}
          </div>
        </div>

        <div className="space-y-6 md:space-y-8">
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-black text-gray-800 mb-2 flex items-center"><Zap className="w-5 h-5 mr-2 text-yellow-500"/>最優先ボトルネックと処方箋</h3>
            <p className="text-sm font-bold text-gray-500 mb-4">データから導かれたスコア停滞の根本原因</p>
            {bottleneck ? (
              <div className={`${bottleneck.bg} p-5 rounded-2xl border ${bottleneck.text.replace('text-', 'border-').replace('700', '200')}`}>
                <div className="flex items-center mb-3">
                   <span className={`w-3 h-3 rounded-full ${bottleneck.color} mr-2 animate-pulse`}></span>
                   <p className={`font-black text-lg ${bottleneck.text}`}>{bottleneck.title}</p>
                </div>
                <p className={`text-sm font-bold ${bottleneck.text} opacity-80 leading-relaxed`}>{bottleneck.desc}</p>
                {weaknesses.length > 0 && (
                   <div className="mt-4 pt-4 border-t border-white/40">
                     <p className={`text-xs font-black ${bottleneck.text} opacity-70 mb-2`}>現在の影響単元:</p>
                     <div className="flex gap-2 flex-wrap">
                       {weaknesses.map(w => <span key={w} className={`px-2 py-1 rounded bg-white/50 text-xs font-bold ${bottleneck.text}`}>{w}</span>)}
                     </div>
                   </div>
                )}
              </div>
            ) : (
              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                <p className="font-black text-green-700">データ不足、または弱点なし</p>
              </div>
            )}
          </div>

          <div className="bg-indigo-900 p-6 md:p-8 rounded-3xl shadow-md text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full mix-blend-overlay filter blur-2xl opacity-20 transform translate-x-1/2 -translate-y-1/2"></div>
             <h3 className="text-lg font-black mb-3 flex items-center"><MessageCircle className="w-5 h-5 mr-2"/>AI総括コメント</h3>
             <p className="text-indigo-100 text-sm md:text-base font-bold leading-relaxed">
               現在の総合正答率は{accuracyRate}%です。
               {bottleneck ? `単なる単元の復習だけでなく、「${bottleneck.title}」を意識した学習を行うことで、全体のスコアが底上げされる可能性が高いです。AIアシスタントに「今の自分に合った処方箋ドリルを作って」とリクエストしてみましょう。` : '継続して学習を進めてください。'}
             </p>
             <button 
                onClick={() => { playSound('click'); handleTabChange('chat'); setChatInput(bottleneck ? `私の弱点「${bottleneck.title}」を克服するための、3分で終わる処方箋ドリル（基礎問題3問）を作成してください。` : '今後の学習アドバイスをください。'); }}
                className="mt-6 px-6 py-3 bg-white text-indigo-900 rounded-full font-black text-sm shadow-lg hover:bg-indigo-50 transition-colors flex items-center"
             >
                <Zap className="w-4 h-4 mr-2 text-yellow-500" /> AIに処方箋ドリルを作成してもらう
             </button>
          </div>
        </div>
      </div>
    );
  };

  const renderChat = () => (
    <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-120px)] flex flex-col max-w-4xl mx-auto animate-fade-in pb-10 md:pb-0">
      <div className="flex items-center border-b-2 border-gray-200 pb-3 md:pb-4 mb-4 md:mb-6 shrink-0 bg-white p-3 md:p-4 rounded-2xl shadow-sm">
        <div className="bg-gradient-to-br from-blue-400 to-indigo-500 p-3 md:p-4 rounded-full text-white mr-3 md:mr-5 shadow-lg animate-float">
          <MessageCircle className="w-6 h-6 md:w-8 md:h-8" />
        </div>
        <div>
          <h2 className="text-lg md:text-2xl font-black text-gray-800 flex items-center">AI学習アシスタント</h2>
          <p className="text-xs md:text-sm font-bold text-gray-500">学習に関する質問等を入力してください。</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-md border border-gray-200 overflow-hidden flex flex-col relative">
        <div className="absolute inset-0 bg-blue-50/30 pattern-dots opacity-50 pointer-events-none"></div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 relative z-10 scroll-smooth">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-pop`} style={{animationDelay: '0.1s'}}>
              <div className={`max-w-[90%] md:max-w-[85%] rounded-3xl p-4 md:p-5 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-sm' 
                  : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm drop-shadow-sm'
              }`}>
                <pre className="whitespace-pre-wrap font-sans text-sm md:text-lg leading-relaxed font-bold">
                  {msg.text}
                </pre>
              </div>
            </div>
          ))}
          {isChatting && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-white border border-gray-100 rounded-3xl rounded-bl-sm p-4 md:p-6 shadow-sm flex items-center space-x-2">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 md:w-3 md:h-3 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 md:w-3 md:h-3 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-3 md:p-5 bg-gray-50/80 border-t border-gray-200 backdrop-blur-md relative z-10">
          <form onSubmit={sendChatMessage} className="flex space-x-2 md:space-x-3 relative">
            <input
              type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
              placeholder="質問を入力..."
              className="flex-1 border-2 border-gray-200 rounded-full py-3 pl-4 pr-12 md:py-4 md:pl-6 md:pr-16 focus:border-indigo-500 outline-none text-base md:text-lg bg-white shadow-sm font-bold transition-colors"
              disabled={isChatting}
            />
            <button 
              type="submit" disabled={isChatting || !chatInput.trim()}
              className="absolute right-2 md:right-3 top-1.5 md:top-2 bottom-1.5 md:bottom-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-full transition-all flex items-center justify-center w-10 h-10 md:w-12 md:h-12 shadow-md transform hover:scale-105 active:scale-95"
            >
              <Send className="w-4 h-4 md:w-5 md:h-5 ml-1" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  const navItems = [
    { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'materials', label: 'ノート管理', icon: BookOpen }, 
    { id: 'study', label: 'テスト・演習', icon: Brain },
    { id: 'flashcards', label: '単語帳', icon: Layers }, 
    { id: 'roadmap', label: 'ロードマップ', icon: Map }, 
    { id: 'analytics', label: '学習レポート', icon: BarChart2 }, 
    { id: 'exam', label: '実践模試', icon: Award },
    { id: 'chat', label: 'アシスタント', icon: MessageCircle },
  ];

  return (
    <div className="flex h-screen bg-[#F1F5F9] font-sans text-gray-900 overflow-hidden relative">
      {/* 設定モーダル */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-pop">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-black text-gray-800 flex items-center"><Settings className="w-6 h-6 mr-2 text-indigo-600"/>システム設定</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><XCircle size={28}/></button>
            </div>
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-2xl text-sm font-bold text-yellow-800 leading-relaxed shadow-inner">
                ⚠️ 現在、環境側のセキュリティ制限によりAIとの自動通信に制限(401エラー)が発生しています。<br/><br/>
                ご自身のGemini APIキーを入力することで、この制限を回避してアプリを正常に動作させることができます。
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center"><Key className="w-4 h-4 mr-1.5"/> Gemini APIキー (AIza...)</label>
                <input 
                  type="password" 
                  placeholder="キーを入力してください" 
                  value={tempApiKey}
                  onChange={e => setTempApiKey(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-mono text-sm focus:border-indigo-500 outline-none transition-colors"
                />
                <p className="text-[10px] text-gray-400 mt-2 font-bold">※キーはブラウザのローカルにのみ保存され、外部には送信されません。</p>
              </div>
              <button 
                onClick={() => { 
                  playSound('click');
                  localStorage.setItem('gemini_api_key', tempApiKey); 
                  setShowSettings(false); 
                  showToast('APIキーを保存・適用しました', 'success'); 
                }}
                className="w-full bg-gray-900 hover:bg-black text-white font-black py-4 rounded-xl transition-all transform hover:scale-105 active:scale-95 shadow-xl flex items-center justify-center text-lg"
              >
                保存して閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className={`fixed top-6 right-6 px-6 py-4 rounded-2xl shadow-2xl z-[150] animate-pop flex items-center text-white ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'success' ? 'bg-green-600' : 'bg-yellow-500'}`}>
          {toast.type === 'error' ? <AlertCircle className="w-6 h-6 mr-3" /> : toast.type === 'success' ? <CheckCircle className="w-6 h-6 mr-3" /> : <Timer className="w-6 h-6 mr-3" />}
          <span className="font-bold text-sm md:text-lg">{toast.message}</span>
          <button onClick={() => setToast({ ...toast, show: false })} className="ml-4 opacity-80 hover:opacity-100 transition-opacity">
            <XCircle className="w-5 h-5"/>
          </button>
        </div>
      )}

      <style>{`
        @keyframes fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        @keyframes pop { 0% { transform: scale(0.9); opacity: 0; } 50% { transform: scale(1.03); } 100% { transform: scale(1); opacity: 1; } }
        .animate-pop { animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        .animate-float { animation: float 4s ease-in-out infinite; }
        
        @keyframes pulse-glow { 0% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.6); } 70% { box-shadow: 0 0 0 20px rgba(234, 179, 8, 0); } 100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0); } }
        .animate-pulse-glow { animation: pulse-glow 2s infinite; }
        
        @keyframes pan { 0% { background-position: 0 0; } 100% { background-position: 1rem 0; } }

        .pattern-dots { background-image: radial-gradient(rgba(0,0,0,0.05) 2px, transparent 2px); background-size: 20px 20px; }
        
        .custom-note-content b, .custom-note-content strong { font-weight: 900; color: #1e3a8a; }
        .custom-note-content u { text-decoration-color: #3b82f6; text-decoration-thickness: 3px; text-underline-offset: 2px; }

        .perspective-1000 { perspective: 1000px; }
        .transform-style-preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        
        /* スクロールバー非表示用ユーティリティ */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {!isSetupComplete ? (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 flex items-center justify-center p-4 font-sans text-gray-800 z-50 overflow-y-auto">
          <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-48 h-48 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-pulse" style={{animationDelay: '1s'}}></div>
          
          <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in relative z-10 border border-white my-8">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 md:p-10 text-center text-white relative overflow-hidden">
              <div className="relative inline-block">
                <GraduationCap className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 text-blue-100 animate-float relative z-10" />
                <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-yellow-300 absolute top-0 -right-4 animate-pulse" />
                <Star className="w-5 h-5 md:w-6 md:h-6 text-yellow-200 absolute bottom-4 -left-4 animate-bounce" />
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold mb-2 md:mb-3 tracking-tight">CycLearnへようこそ</h1>
              <p className="text-blue-100 font-bold text-sm md:text-lg">プロフィールを入力して学習アカウントを作成しましょう。</p>
            </div>
            
            <div className="p-6 md:p-10 space-y-6 md:space-y-8">
              <div className="animate-fade-in" style={{animationDelay: '0.1s'}}>
                <label className="text-sm font-bold text-gray-700 mb-2 md:mb-3 flex items-center">
                  <UserCircle className="w-5 h-5 md:w-6 md:h-6 mr-2 text-indigo-500" /> アカウント名（ニックネーム）
                </label>
                <input 
                  type="text" 
                  value={userProfile.username}
                  onChange={e => setUserProfile({...userProfile, username: e.target.value})}
                  placeholder="名前を入力してください"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 md:p-4 focus:border-indigo-500 focus:ring-0 outline-none text-base md:text-lg bg-gray-50 hover:bg-white transition-colors font-bold"
                />
              </div>
              <div className="animate-fade-in" style={{animationDelay: '0.15s'}}>
                <label className="text-sm font-bold text-gray-700 mb-2 md:mb-3 flex items-center">
                  <GraduationCap className="w-5 h-5 md:w-6 md:h-6 mr-2 text-indigo-500" /> 学年
                </label>
                <select 
                  value={userProfile.grade}
                  onChange={e => { playSound('click'); setUserProfile({...userProfile, grade: e.target.value}); }}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 md:p-4 focus:border-indigo-500 focus:ring-0 outline-none text-base md:text-lg bg-gray-50 hover:bg-white transition-colors cursor-pointer font-bold"
                >
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 animate-fade-in" style={{animationDelay: '0.2s'}}>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 md:mb-3 flex items-center text-green-600">
                     <Target className="w-4 h-4 md:w-5 md:h-5 mr-1" /> 得意教科
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map(sub => (
                      <button 
                        key={`strong-${sub}`} onClick={() => toggleSubject('strongSubjects', sub)}
                        className={`px-3 py-2 md:px-4 md:py-2.5 rounded-xl border-2 text-xs md:text-sm font-bold transition-all transform hover:scale-105 active:scale-95 ${userProfile.strongSubjects.includes(sub) ? 'bg-green-100 border-green-500 text-green-700 shadow-sm' : 'border-gray-200 text-gray-500 hover:border-green-300 bg-white'}`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 md:mb-3 flex items-center text-red-600">
                    <AlertCircle className="w-4 h-4 md:w-5 md:h-5 mr-1" /> 苦手教科
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map(sub => (
                      <button 
                        key={`weak-${sub}`} onClick={() => toggleSubject('weakSubjects', sub)}
                        className={`px-3 py-2 md:px-4 md:py-2.5 rounded-xl border-2 text-xs md:text-sm font-bold transition-all transform hover:scale-105 active:scale-95 ${userProfile.weakSubjects.includes(sub) ? 'bg-red-100 border-red-500 text-red-700 shadow-sm' : 'border-gray-200 text-gray-500 hover:border-red-300 bg-white'}`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="animate-fade-in" style={{animationDelay: '0.3s'}}>
                <label className="text-sm font-bold text-gray-700 mb-2 md:mb-3 flex items-center">
                  <Flag className="w-5 h-5 md:w-6 md:h-6 mr-2 text-indigo-500" /> 目標設定（複数可）
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {userProfile.goals.map((g, i) => (
                    <span key={i} className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-lg text-sm font-bold flex items-center shadow-sm">
                      {g}
                      <button onClick={() => removeGoal(i)} className="ml-2 text-indigo-400 hover:text-indigo-600"><XCircle size={16}/></button>
                    </span>
                  ))}
                </div>
                <div className="flex relative">
                  <input 
                    type="text" 
                    placeholder="例：次のテストで80点以上 / 志望校合格"
                    value={newGoalInput}
                    onChange={e => setNewGoalInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && addGoal()}
                    className="w-full border-2 border-gray-200 rounded-xl py-3 pl-4 pr-20 focus:border-indigo-500 focus:ring-0 outline-none bg-gray-50 hover:bg-white transition-colors text-sm md:text-base font-bold"
                  />
                  <button onClick={addGoal} className="absolute right-2 top-1.5 bottom-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white px-3 rounded-lg font-bold text-sm transition-colors">追加</button>
                </div>
              </div>

              <button 
                onClick={finishSetup}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-lg md:text-xl py-4 md:py-5 rounded-2xl shadow-xl transition-all transform hover:-translate-y-1 hover:shadow-2xl flex justify-center items-center mt-2 md:mt-4 active:scale-95"
              >
                アカウントを作成して始める <ArrowRight className="ml-2 w-6 h-6 md:w-7 md:h-7" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* PC用サイドバー */}
          <aside className="w-72 bg-white border-r border-gray-200 flex-col hidden md:flex shadow-xl z-30 shrink-0">
            <div className="p-8 border-b border-gray-100 flex items-center space-x-4 bg-gray-50/50">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-200 animate-float" style={{animationDuration: '6s'}}>
                <GraduationCap size={28} />
              </div>
              <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
                CycLearn
              </span>
            </div>
            
            <div className="px-8 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-center">
              <div>
                <p className="text-xs font-black text-indigo-400 mb-1 uppercase tracking-wider">Account</p>
                <p className="text-base font-black text-indigo-900 flex items-center"><UserCircle className="w-5 h-5 mr-2 text-indigo-500"/>{userProfile.username || 'ゲスト'}さん</p>
              </div>
              <button onClick={() => setShowSettings(true)} className="p-2 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700 rounded-full transition-colors" title="システム設定">
                 <Settings size={20} />
              </button>
            </div>

            <nav className="flex-1 p-6 space-y-3 overflow-y-auto">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id} onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl transition-all duration-300 font-bold text-base ${
                      isActive 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-200/50 transform scale-[1.02]' 
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={22} className={isActive ? 'text-white' : 'text-gray-400'} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* メインコンテンツエリア */}
          <main className="flex-1 overflow-y-auto relative bg-[#F4F7FB] pb-20 md:pb-0">
            {/* スマホ用トップヘッダー */}
            <div className="md:hidden flex justify-between items-center bg-white p-4 shadow-sm border-b border-gray-100 sticky top-0 z-30">
              <div className="flex items-center space-x-2">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg text-white">
                  <GraduationCap size={20} />
                </div>
                <span className="font-black text-lg text-indigo-900">CycLearn</span>
                {userProfile.username && <span className="ml-2 text-xs font-bold text-gray-500 border-l border-gray-300 pl-2">{userProfile.username}</span>}
              </div>
              <button onClick={() => setShowSettings(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                <Settings size={22}/>
              </button>
            </div>

            <div className="h-full p-4 md:p-10 relative z-10">
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'materials' && renderMaterials()}
              {activeTab === 'study' && (
                quizState === 'start' ? renderStudySettings() :
                quizState === 'playing' ? renderPlayingQuiz() : renderQuizResults()
              )}
              {activeTab === 'flashcards' && renderFlashcards()}
              {activeTab === 'roadmap' && renderRoadmap()}
              {activeTab === 'analytics' && renderAnalytics()}
              {activeTab === 'exam' && renderExam()}
              {activeTab === 'chat' && renderChat()}
            </div>
          </main>

          {/* スマホ用ボトムナビゲーション */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex overflow-x-auto no-scrollbar z-50 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] pb-safe">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id} onClick={() => handleTabChange(item.id)}
                  className={`flex-shrink-0 flex flex-col items-center p-3 min-w-[72px] transition-colors ${
                    isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon size={24} className={isActive ? 'animate-pop' : ''} />
                  <span className={`text-[10px] mt-1.5 font-bold whitespace-nowrap ${isActive ? 'text-indigo-700' : ''}`}>{item.label}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  );
}
