import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, FileText, Brain, LayoutDashboard, 
  CheckCircle, XCircle, AlertCircle, ChevronRight, 
  Plus, FileQuestion, ArrowRight, Loader2, RefreshCw,
  GraduationCap, Target, Zap, MessageCircle, Calendar, Send,
  UserCircle, CheckSquare, Square,
  Award, Timer, Flag, ChevronLeft, Sparkles, Star, Trophy, Crown, 
  Layers, Map, BarChart2, RefreshCcw, Play, Search, Filter, SortDesc
} from 'lucide-react';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // 実行環境で自動付与されます
console.log("APIキー確認:", apiKey);

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
  } catch(e) { console.log("Audio not supported or disabled"); }
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

// --- API連携関数 ---
const generateGeminiContent = async (prompt, isJson = false, schemaType = 'quiz') => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = { contents: [{ parts: [{ text: prompt }] }] };

  if (isJson) {
    let responseSchema;
    if (schemaType === 'exam') {
      responseSchema = {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            id: { type: "NUMBER" },
            theme: { type: "STRING" },
            questions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "NUMBER" },
                  question: { type: "STRING" },
                  options: { type: "ARRAY", items: { type: "STRING" } },
                  answer: { type: "STRING" },
                  explanation: { type: "STRING" },
                  weaknessTag: { type: "STRING" }
                },
                required: ["id", "question", "options", "answer", "explanation", "weaknessTag"]
              }
            }
          },
          required: ["id", "theme", "questions"]
        }
      };
    } else {
      responseSchema = {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            id: { type: "NUMBER" },
            question: { type: "STRING" },
            options: { type: "ARRAY", items: { type: "STRING" } },
            answer: { type: "STRING" },
            explanation: { type: "STRING" },
            weaknessTag: { type: "STRING" }
          },
          required: ["id", "question", "options", "answer", "explanation", "weaknessTag"]
        }
      };
    }

    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: responseSchema
    };
  }

  const retries = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < retries.length; i++) {
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return isJson ? JSON.parse(text) : text;
    } catch (e) {
      if (i === retries.length - 1) throw e;
      await new Promise(r => setTimeout(r, retries[i]));
    }
  }
};

const SUBJECTS = ['国語', '算数・数学', '理科', '社会', '英語', '情報'];
const GRADES = ['小学4年', '小学5年', '小学6年', '中学1年', '中学2年', '中学3年', '高校1年', '高校2年', '高校3年'];

export default function App() {
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [userProfile, setUserProfile] = useState({ 
    grade: '中学1年', 
    strongSubjects: [], 
    weakSubjects: [], 
    goal: '',
    notePreference: '' 
  });
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [weaknesses, setWeaknesses] = useState([]);
  const [stats, setStats] = useState({ totalQuestions: 0, correctAnswers: 0 });
  const [activityLog, setActivityLog] = useState([
    { day: '月', count: 0 }, { day: '火', count: 0 }, { day: '水', count: 0 },
    { day: '木', count: 0 }, { day: '金', count: 0 }, { day: '土', count: 0 }, { day: '日', count: 0 }
  ]);
  const [todos, setTodos] = useState([
    { id: 1, text: '基礎用語の確認を行う', completed: false },
    { id: 2, text: '弱点分野の演習を1回実施する', completed: false }
  ]);
  const [newTodo, setNewTodo] = useState('');
  
  const [materials, setMaterials] = useState([]);
  const [activeMaterialId, setActiveMaterialId] = useState(null);
  const [noteViewState, setNoteViewState] = useState('list');
  const [newMatTitle, setNewMatTitle] = useState('');
  const [newMatSubject, setNewMatSubject] = useState(SUBJECTS[0]);
  const [newMatContent, setNewMatContent] = useState('');
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('すべて');
  const [sortOrder, setSortOrder] = useState('newest');
  
  const [studyMode, setStudyMode] = useState('custom');
  const [customSettings, setCustomSettings] = useState({ grade: '中学1年', subject: '算数・数学', topic: '', difficulty: '標準', count: 'おまかせ' });
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

  const [flashcards, setFlashcards] = useState([
    { id: 1, subject: '理科', front: '光合成', back: '植物が光エネルギーを利用して、二酸化炭素と水から有機物と酸素を作り出す反応。' },
    { id: 2, subject: '社会', front: '産業革命', back: '18世紀半ばにイギリスで始まった、機械の発明による産業・社会構造の大変革。' },
    { id: 3, subject: '英語', front: '関係代名詞', back: '名詞（先行詞）を修飾する節を作る代名詞。who, which, thatなど。' }
  ]);
  const [flashcardSubject, setFlashcardSubject] = useState('すべて');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  const [subjectStats, setSubjectStats] = useState(
    SUBJECTS.reduce((acc, sub) => ({ ...acc, [sub]: { total: 0, correct: 0 } }), {})
  );
  const [currentQuizSubject, setCurrentQuizSubject] = useState('その他');

  const chatEndRef = useRef(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const [showConfetti, setShowConfetti] = useState(false);

  const accuracyRate = stats.totalQuestions > 0 ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) : 0;
  const activeMaterial = materials.find(m => m.id === activeMaterialId);
  const filteredFlashcards = flashcards.filter(card => flashcardSubject === 'すべて' || card.subject === flashcardSubject);

  const roadmapSteps = [
    { id: 1, title: '学習習慣の確立', status: 'completed', desc: '日々のログインと基礎知識の定着。' },
    { id: 2, title: '弱点の可視化と補強', status: 'current', desc: 'テスト演習を通じて弱点を特定し、重点的に復習するフェーズ。' },
    { id: 3, title: '応用問題への対応力強化', status: 'locked', desc: '標準〜応用レベルの問題を自力で解き切る思考力を養う。' },
    { id: 4, title: '実践模試での得点力向上', status: 'locked', desc: '制限時間内に正確に解答する実戦形式の訓練。' }
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatting]);

  useEffect(() => {
    setCurrentCardIndex(0);
    setIsCardFlipped(false);
  }, [flashcardSubject]);

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

  const finishSetup = () => {
    if (!userProfile.grade) return;
    playSound('start');
    setCustomSettings(prev => ({ ...prev, grade: userProfile.grade }));
    if (userProfile.weakSubjects.length > 0) setWeaknesses(userProfile.weakSubjects.map(s => `${s}全般`));
    setChatMessages([{ role: 'ai', text: `初期設定を完了しました。私は学習支援AIです。${userProfile.grade}の学習を論理的かつ効率的にサポートします。\n目標「${userProfile.goal || '未設定'}」の達成に向けて、不明点があれば質問してください。`}]);
    setIsSetupComplete(true);
  };

  const toggleSubject = (type, subject) => {
    playSound('click');
    setUserProfile(prev => {
      const list = prev[type];
      return { ...prev, [type]: list.includes(subject) ? list.filter(s => s !== subject) : [...list, subject] };
    });
  };

  const toggleTodo = (id) => {
    playSound('click');
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const addTodo = (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    playSound('click');
    setTodos([...todos, { id: Date.now(), text: newTodo, completed: false }]);
    setNewTodo('');
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    if (!newMatTitle) return;
    playSound('click');
    setIsAddingMaterial(true);
    try {
      const baseFormat = `重要なキーワードは赤文字（<span style="color:#ef4444; font-weight:bold;">テキスト</span>）や、下線（<u>テキスト</u>）を用いて明示すること。
視覚的にわかりやすくするため、見出しや重要な概念には関連する【絵文字】を効果的に使用すること。
概念の関係性や手順、分類を示す場合は、矢印（→）や記号を使った【視覚的なテキスト図解（フロー図やツリー図など）】を含めること。
構成は【結論】【図解・全体像】【詳細解説】【重要キーワード】【確認事項】の順とし、簡潔で客観的な文体（だ・である調）で記述すること。
※厳守：無駄な空行やスペースを入れないこと。段落間の空行は最大1行。HTMLの<br>や<p>タグは使用せず、通常の改行のみで構成すること。`;
      
      const customFormat = userProfile.notePreference 
        ? `\n【ユーザー指定フォーマット（優先適用）】\n${userProfile.notePreference}` 
        : '';

      const prompt = `対象: ${userProfile.grade}\n科目: ${newMatSubject}
以下のテーマについて、学習用ノートを作成してください。

【テーマ】
${newMatTitle}
${newMatContent ? `\n【参考テキスト】\n${newMatContent}\n` : ''}

【フォーマット規定】
${baseFormat}
${customFormat}

上記規定に従い出力してください。Markdownは使用せず、指定のHTMLタグのみで装飾してください。`;
      
      const summary = await generateGeminiContent(prompt, false);
      const newMaterial = { 
        id: Date.now(), 
        title: newMatTitle, 
        subject: newMatSubject,
        content: newMatContent || '（参考テキストなし）', 
        summary, 
        date: new Date().toISOString().split('T')[0] 
      };
      setMaterials([newMaterial, ...materials]);
      setActiveMaterialId(newMaterial.id);
      setNewMatTitle('');
      setNewMatContent('');
      playSound('correct'); 
      setNoteViewState('view');
      
      const today = new Date().getDay();
      const dayIndex = today === 0 ? 6 : today - 1;
      const newLog = [...activityLog];
      newLog[dayIndex].count += 1;
      setActivityLog(newLog);
    } catch (error) { showToast("AIノートの生成中にエラーが発生しました。"); } 
    finally { setIsAddingMaterial(false); }
  };

  const startQuiz = async () => {
    playSound('click');
    setIsGeneratingQuiz(true);
    setQuizState('start');
    try {
      let prompt = `対象: ${userProfile.grade}\n実力測定用の4択問題を作成してください。\n`;
      
      let countInstruction = customSettings.count === 'おまかせ' 
        ? `指定範囲の広さや内容の濃さに応じて、適切な問題数（目安：10〜20問）を自動的に判断して出力してください。` 
        : `出題数: ${customSettings.count}問`;

      let quizSub = 'その他';
      if (studyMode === 'custom') {
        prompt += `【条件】科目: ${customSettings.subject}, 単元: ${customSettings.topic || '全範囲'}, 難易度: ${customSettings.difficulty}\n${countInstruction}`;
        quizSub = customSettings.subject;
      } else if (studyMode === 'weakness') {
        prompt += `【条件】現在の弱点: ${weaknesses.join(', ')}\n${countInstruction}`;
        quizSub = '弱点特訓';
      } else {
        const mat = materials.find(m => m.id === activeMaterialId);
        prompt += `【条件】テーマ: ${mat.title}\n内容: ${mat.summary}\n${countInstruction}`;
        quizSub = mat?.subject || 'その他';
      }
      setCurrentQuizSubject(quizSub);

      prompt += `\n【要件】
1. 思考力を問う実践的な問題を含めること。
2. 解説は客観的かつ論理的な文体（だ・である調）とし、簡潔に必要な情報のみを記述すること。愛想や冗長な表現は不要。
3. weaknessTagは20文字以内の具体的な単元名とすること。`;
      
      const generatedQuiz = await generateGeminiContent(prompt, true, 'quiz');
      const finalData = customSettings.count === 'おまかせ' ? generatedQuiz : generatedQuiz.slice(0, customSettings.count);
      setQuizData(finalData);
      setCurrentAnswers({});
      setQuizState('playing');
      playSound('start');
    } catch (error) { showToast("問題の生成に失敗しました。"); } 
    finally { setIsGeneratingQuiz(false); }
  };

  const handleAnswerSelect = (qId, opt) => {
    playSound('click');
    setCurrentAnswers({...currentAnswers, [qId]: opt});
  };

  const submitQuiz = () => {
    setQuizState('results');
    const newWeaknesses = new Set(weaknesses);
    let correctCount = 0;
    quizData.forEach(q => {
      if (currentAnswers[q.id] === q.answer) { correctCount++; newWeaknesses.delete(q.weaknessTag); } 
      else if(currentAnswers[q.id]) { newWeaknesses.add(q.weaknessTag); }
    });
    setWeaknesses(Array.from(newWeaknesses));
    setStats({ totalQuestions: stats.totalQuestions + quizData.length, correctAnswers: stats.correctAnswers + correctCount });
    
    setSubjectStats(prev => {
      const newStats = { ...prev };
      if (!newStats[currentQuizSubject]) newStats[currentQuizSubject] = { total: 0, correct: 0 };
      newStats[currentQuizSubject].total += quizData.length;
      newStats[currentQuizSubject].correct += correctCount;
      return newStats;
    });

    const scoreRate = quizData.length > 0 ? correctCount / quizData.length : 0;
    if (scoreRate >= 0.8) {
      setTimeout(() => playSound('fanfare'), 300);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    } else {
      setTimeout(() => playSound('correct'), 300);
    }

    const today = new Date().getDay();
    const dayIndex = today === 0 ? 6 : today - 1;
    const newLog = [...activityLog];
    newLog[dayIndex].count += quizData.length;
    setActivityLog(newLog);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startExam = async () => {
    playSound('click');
    if (!apiKey) {
      showToast("APIキーが設定されていません。環境変数 VITE_GEMINI_API_KEY を確認してください。");
      return;
    }
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
5. weaknessTagは単元名とすること。`;
      
      const generatedExam = await generateGeminiContent(prompt, true, 'exam');
      
      let flatExamData = [];
      let globalQuestionIndex = 0;
      generatedExam.forEach((group, gIdx) => {
        group.questions.forEach((q, qIdx) => {
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
      playSound('start');
    } catch (error) { 
      console.error(error);
      showToast("模試の生成に失敗しました。問題数を減らして再試行してください。"); 
    } 
    finally { setIsGeneratingQuiz(false); }
  };

  const submitExam = (isTimeUp = false) => {
    if (isTimeUp) showToast("時間切れです。自動提出されました。", "warning");
    setExamState('results');
    const newWeaknesses = new Set(weaknesses);
    let correctCount = 0;
    examData.forEach(q => {
      if (examAnswers[q.id] === q.answer) { correctCount++; newWeaknesses.delete(q.weaknessTag); } 
      else if (examAnswers[q.id]) { newWeaknesses.add(q.weaknessTag); }
    });
    setWeaknesses(Array.from(newWeaknesses));
    setStats({ totalQuestions: stats.totalQuestions + examData.length, correctAnswers: stats.correctAnswers + correctCount });
    
    setSubjectStats(prev => {
      const newStats = { ...prev };
      if (!newStats[examSettings.subject]) newStats[examSettings.subject] = { total: 0, correct: 0 };
      newStats[examSettings.subject].total += examData.length;
      newStats[examSettings.subject].correct += correctCount;
      return newStats;
    });

    const scoreRate = examData.length > 0 ? correctCount / examData.length : 0;
    if (scoreRate >= 0.8) {
      setTimeout(() => playSound('fanfare'), 300);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 6000);
    } else {
      setTimeout(() => playSound('correct'), 300);
    }

    const today = new Date().getDay();
    const dayIndex = today === 0 ? 6 : today - 1;
    const newLog = [...activityLog];
    newLog[dayIndex].count += examData.length;
    setActivityLog(newLog);
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
      setChatMessages([...newHistory, { role: 'ai', text: '通信エラーが発生しました。再試行してください。' }]);
    } finally { setIsChatting(false); }
  };

  // ==========================================
  // UI レンダリング関数
  // ==========================================

  const renderDashboard = () => (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      <div className="flex items-end justify-between border-b-2 border-gray-100 pb-4 mb-8">
        <h2 className="text-3xl font-extrabold text-gray-800 tracking-tight">ダッシュボード</h2>
        <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100 shadow-sm flex items-center">
          <GraduationCap className="w-4 h-4 mr-1" /> {userProfile.grade} • 目標: {userProfile.goal || '未設定'}
        </span>
      </div>
      
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-8 rounded-3xl border border-white shadow-md flex items-start space-x-6 relative overflow-hidden group hover:shadow-lg transition-shadow">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-50 transform translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform duration-700"></div>
        <div className="bg-white p-4 rounded-full shadow-lg text-blue-600 shrink-0 relative z-10 animate-float">
          <MessageCircle size={36} className="text-indigo-600" />
        </div>
        <div className="relative z-10 pt-2">
          <h3 className="font-extrabold text-gray-800 text-xl mb-2 flex items-center">
            学習状況サマリー
          </h3>
          <p className="text-gray-700 text-lg leading-relaxed font-bold">
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
              { label: 'AIノート', value: `${materials.length}件`, icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-50' }
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center transform hover:-translate-y-1 hover:shadow-md transition-all">
                  <div className={`w-12 h-12 mx-auto rounded-full ${stat.bg} ${stat.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 mb-1">{stat.label}</p>
                  <p className="text-2xl font-black text-gray-800">{stat.value}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <h3 className="text-xl font-bold text-gray-800 flex items-center mb-6">
              <Calendar className="w-6 h-6 mr-2 text-indigo-500" /> 直近のアクティビティ
            </h3>
            <div className="flex justify-between items-end h-40 mt-6 px-2">
              {activityLog.map((log, i) => {
                const height = log.count === 0 ? 4 : Math.min(100, log.count * 10);
                const isToday = i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
                return (
                  <div key={i} className="flex flex-col items-center w-full group">
                    <div className="w-full px-1 md:px-3 flex justify-center items-end h-32 relative">
                      <span className="absolute -top-8 text-xs font-bold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-1 rounded shadow-sm z-10">
                        {log.count}
                      </span>
                      <div 
                        className={`w-full max-w-[40px] rounded-t-lg transition-all duration-500 ease-out ${log.count > 0 ? 'bg-gradient-to-t from-indigo-500 to-blue-400' : 'bg-gray-100'} ${isToday ? 'ring-2 ring-offset-2 ring-indigo-300' : ''}`}
                        style={{ height: `${height}%` }}
                      ></div>
                    </div>
                    <span className={`text-sm mt-3 font-bold ${isToday ? 'text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full' : 'text-gray-400'}`}>{log.day}</span>
                  </div>
                )
              })}
            </div>
          </div>
          
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
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
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
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
                placeholder="新規追加..."
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

          <div className="bg-white p-8 md:p-10 rounded-3xl shadow-lg border border-gray-100">
            <form onSubmit={handleAddMaterial} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-base font-bold text-gray-700 mb-3">
                    テーマ・単元 <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" required placeholder="例：光合成のメカニズム" 
                    value={newMatTitle} onChange={(e) => setNewMatTitle(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors font-bold text-lg"
                  />
                </div>
                <div>
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
      return (
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
          <div className="flex items-center justify-between border-b-2 border-gray-200 pb-4 mb-8">
            <div className="flex items-center">
              <button onClick={() => { playSound('click'); setNoteViewState('list'); }} className="mr-4 p-2 hover:bg-gray-200 rounded-full transition-colors">
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">{activeMaterial.subject}</span>
            </div>
            <button 
              onClick={() => { playSound('click'); handleTabChange('study'); setStudyMode('material'); }}
              className="bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-2 rounded-full font-bold flex items-center transition-all shadow-md"
            >
               <Brain className="w-4 h-4 mr-2" /> このノートでテスト
            </button>
          </div>

          <div className="bg-white p-8 md:p-14 rounded-3xl shadow-xl border border-gray-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
            <h4 className="text-3xl md:text-4xl font-black text-gray-900 mb-8 pb-6 border-b-2 border-gray-100 leading-tight">
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
      (m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.summary.toLowerCase().includes(searchQuery.toLowerCase()))
    ).sort((a, b) => {
      if (sortOrder === 'newest') return b.id - a.id;
      if (sortOrder === 'oldest') return a.id - b.id;
      if (sortOrder === 'a-z') return a.title.localeCompare(b.title);
      return 0;
    });

    return (
      <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-gray-200 pb-4 mb-6 gap-4">
          <div className="flex items-center">
            <BookOpen className="w-8 h-8 mr-3 text-blue-600" />
            <div>
              <h2 className="text-3xl font-black text-gray-800">ノート管理</h2>
              <p className="text-sm font-bold text-gray-500">作成したAIノートの分類と検索</p>
            </div>
          </div>
          <button 
            onClick={() => { playSound('click'); setNoteViewState('create'); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-black flex items-center transition-all shadow-md transform hover:scale-105 active:scale-95"
          >
            <Plus className="w-5 h-5 mr-1" /> 新規ノート作成
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-4 top-3.5 text-gray-400" />
            <input 
              type="text" placeholder="ノートを検索..." 
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 font-bold text-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="flex gap-4">
            <div className="relative flex-1 md:w-48">
              <Filter className="w-4 h-4 absolute left-3 top-4 text-gray-500" />
              <select 
                value={filterSubject} onChange={(e) => { playSound('click'); setFilterSubject(e.target.value); }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 font-bold text-gray-700 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="すべて">全科目</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="relative flex-1 md:w-48">
              <SortDesc className="w-4 h-4 absolute left-3 top-4 text-gray-500" />
              <select 
                value={sortOrder} onChange={(e) => { playSound('click'); setSortOrder(e.target.value); }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 font-bold text-gray-700 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="newest">新しい順</option>
                <option value="oldest">古い順</option>
                <option value="a-z">名前順</option>
              </select>
            </div>
          </div>
        </div>

        {filteredMaterials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMaterials.map(mat => (
              <div 
                key={mat.id} 
                onClick={() => { playSound('click'); setActiveMaterialId(mat.id); setNoteViewState('view'); }}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 cursor-pointer transform hover:-translate-y-1 hover:shadow-md transition-all group flex flex-col h-64"
              >
                <div className="flex justify-between items-start mb-4 shrink-0">
                  <span className="text-xs font-black bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-md">
                    {mat.subject}
                  </span>
                  <span className="text-xs font-bold text-gray-400">{mat.date}</span>
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {mat.title}
                </h3>
                <p className="text-sm font-bold text-gray-500 line-clamp-4 flex-1">
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

      <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 bg-gray-200/50 p-2 rounded-2xl mb-8">
        {[
          { id: 'custom', label: '条件指定', icon: Target },
          { id: 'weakness', label: '弱点特訓', icon: AlertCircle },
          { id: 'material', label: 'ノート確認', icon: BookOpen }
        ].map(mode => {
          const Icon = mode.icon;
          return (
            <button 
              key={mode.id} onClick={() => { playSound('click'); setStudyMode(mode.id); }}
              className={`flex-1 py-4 px-2 rounded-xl font-black text-base flex items-center justify-center transition-all ${studyMode === mode.id ? 'bg-white shadow-md text-indigo-700' : 'text-gray-500 hover:bg-gray-200/80'}`}
            >
              <Icon className="w-5 h-5 mr-2" /> {mode.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white p-8 md:p-10 rounded-3xl shadow-lg border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
        {studyMode === 'custom' && (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              {weaknesses.length > 0 ? weaknesses.map((w,i) => <span key={i} className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-xl text-base font-bold shadow-sm">{w}</span>) : <span className="text-gray-500 font-bold p-6 bg-gray-50 rounded-xl w-full border-2 border-dashed">該当データなし</span>}
            </div>
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
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {studyMode === 'custom' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">難易度</label>
                <div className="flex space-x-2">
                  {['基礎', '標準', '応用'].map(level => (
                    <button
                      key={level} onClick={() => { playSound('click'); setCustomSettings({...customSettings, difficulty: level}); }}
                      className={`flex-1 py-3 rounded-xl border-2 text-base font-bold transition-all ${customSettings.difficulty === level ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
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
                      className={`flex-1 py-3 rounded-xl border-2 text-base font-black transition-all ${customSettings.count === num ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
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
              disabled={isGeneratingQuiz || (studyMode === 'weakness' && weaknesses.length === 0) || (studyMode === 'material' && materials.length === 0)}
              className={`px-12 py-5 rounded-2xl font-black text-xl text-white shadow-xl transition-all transform flex items-center w-full justify-center ${
                isGeneratingQuiz || (studyMode === 'weakness' && weaknesses.length === 0) || (studyMode === 'material' && materials.length === 0)
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 hover:-translate-y-1 hover:shadow-2xl active:scale-95'
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
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 sticky top-0 z-20">
        <h2 className="text-2xl font-black text-gray-800 flex items-center">
          <Brain className="w-8 h-8 mr-3 text-indigo-600" /> 演習実行中
        </h2>
        <span className="bg-indigo-100 text-indigo-800 px-5 py-2 rounded-full text-base font-black shadow-inner">
          全 {quizData.length} 問
        </span>
      </div>
      
      <div className="space-y-10">
        {quizData.map((q, index) => (
          <div key={q.id} className="bg-white p-8 md:p-10 rounded-3xl shadow-md border border-gray-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
            <p className="font-extrabold text-xl md:text-2xl mb-8 text-gray-800 leading-relaxed">
              <span className="text-blue-600 mr-3 text-3xl font-black font-mono">Q{index + 1}.</span>
              {q.question}
            </p>
            <div className="grid grid-cols-1 gap-4">
              {q.options.map((opt, optIdx) => {
                const isSelected = currentAnswers[q.id] === opt;
                return (
                  <button
                    key={optIdx} onClick={() => handleAnswerSelect(q.id, opt)}
                    className={`w-full p-5 rounded-2xl border-2 text-left transition-all text-lg md:text-xl transform ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 text-blue-900 font-black shadow-md scale-[1.01] ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 text-gray-700 font-bold hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full mr-4 text-sm font-black ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {['A', 'B', 'C', 'D'][optIdx]}
                      </span>
                      {opt}
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
          className="bg-gray-900 disabled:bg-gray-400 hover:bg-black shadow-2xl text-white font-black py-5 px-16 rounded-full transition-all transform hover:scale-105 active:scale-95 flex items-center text-xl"
        >
          採点 <ArrowRight className="ml-3 w-6 h-6" />
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
        
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 gap-4">
          <h2 className="text-2xl font-black text-gray-800 flex items-center">
            <CheckCircle className="w-8 h-8 mr-3 text-green-500" /> 結果
          </h2>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 mb-8">
           <div className={`flex flex-col items-center justify-center rounded-3xl p-10 flex-1 relative overflow-hidden animate-pop shadow-lg border-2 ${isHighScore ? 'bg-gradient-to-br from-yellow-50 to-orange-100 border-yellow-300' : 'bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200'}`}>
              <div className="relative z-10 text-center">
                <p className="text-lg font-bold text-gray-600 mb-2">スコア</p>
                <p className={`text-7xl font-black drop-shadow-sm ${isHighScore ? 'text-yellow-600' : 'text-blue-700'}`}>
                  {score}<span className="text-3xl ml-2">点</span>
                </p>
                <p className="text-xl font-bold text-gray-600 mt-4 bg-white/50 px-6 py-2 rounded-full inline-block backdrop-blur-sm">正答: {correctCount} / {quizData.length}</p>
              </div>
           </div>
           
           <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-md flex-1 lg:flex-[2]">
              <h3 className="font-extrabold text-xl mb-6 text-gray-800 border-b-2 border-gray-100 pb-4 flex items-center">
                <MessageCircle className="w-6 h-6 mr-2 text-indigo-500" /> 評価
              </h3>
              <p className="text-lg text-gray-700 leading-relaxed font-bold bg-gray-50 p-6 rounded-2xl">
                {isHighScore 
                  ? `得点は${score}点です。該当範囲の理解度は十分に達しています。次のステップへ移行してください。` 
                  : `得点は${score}点です。基礎知識の欠落が見られます。解説を確認し、弱点の補強を行ってください。`}
              </p>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h3 className="font-extrabold text-xl text-gray-800 sticky top-0 bg-[#F8FAFC] py-4 z-10 border-b">解答状況</h3>
            {quizData.map((q, i) => {
              const isCorrect = currentAnswers[q.id] === q.answer;
              return (
                <div key={q.id} className={`p-6 rounded-2xl border-2 transition-all ${isCorrect ? 'bg-white border-green-300 shadow-sm' : 'bg-red-50/80 border-red-300'}`}>
                  <p className="font-bold text-lg mb-4 text-gray-800">
                    <span className="text-gray-500 mr-2">Q{i + 1}.</span>{q.question}
                  </p>
                  <div className="bg-white/80 p-4 rounded-xl border border-gray-100 shadow-inner">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-500">解答:</span>
                      <span className={`font-black text-lg ${isCorrect ? 'text-green-600' : 'text-red-600 line-through decoration-2'}`}>
                        {currentAnswers[q.id] || "無回答"}
                      </span>
                    </div>
                    {!isCorrect && (
                      <div className="flex justify-between items-center pt-3 border-t border-gray-200 mt-3">
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
                <div key={q.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center mb-5">
                    <span className={`w-10 h-10 rounded-full inline-flex items-center justify-center text-white font-black text-lg mr-4 shadow-md ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                      Q{i+1}
                    </span>
                    <h4 className={`font-extrabold text-xl ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                      {isCorrect ? '正解' : '不正解'}
                    </h4>
                  </div>
                  
                  {!isCorrect && (
                    <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-5 rounded-r-xl">
                      <strong className="block mb-1 text-orange-900 font-bold flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" /> 弱点判定
                      </strong>
                      <p className="text-sm text-orange-800 font-bold">
                        「{q.weaknessTag}」の理解不足。
                      </p>
                    </div>
                  )}
                  
                  <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-2xl text-gray-800 text-base leading-relaxed font-bold relative">
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
            className="bg-gray-900 hover:bg-black text-white px-16 py-5 rounded-full font-black text-xl transition-all shadow-xl transform hover:scale-105 active:scale-95 flex items-center"
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
              <Award className="w-14 h-14 text-purple-600" />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-800 mb-2">実践模試モード</h2>
            <p className="text-gray-600 font-medium">大学受験・高校受験レベルの本格的な模試（大問＋小問形式）を生成します。</p>
          </div>
          <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
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
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'ミニ模試', count: 5, desc: 'サクッと実力試し' },
                  { label: 'ハーフ模試', count: 15, desc: '標準的な演習量' },
                  { label: 'フル模試', count: 30, desc: '本番さながらの分量' }
                ].map(opt => (
                  <button
                    key={opt.count} 
                    onClick={() => { playSound('click'); setExamSettings({...examSettings, count: opt.count}); }}
                    className={`flex-1 min-w-[120px] p-4 rounded-xl border-2 text-left transition-all ${examSettings.count === opt.count ? 'bg-purple-50 border-purple-500 shadow-md ring-2 ring-purple-100' : 'bg-white border-gray-200 hover:border-purple-300'}`}
                  >
                    <p className={`font-black text-lg ${examSettings.count === opt.count ? 'text-purple-700' : 'text-gray-800'}`}>{opt.count}問 <span className="text-sm font-bold text-gray-500">({opt.count}分)</span></p>
                    <p className={`text-xs font-bold mt-1 ${examSettings.count === opt.count ? 'text-purple-600' : 'text-gray-500'}`}>{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 mb-10">
              <h4 className="font-black text-purple-900 mb-3 flex items-center text-lg">
                <Timer className="w-6 h-6 mr-2" /> 試験概要
              </h4>
              <ul className="text-base text-purple-800 font-medium space-y-2 list-disc list-inside">
                <li>問題数：{examSettings.count}問（制限時間: {examSettings.count}分）</li>
                <li>「{examSettings.level}」に対応した長文や資料ベースの大問形式で出題されます。</li>
                {examSettings.count >= 15 && <li className="text-red-600 font-bold">※問題数が多い場合、AIの生成に30秒〜1分程度かかる場合があります。</li>}
              </ul>
            </div>
            <div className="flex justify-center">
              <button 
                onClick={startExam} disabled={isGeneratingQuiz}
                className={`px-14 py-5 rounded-full font-black text-xl text-white shadow-xl transition-all flex items-center transform w-full justify-center md:w-auto ${
                  isGeneratingQuiz ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 hover:scale-105 active:scale-95'
                }`}
              >
                {isGeneratingQuiz ? (
                  <><Loader2 className="w-7 h-7 mr-3 animate-spin" /> {examSettings.count}問の模試を生成中...</>
                ) : (
                  <>模試を開始する <ChevronRight className="w-7 h-7 ml-3" /></>
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
        <div className="h-[calc(100vh-140px)] flex flex-col animate-fade-in max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center bg-gray-900 text-white p-5 rounded-t-3xl shrink-0 shadow-lg relative z-20">
            <div className="flex items-center space-x-4">
              <span className="font-black text-xl flex items-center"><Award className="w-6 h-6 mr-2 text-yellow-400"/> 実践模試：{examSettings.subject}</span>
              <span className="text-sm font-bold text-gray-300 bg-gray-800 px-3 py-1 rounded-full">解答済み: {answeredCount}/{examData.length}</span>
            </div>
            <div className={`flex items-center font-mono text-3xl font-black px-5 py-2 rounded-xl transition-colors ${examTimeRemaining < 60 ? 'bg-red-600 text-white animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.7)]' : 'bg-gray-800 text-green-400'}`}>
              <Timer className="w-8 h-8 mr-3" />
              {formatTime(examTimeRemaining)}
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden bg-white border-x border-b border-gray-200 rounded-b-3xl shadow-md">
            <div className="flex-1 p-10 overflow-y-auto relative bg-gray-50/50">
              
              {/* 大問情報ヘッダー */}
              <div className="flex justify-between items-start mb-6">
                 <span className="text-3xl font-black text-gray-800 border-b-4 border-indigo-500 pb-2">
                   {currentQ.groupTitle} <span className="text-xl text-gray-500 ml-2">問 {currentQ.groupSubIndex}</span>
                 </span>
                 <button 
                   onClick={() => { playSound('click'); setExamReviewFlags({...examReviewFlags, [currentQ.id]: !examReviewFlags[currentQ.id]}); }}
                   className={`flex items-center px-5 py-2 rounded-full text-sm font-bold transition-all ${examReviewFlags[currentQ.id] ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-400 shadow-sm transform scale-105' : 'bg-white border-2 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                 >
                   <Flag className={`w-4 h-4 mr-2 ${examReviewFlags[currentQ.id] ? 'fill-current text-yellow-500 animate-pulse' : ''}`} /> 
                   あとで見直す
                 </button>
              </div>

              {/* 大問のテーマ・リード文 */}
              <div className="bg-indigo-50/50 p-6 md:p-8 rounded-2xl border border-indigo-100 mb-8 text-gray-800 text-base md:text-lg leading-loose font-medium whitespace-pre-wrap shadow-inner">
                 <strong className="flex items-center text-indigo-800 mb-2"><BookOpen className="w-5 h-5 mr-2" />共通の資料・リード文</strong>
                 {currentQ.theme}
              </div>

              {/* 小問の質問文 */}
              <p className="text-2xl text-gray-900 leading-relaxed mb-8 font-bold bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-indigo-600 mr-2 font-black text-3xl">Q.</span>{currentQ.question}
              </p>

              {/* 選択肢 */}
              <div className="space-y-4">
                {currentQ.options.map((opt, idx) => (
                  <button
                    key={idx} onClick={() => { playSound('click'); setExamAnswers({...examAnswers, [currentQ.id]: opt}); }}
                    className={`w-full p-6 rounded-2xl border-2 text-left transition-all text-xl font-bold transform ${
                      examAnswers[currentQ.id] === opt 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-md ring-4 ring-indigo-100 scale-[1.01]' 
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-white bg-white text-gray-700 hover:scale-[1.01]'
                    }`}
                  >
                    <span className="inline-block w-10 font-black text-gray-400 mr-3">{idx + 1}.</span> {opt}
                  </button>
                ))}
              </div>

              {/* ページングコントロール */}
              <div className="mt-16 flex justify-between items-center pt-8 border-t-2 border-gray-200">
                <button 
                  onClick={() => { playSound('click'); setExamCurrentIndex(prev => Math.max(0, prev - 1)); }} disabled={examCurrentIndex === 0}
                  className="flex items-center px-6 py-4 rounded-xl font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition-colors text-lg"
                >
                  <ChevronLeft className="w-6 h-6 mr-2" /> 前の問題
                </button>
                {isLast ? (
                  <button 
                    onClick={() => { playSound('click'); submitExam(false); }}
                    className="flex items-center px-10 py-4 rounded-full font-black text-white bg-red-600 hover:bg-red-700 shadow-xl transform hover:scale-105 active:scale-95 text-xl"
                  >
                    模試を終了して提出する <CheckCircle className="w-6 h-6 ml-3" />
                  </button>
                ) : (
                  <button 
                    onClick={() => { playSound('click'); setExamCurrentIndex(prev => Math.min(examData.length - 1, prev + 1)); }}
                    className="flex items-center px-8 py-4 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-colors text-lg"
                  >
                    次の問題 <ChevronRight className="w-6 h-6 ml-2" />
                  </button>
                )}
              </div>
            </div>
            {/* 右側：ナビゲーション */}
            <div className="w-72 bg-white border-l-2 border-gray-100 p-6 flex flex-col shrink-0 shadow-inner z-10">
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
    else if (score >= 40) { grade = 'C'; gradeColor = 'text-orange-500'; gradeBg = 'bg-orange-50 border-orange-200'; feedback = 'もう一歩です。理解が曖昧な単元がいくつかあるようです。解説を熟読し復習しましょう。'; }
    else { feedback = '基礎からしっかり復習し直す必要があります。AIノートを使って根本的な理解を深めましょう。'; }

    return (
      <div className="animate-fade-in max-w-5xl mx-auto space-y-8 pb-12 relative">
        {showConfetti && <Confetti />}
        
        <div className="flex justify-between items-center border-b-2 border-gray-200 pb-5 mb-4">
          <h2 className="text-3xl font-black text-gray-800 flex items-center">
            <Award className="w-8 h-8 mr-3 text-indigo-600" /> 模試成績表
          </h2>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 flex flex-col md:flex-row items-center md:items-stretch gap-10">
          <div className={`flex flex-col items-center justify-center rounded-3xl p-8 border-4 min-w-[240px] animate-pop relative overflow-hidden ${gradeBg}`}>
            {grade === 'S' && <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0,transparent_100%)] opacity-70 animate-pulse-glow"></div>}
            <span className="text-base font-bold text-gray-500 mb-2 relative z-10">総合評価</span>
            <div className="relative z-10">
               {grade === 'S' && <Crown className="w-12 h-12 text-yellow-500 absolute -top-10 left-1/2 transform -translate-x-1/2 drop-shadow-md animate-bounce" />}
               <span className={`text-8xl font-black ${gradeColor} drop-shadow-lg font-mono`}>{grade}</span>
            </div>
            <span className="text-base font-bold text-gray-500 mt-2 relative z-10">判定</span>
          </div>
          
          <div className="flex-1 flex flex-col justify-center w-full">
            <div className="flex flex-col sm:flex-row justify-between items-end mb-6 border-b-2 border-gray-100 pb-6 gap-4">
              <div>
                <p className="text-gray-500 font-bold mb-2 flex items-center bg-gray-100 inline-block px-3 py-1 rounded-md text-sm"><Target className="w-4 h-4 mr-1"/> {examSettings.subject} / {examSettings.level}</p>
                <p className="text-6xl font-black text-gray-800">{score} <span className="text-2xl text-gray-500">点</span></p>
              </div>
              <div className="text-right sm:text-right text-left bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p className="text-sm font-bold text-gray-500 mb-1">正答数</p>
                <p className="text-3xl font-black text-gray-700">{correctCount} <span className="text-lg text-gray-400">/ {examData.length}</span></p>
              </div>
            </div>
            <div className="bg-indigo-50 p-6 rounded-2xl text-indigo-900 text-lg leading-relaxed border border-indigo-100 shadow-sm font-medium">
              <strong className="flex items-center text-indigo-700 mb-2"><MessageCircle className="w-5 h-5 mr-2" />AI講評</strong>
              {feedback}
            </div>
          </div>
        </div>

        <h3 className="text-2xl font-black text-gray-800 pt-8 pb-4 border-b-2">解答・詳細解説</h3>
        <div className="space-y-12">
          {examData.map((q, i) => {
            const isCorrect = examAnswers[q.id] === q.answer;
            return (
              <div key={q.id} className="bg-white rounded-3xl shadow-md border border-gray-200 overflow-hidden">
                <div className={`px-8 py-5 border-b-2 flex justify-between items-center ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center space-x-4">
                    <span className={`w-12 h-12 flex items-center justify-center rounded-full text-white font-black text-xl shadow-sm ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                      {i + 1}
                    </span>
                    <span className="font-bold text-gray-500">{q.groupTitle} - 問{q.groupSubIndex}</span>
                    <span className={`font-black text-xl ml-2 ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                      {isCorrect ? '正解' : '不正解'}
                    </span>
                  </div>
                  {!isCorrect && <span className="text-sm font-bold bg-white text-red-600 px-4 py-2 rounded-lg border border-red-200 shadow-sm flex items-center"><AlertCircle className="w-4 h-4 mr-1"/>弱点: {q.weaknessTag}</span>}
                </div>
                
                <div className="p-8">
                  {/* 大問リード文（解説時は折りたたまず表示） */}
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 mb-8 text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                    <strong className="block mb-2 text-gray-800"><BookOpen className="w-4 h-4 inline mr-1"/>リード文・資料</strong>
                    {q.theme}
                  </div>

                  <p className="font-extrabold text-gray-800 text-xl mb-8 leading-relaxed"><span className="text-indigo-500 mr-2">Q.</span>{q.question}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                      <p className="text-sm text-gray-500 font-bold mb-3 flex items-center"><UserCircle className="w-4 h-4 mr-1"/> あなたの解答</p>
                      <p className={`p-4 rounded-xl border-2 font-black text-lg ${isCorrect ? 'border-green-300 bg-green-100 text-green-800' : 'border-red-300 bg-red-100 text-red-800 line-through decoration-2'}`}>
                        {examAnswers[q.id] || '無回答'}
                      </p>
                    </div>
                    <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100">
                      <p className="text-sm text-indigo-500 font-bold mb-3 flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> 正解</p>
                      <p className="p-4 rounded-xl border-2 border-indigo-300 bg-white text-indigo-800 font-black text-lg">
                        {q.answer}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-8 rounded-2xl border border-gray-200 text-gray-800 text-base leading-relaxed font-medium relative shadow-inner">
                    <strong className="flex items-center text-gray-900 mb-4 text-lg border-b pb-2"><FileText className="w-5 h-5 mr-2 text-indigo-600"/>詳細解説</strong>
                    {q.explanation.split('\n').map((line, idx) => <span key={idx}>{line}<br /></span>)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        <div className="mt-12 pt-8 border-t-2 border-gray-200 flex justify-center">
          <button 
            onClick={() => { playSound('click'); setExamState('start'); }}
            className="bg-gray-900 hover:bg-black text-white px-16 py-5 rounded-full font-black text-xl transition-all shadow-xl transform hover:scale-105 active:scale-95 flex items-center"
          >
            終了して模試メニューへ戻る <ChevronRight className="w-6 h-6 ml-2" />
          </button>
        </div>
      </div>
    );
  };

  const renderFlashcards = () => (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-gray-200 pb-4 shrink-0 gap-4">
        <div className="flex items-center">
          <Layers className="w-8 h-8 mr-3 text-indigo-600" />
          <div>
            <h2 className="text-2xl font-black text-gray-800">重要語句 単語帳</h2>
            <p className="text-sm font-bold text-gray-500">抽出されたキーワードの反復学習</p>
          </div>
        </div>
        <select 
          value={flashcardSubject} onChange={(e) => setFlashcardSubject(e.target.value)}
          className="border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-gray-700 focus:outline-none focus:border-indigo-500 bg-white"
        >
          <option value="すべて">全科目</option>
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {filteredFlashcards.length > 0 ? (
          <>
            <div className="w-full max-w-2xl aspect-[4/3] perspective-1000 mb-8 cursor-pointer group" onClick={() => { playSound('click'); setIsCardFlipped(!isCardFlipped); }}>
              <div className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${isCardFlipped ? 'rotate-y-180' : ''}`}>
                <div className="absolute inset-0 backface-hidden bg-white border-2 border-gray-200 rounded-3xl shadow-lg flex flex-col items-center justify-center p-8 group-hover:shadow-xl transition-shadow">
                   <span className="absolute top-6 left-6 text-gray-400 font-bold">Q.</span>
                   <span className="absolute top-6 right-6 text-indigo-500 font-bold bg-indigo-50 px-3 py-1 rounded-lg text-sm">{filteredFlashcards[currentCardIndex].subject}</span>
                   <h3 className="text-4xl font-black text-gray-800 text-center">{filteredFlashcards[currentCardIndex].front}</h3>
                   <p className="absolute bottom-6 text-sm font-bold text-indigo-400 flex items-center"><RefreshCcw className="w-4 h-4 mr-1"/>タップして裏返す</p>
                </div>
                <div className="absolute inset-0 backface-hidden bg-indigo-50 border-2 border-indigo-200 rounded-3xl shadow-lg flex flex-col items-center justify-center p-10 rotate-y-180">
                   <span className="absolute top-6 left-6 text-indigo-400 font-bold">A.</span>
                   <p className="text-xl font-bold text-gray-800 text-center leading-relaxed">{filteredFlashcards[currentCardIndex].back}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <button 
                onClick={(e) => { e.stopPropagation(); playSound('click'); setIsCardFlipped(false); setTimeout(() => setCurrentCardIndex(prev => prev > 0 ? prev - 1 : filteredFlashcards.length - 1), 150); }}
                className="p-4 bg-white rounded-full shadow-md hover:bg-gray-50 border border-gray-100"
              >
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <span className="font-bold text-gray-500">{currentCardIndex + 1} / {filteredFlashcards.length}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); playSound('click'); setIsCardFlipped(false); setTimeout(() => setCurrentCardIndex(prev => prev < filteredFlashcards.length - 1 ? prev + 1 : 0), 150); }}
                className="p-4 bg-indigo-600 rounded-full shadow-md hover:bg-indigo-700 text-white"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 font-bold">
            <Layers className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>この科目の単語カードはまだありません。</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderRoadmap = () => (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-12">
      <div className="flex items-center border-b-2 border-gray-200 pb-4 mb-8">
        <Map className="w-8 h-8 mr-3 text-indigo-600" />
        <div>
          <h2 className="text-2xl font-black text-gray-800">学習ロードマップ</h2>
          <p className="text-sm font-bold text-gray-500">目標達成までの現在地とステップ</p>
        </div>
      </div>

      <div className="relative border-l-4 border-indigo-100 ml-6 space-y-10 pl-8 pb-4">
        {roadmapSteps.map((step, i) => (
          <div key={step.id} className="relative">
            <span className={`absolute -left-[43px] top-1 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm border-4 border-white shadow-sm ${
              step.status === 'completed' ? 'bg-green-500 text-white' : 
              step.status === 'current' ? 'bg-indigo-600 text-white animate-pulse' : 
              'bg-gray-200 text-gray-500'
            }`}>
              {step.status === 'completed' ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </span>
            <div className={`p-6 rounded-2xl border-2 transition-all ${
              step.status === 'completed' ? 'bg-white border-green-200 opacity-80' : 
              step.status === 'current' ? 'bg-indigo-50 border-indigo-300 shadow-md transform scale-[1.02]' : 
              'bg-gray-50 border-gray-200 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-lg font-black ${step.status === 'current' ? 'text-indigo-900' : 'text-gray-800'}`}>{step.title}</h3>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  step.status === 'completed' ? 'bg-green-100 text-green-700' : 
                  step.status === 'current' ? 'bg-indigo-200 text-indigo-800' : 
                  'bg-gray-200 text-gray-500'
                }`}>
                  {step.status === 'completed' ? '完了' : step.status === 'current' ? '進行中' : '未解放'}
                </span>
              </div>
              <p className="text-sm font-bold text-gray-600">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAnalytics = () => {
    const validSubjects = Object.keys(subjectStats).filter(s => subjectStats[s].total > 0);
    const subjectScores = validSubjects.map(s => ({
      subject: s,
      score: Math.round((subjectStats[s].correct / subjectStats[s].total) * 100),
      total: subjectStats[s].total
    })).sort((a, b) => b.total - a.total); 

    return (
      <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pb-12">
        <div className="flex items-center border-b-2 border-gray-200 pb-4 mb-6">
          <BarChart2 className="w-8 h-8 mr-3 text-indigo-600" />
          <div>
            <h2 className="text-2xl font-black text-gray-800">学習レポート・分析</h2>
            <p className="text-sm font-bold text-gray-500">実際の演習データに基づく習熟度</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
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

          <div className="space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-black text-gray-800 mb-2 flex items-center"><Zap className="w-5 h-5 mr-2 text-yellow-500"/>重点補強エリア</h3>
              <p className="text-sm font-bold text-gray-500 mb-4">データから導かれた最優先課題</p>
              {weaknesses.length > 0 ? (
                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                  <p className="font-black text-red-700">{weaknesses[0]}</p>
                  <p className="text-xs text-red-600 mt-1 font-bold">この分野の正答率が低下傾向にあります。</p>
                </div>
              ) : (
                <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                  <p className="font-black text-green-700">特になし</p>
                </div>
              )}
            </div>

            <div className="bg-indigo-900 p-8 rounded-3xl shadow-md text-white">
               <h3 className="text-lg font-black mb-2">総括コメント</h3>
               <p className="text-indigo-200 text-sm font-bold leading-relaxed">
                 現在の総合正答率は{accuracyRate}%です。基礎知識の定着は見られますが、{userProfile.weakSubjects.length > 0 ? `${userProfile.weakSubjects.join('・')}の演習量不足` : '応用問題での失点'}が課題として推測されます。学習ロードマップに従い、計画的な演習を継続してください。
               </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderChat = () => (
    <div className="h-[calc(100vh-120px)] flex flex-col max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center border-b-2 border-gray-200 pb-4 mb-6 shrink-0 bg-white p-4 rounded-2xl shadow-sm">
        <div className="bg-gradient-to-br from-blue-400 to-indigo-500 p-4 rounded-full text-white mr-5 shadow-lg animate-float">
          <MessageCircle size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center">AI学習アシスタント</h2>
          <p className="text-sm font-bold text-gray-500">学習に関する質問等を入力してください。</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-md border border-gray-200 overflow-hidden flex flex-col relative">
        <div className="absolute inset-0 bg-blue-50/30 pattern-dots opacity-50 pointer-events-none"></div>
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 relative z-10 scroll-smooth">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-pop`} style={{animationDelay: '0.1s'}}>
              <div className={`max-w-[85%] rounded-3xl p-5 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-sm' 
                  : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm drop-shadow-sm'
              }`}>
                <pre className="whitespace-pre-wrap font-sans text-base md:text-lg leading-relaxed font-bold">
                  {msg.text}
                </pre>
              </div>
            </div>
          ))}
          {isChatting && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-white border border-gray-100 rounded-3xl rounded-bl-sm p-6 shadow-sm flex items-center space-x-2">
                <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-5 bg-gray-50/80 border-t border-gray-200 backdrop-blur-md relative z-10">
          <form onSubmit={sendChatMessage} className="flex space-x-3 relative">
            <input
              type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
              placeholder="質問を入力..."
              className="flex-1 border-2 border-gray-200 rounded-full py-4 pl-6 pr-16 focus:border-indigo-500 outline-none text-lg bg-white shadow-sm font-bold transition-colors"
              disabled={isChatting}
            />
            <button 
              type="submit" disabled={isChatting || !chatInput.trim()}
              className="absolute right-3 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-full transition-all flex items-center justify-center w-12 h-12 shadow-md transform hover:scale-105 active:scale-95"
            >
              <Send className="w-5 h-5 ml-1" />
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
      {toast.show && (
        <div className={`fixed top-6 right-6 px-6 py-4 rounded-2xl shadow-2xl z-[150] animate-pop flex items-center text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-yellow-500'}`}>
          {toast.type === 'error' ? <AlertCircle className="w-6 h-6 mr-3" /> : <Timer className="w-6 h-6 mr-3" />}
          <span className="font-bold text-lg">{toast.message}</span>
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

        .pattern-dots { background-image: radial-gradient(rgba(0,0,0,0.05) 2px, transparent 2px); background-size: 20px 20px; }
        
        .custom-note-content b, .custom-note-content strong { font-weight: 900; color: #1e3a8a; }
        .custom-note-content u { text-decoration-color: #3b82f6; text-decoration-thickness: 3px; text-underline-offset: 2px; }

        .perspective-1000 { perspective: 1000px; }
        .transform-style-preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>

      {!isSetupComplete ? (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 flex items-center justify-center p-4 font-sans text-gray-800 z-50 overflow-y-auto">
          <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-48 h-48 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-pulse" style={{animationDelay: '1s'}}></div>
          
          <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in relative z-10 border border-white my-8">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-10 text-center text-white relative overflow-hidden">
              <div className="relative inline-block">
                <GraduationCap className="w-24 h-24 mx-auto mb-4 text-blue-100 animate-float relative z-10" />
                <Sparkles className="w-8 h-8 text-yellow-300 absolute top-0 -right-4 animate-pulse" />
                <Star className="w-6 h-6 text-yellow-200 absolute bottom-4 -left-4 animate-bounce" />
              </div>
              <h1 className="text-4xl font-extrabold mb-3 tracking-tight">SmartLearnへようこそ</h1>
              <p className="text-blue-100 font-bold text-lg">プロファイリングを実行します。情報を入力してください。</p>
            </div>
            
            <div className="p-8 md:p-10 space-y-8">
              <div className="animate-fade-in" style={{animationDelay: '0.1s'}}>
                <label className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                  <UserCircle className="w-6 h-6 mr-2 text-indigo-500" /> 学年
                </label>
                <select 
                  value={userProfile.grade}
                  onChange={e => { playSound('click'); setUserProfile({...userProfile, grade: e.target.value}); }}
                  className="w-full border-2 border-gray-200 rounded-xl p-4 focus:border-indigo-500 focus:ring-0 outline-none text-lg bg-gray-50 hover:bg-white transition-colors cursor-pointer font-bold"
                >
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in" style={{animationDelay: '0.2s'}}>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-3 flex items-center text-green-600">
                     <Target className="w-5 h-5 mr-1" /> 得意教科
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map(sub => (
                      <button 
                        key={`strong-${sub}`} onClick={() => toggleSubject('strongSubjects', sub)}
                        className={`px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all transform hover:scale-105 active:scale-95 ${userProfile.strongSubjects.includes(sub) ? 'bg-green-100 border-green-500 text-green-700 shadow-sm' : 'border-gray-200 text-gray-500 hover:border-green-300 bg-white'}`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-3 flex items-center text-red-600">
                    <AlertCircle className="w-5 h-5 mr-1" /> 苦手教科
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map(sub => (
                      <button 
                        key={`weak-${sub}`} onClick={() => toggleSubject('weakSubjects', sub)}
                        className={`px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all transform hover:scale-105 active:scale-95 ${userProfile.weakSubjects.includes(sub) ? 'bg-red-100 border-red-500 text-red-700 shadow-sm' : 'border-gray-200 text-gray-500 hover:border-red-300 bg-white'}`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="animate-fade-in" style={{animationDelay: '0.3s'}}>
                <label className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                  <Flag className="w-6 h-6 mr-2 text-indigo-500" /> 目標設定
                </label>
                <input 
                  type="text" 
                  placeholder="例：次のテストで80点以上獲得 / 志望校合格"
                  value={userProfile.goal}
                  onChange={e => setUserProfile({...userProfile, goal: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl p-4 focus:border-indigo-500 focus:ring-0 outline-none bg-gray-50 hover:bg-white transition-colors text-lg font-bold"
                />
              </div>

              <button 
                onClick={finishSetup}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xl py-5 rounded-2xl shadow-xl transition-all transform hover:-translate-y-1 hover:shadow-2xl flex justify-center items-center mt-4 active:scale-95"
              >
                設定を完了し、学習を開始 <ArrowRight className="ml-2 w-7 h-7" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <aside className="w-72 bg-white border-r border-gray-200 flex flex-col hidden md:flex shadow-xl z-30">
            <div className="p-8 border-b border-gray-100 flex items-center space-x-4 bg-gray-50/50">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-200 animate-float" style={{animationDuration: '6s'}}>
                <GraduationCap size={28} />
              </div>
              <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
                SmartLearn
              </span>
            </div>
            
            <div className="px-8 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <p className="text-xs font-black text-indigo-400 mb-1 uppercase tracking-wider">Profile</p>
              <p className="text-base font-black text-indigo-900 flex items-center"><UserCircle className="w-5 h-5 mr-2 text-indigo-500"/>{userProfile.grade}</p>
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

          <main className="flex-1 overflow-y-auto relative bg-[#F4F7FB]">
            <div className="md:hidden flex justify-between items-center bg-white p-5 shadow-sm border-b border-gray-100 sticky top-0 z-30">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg text-white">
                  <GraduationCap size={20} />
                </div>
                <span className="font-black text-xl text-indigo-900">SmartLearn</span>
              </div>
              <select 
                value={activeTab} onChange={(e) => handleTabChange(e.target.value)}
                className="border-2 border-gray-200 rounded-xl text-sm font-bold p-2 bg-gray-50 focus:border-indigo-500 outline-none"
              >
                {navItems.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
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
        </>
      )}
    </div>
  );
}
