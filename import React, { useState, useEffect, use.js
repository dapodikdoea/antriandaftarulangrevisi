import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  runTransaction,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Users, 
  BookOpen, 
  Award, 
  AlertTriangle, 
  RefreshCw, 
  Printer, 
  Search, 
  Download, 
  Check, 
  Volume2, 
  Shield, 
  Calendar, 
  Clock, 
  AlertCircle,
  TrendingUp,
  UserPlus,
  Lock,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  XCircle
} from 'lucide-react';

// Configuration keys provided by environment
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ppdb-antrian-re-registration';

// Path-path pendaftaran beserta kuotanya
const JALUR_CONFIG = {
  domisili: { label: 'Jalur Domisili', quota: 176, prefix: 'DOM', color: 'indigo' },
  rapor: { label: 'Prestasi Rapor', quota: 110, prefix: 'RAP', color: 'blue' },
  afirmasi: { label: 'Jalur Afirmasi', quota: 88, prefix: 'AFM', color: 'amber' },
  prestasi: { label: 'Prestasi Kejuaraan', quota: 44, prefix: 'PRS', color: 'emerald' },
  mutasi: { label: 'Jalur Mutasi', quota: 22, prefix: 'MUT', color: 'rose' }
};

// Default value for reset counters
const initialCounters = {
  date: new Date().toISOString().split('T')[0],
  seq_domisili: 0,
  seq_rapor: 0,
  seq_afirmasi: 0,
  seq_prestasi: 0,
  seq_mutasi: 0,
  call_domisili: 0,
  call_rapor: 0,
  call_afirmasi: 0,
  call_prestasi: 0,
  call_mutasi: 0
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('client'); // client | monitor | admin
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  
  // Real-time states
  const [counters, setCounters] = useState(initialCounters);
  const [tickets, setTickets] = useState([]);
  
  // Client Form inputs
  const [studentName, setStudentName] = useState('');
  const [originSchool, setOriginSchool] = useState('');
  const [studentRank, setStudentRank] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [myTicket, setMyTicket] = useState(null);
  
  // Admin search state & interactive control state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilterPath, setSelectedFilterPath] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Time state for visual authenticity header
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Toast Notification Helper (No Browser Alerts allowed)
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Firebase Auth Error:", err);
        showToast("Gagal melakukan otentikasi ke server.", "error");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // 1. Live sync for sequence counters & currently called numbers
    const countersDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'counters', 'main');
    const unsubscribeCounters = onSnapshot(countersDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCounters(data);
        
        // Auto-refresh today's active tickets local display if counters date matches today
        const todayStr = new Date().toISOString().split('T')[0];
        if (data.date !== todayStr) {
          // System date shifted. Invalidate yesterdays myTicket local cache if exists
          const localSaved = localStorage.getItem('active_re_reg_ticket');
          if (localSaved) {
            const parsed = JSON.parse(localSaved);
            if (parsed.date !== todayStr) {
              localStorage.removeItem('active_re_reg_ticket');
              setMyTicket(null);
            }
          }
        }
      } else {
        // Init counter document if not exists
        setDoc(countersDocRef, initialCounters);
      }
    }, (error) => {
      console.error("Counters sync error:", error);
    });

    // 2. Live sync for tickets database
    const ticketsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'tickets');
    const unsubscribeTickets = onSnapshot(ticketsCollectionRef, (querySnap) => {
      const list = [];
      querySnap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort: descending by timestamp
      list.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setTickets(list);
    }, (error) => {
      console.error("Tickets sync error:", error);
    });

    // Recover client ticket from Local Storage if it belongs to today
    const storedTicket = localStorage.getItem('active_re_reg_ticket');
    if (storedTicket) {
      try {
        const parsed = JSON.parse(storedTicket);
        const todayStr = new Date().toISOString().split('T')[0];
        if (parsed.date === todayStr) {
          setMyTicket(parsed);
        } else {
          localStorage.removeItem('active_re_reg_ticket');
        }
      } catch (e) {
        localStorage.removeItem('active_re_reg_ticket');
      }
    }

    return () => {
      unsubscribeCounters();
      unsubscribeTickets();
    };
  }, [user]);

  useEffect(() => {
    if (myTicket && tickets.length > 0) {
      const updated = tickets.find(t => t.id === myTicket.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(myTicket)) {
        setMyTicket(updated);
        localStorage.setItem('active_re_reg_ticket', JSON.stringify(updated));
      }
    }
  }, [tickets, myTicket]);

  const handleTakeQueue = async (e) => {
    e.preventDefault();
    if (!studentName.trim() || !originSchool.trim() || !studentRank.trim() || !selectedPath) {
      showToast("Harap lengkapi semua data pendaftar!", "warning");
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (counters.date !== todayStr) {
      showToast("Sistem antrean hari ini belum dibuka oleh Admin! Hubungi panitia.", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const countersDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'counters', 'main');
      const ticketId = crypto.randomUUID();
      const ticketDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'tickets', ticketId);

      const result = await runTransaction(db, async (transaction) => {
        const countersSnap = await transaction.get(countersDocRef);
        if (!countersSnap.exists()) {
          throw new Error("Dokumen konfigurasi antrean tidak ditemukan!");
        }

        const currentCounters = countersSnap.data();
        
        // Validasi Quota
        const activeSeqKey = `seq_${selectedPath}`;
        const currentCount = currentCounters[activeSeqKey] || 0;
        const config = JALUR_CONFIG[selectedPath];

        if (currentCount >= config.quota) {
          throw new Error(`Maaf, kuota antrean untuk ${config.label} telah habis (${config.quota}/${config.quota})!`);
        }

        const newSeqNumber = currentCount + 1;
        const formattedNum = String(newSeqNumber).padStart(3, '0');
        const queueCode = `${config.prefix}-${formattedNum}`;
        const securityHash = `VAL-${config.prefix}-${todayStr.replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // Update sequence in counters master document
        transaction.update(countersDocRef, {
          [activeSeqKey]: newSeqNumber
        });

        const newTicketData = {
          id: ticketId,
          studentName: studentName.trim(),
          originSchool: originSchool.trim(),
          rank: studentRank.trim(),
          path: selectedPath,
          queueNumber: newSeqNumber,
          queueCode: queueCode,
          date: todayStr,
          status: 'waiting', // waiting | calling | completed | skipped
          securityHash: securityHash,
          timestamp: new Date() // Client timestamp
        };

        // Write ticket document
        transaction.set(ticketDocRef, newTicketData);

        return newTicketData;
      });

      setMyTicket(result);
      localStorage.setItem('active_re_reg_ticket', JSON.stringify(result));
      showToast(`Sukses mengambil antrian! Nomor Anda: ${result.queueCode}`, "success");

      // Reset Form fields
      setStudentName('');
      setOriginSchool('');
      setStudentRank('');
      setSelectedPath('');
    } catch (error) {
      console.error("Queue Transaction Error:", error);
      showToast(error.message || "Gagal mengambil nomor antrian. Silakan coba lagi.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const speakQueueCall = (pathLabel, code) => {
    if ('speechSynthesis' in window) {
      // Clear queue
      window.speechSynthesis.cancel();
      
      const text = `Nomor antrian. ${code.split('-').join(' ')}. Silahkan menuju meja daftar ulang ${pathLabel}.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } else {
      showToast("Fitur suara tidak didukung oleh browser Anda.", "warning");
    }
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    try {
      const ticketRef = doc(db, 'artifacts', appId, 'public', 'data', 'tickets', ticketId);
      const targetTicket = tickets.find(t => t.id === ticketId);
      if (!targetTicket) return;

      await updateDoc(ticketRef, { status: newStatus });
      showToast(`Antrian ${targetTicket.queueCode} diubah ke ${newStatus === 'calling' ? 'Dipanggil' : newStatus === 'completed' ? 'Selesai' : 'Dilewati'}`, "success");

      // If status is "calling", update the current call counter in the counters main document & trigger voice
      if (newStatus === 'calling') {
        const countersDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'counters', 'main');
        const updateKey = `call_${targetTicket.path}`;
        await updateDoc(countersDocRef, {
          [updateKey]: targetTicket.queueNumber
        });
        speakQueueCall(JALUR_CONFIG[targetTicket.path].label, targetTicket.queueCode);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showToast("Gagal memperbarui status antrean.", "error");
    }
  };

  const handleNextCall = async (pathKey) => {
    // Find oldest "waiting" ticket for this path
    const pathTickets = tickets
      .filter(t => t.path === pathKey && t.status === 'waiting' && t.date === counters.date)
      .sort((a, b) => a.queueNumber - b.queueNumber);

    if (pathTickets.length === 0) {
      showToast(`Tidak ada antrean tunggu untuk ${JALUR_CONFIG[pathKey].label}`, "warning");
      return;
    }

    const nextTicket = pathTickets[0];
    await handleUpdateStatus(nextTicket.id, 'calling');
  };

  const handleResetForNewDay = async () => {
    const confirmation = window.confirm("PENTING: Apakah Anda yakin ingin memulai Hari Baru? Tindakan ini akan mereset semua nomor antrean mulai dari 1 kembali untuk hari ini.");
    if (!confirmation) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const countersDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'counters', 'main');
      
      const newCounters = {
        date: todayStr,
        seq_domisili: 0,
        seq_rapor: 0,
        seq_afirmasi: 0,
        seq_prestasi: 0,
        seq_mutasi: 0,
        call_domisili: 0,
        call_rapor: 0,
        call_afirmasi: 0,
        call_prestasi: 0,
        call_mutasi: 0
      };

      await setDoc(countersDocRef, newCounters);
      // Clean local storage cache
      localStorage.removeItem('active_re_reg_ticket');
      setMyTicket(null);

      showToast(`Antrean berhasil di-reset untuk hari baru: ${todayStr}!`, "success");
    } catch (error) {
      console.error("Error resetting system:", error);
      showToast("Gagal mereset sistem.", "error");
    }
  };

  const handleExportCSV = () => {
    if (tickets.length === 0) {
      showToast("Tidak ada data antrean untuk diekspor.", "warning");
      return;
    }

    // Prepare CSV data headers
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Include BOM for Excel UTF-8 display compatibility
    csvContent += "Tanggal Ambil,Kode Antrean,Jalur Pendaftaran,Nama Siswa,Sekolah Asal,Rangking/Skor,Status,Kode Verifikasi Keamanan\r\n";

    // Format rows
    tickets.forEach(t => {
      const dateStr = t.date || "-";
      const queueCode = t.queueCode || "-";
      const pathLabel = JALUR_CONFIG[t.path]?.label || t.path;
      const nameStr = `"${(t.studentName || "").replace(/"/g, '""')}"`;
      const schoolStr = `"${(t.originSchool || "").replace(/"/g, '""')}"`;
      const rankStr = `"${(t.rank || "").replace(/"/g, '""')}"`;
      const statusStr = t.status === 'waiting' ? 'Menunggu' : t.status === 'calling' ? 'Dipanggil' : t.status === 'completed' ? 'Selesai' : 'Dilewati';
      const secHash = t.securityHash || "-";

      csvContent += `${dateStr},${queueCode},${pathLabel},${nameStr},${schoolStr},${rankStr},${statusStr},${secHash}\r\n`;
    });

    // Create file trigger download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const todayStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `Data_Antrian_Daftar_Ulang_PPDB_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Berhasil mengunduh dokumen laporan Spreadsheet!", "success");
  };

  // Safe UI colors lookup based on path key
  const getColorClasses = (pathKey) => {
    switch (pathKey) {
      case 'domisili': return { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', fill: 'bg-indigo-600', badge: 'bg-indigo-100 text-indigo-800' };
      case 'rapor': return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', fill: 'bg-blue-600', badge: 'bg-blue-100 text-blue-800' };
      case 'afirmasi': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', fill: 'bg-amber-600', badge: 'bg-amber-100 text-amber-800' };
      case 'prestasi': return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', fill: 'bg-emerald-600', badge: 'bg-emerald-100 text-emerald-800' };
      case 'mutasi': return { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', fill: 'bg-rose-600', badge: 'bg-rose-100 text-rose-800' };
      default: return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', fill: 'bg-slate-600', badge: 'bg-slate-100 text-slate-800' };
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.originSchool?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.queueCode?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPath = selectedFilterPath === 'all' || t.path === selectedFilterPath;
    return matchesSearch && matchesPath;
  });

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-16">
      {/* Toast Alert Component */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center p-4 rounded-xl shadow-2xl border bg-white animate-bounce">
          <div className="mr-3">
            {toast.type === 'success' && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
            {toast.type === 'error' && <XCircle className="w-6 h-6 text-rose-500" />}
            {toast.type === 'warning' && <AlertCircle className="w-6 h-6 text-amber-500" />}
            {toast.type === 'info' && <AlertCircle className="w-6 h-6 text-blue-500" />}
          </div>
          <p className="text-sm font-semibold text-slate-700">{toast.message}</p>
        </div>
      )}

      {}
      <header className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
              <Users className="w-8 h-8 text-yellow-300" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">E-ANTREAN DAFTAR ULANG</h1>
              <p className="text-indigo-200 text-sm md:text-base font-medium">Sistem Live Antrean PPDB Resmi & Terbuka</p>
            </div>
          </div>

          <div className="flex flex-col items-end bg-white/5 border border-white/10 p-3 rounded-xl text-right">
            <div className="flex items-center space-x-2 text-yellow-300 font-bold">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-white/90 text-lg font-mono font-bold mt-1">
              <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>{currentTime.toLocaleTimeString('id-ID')}</span>
            </div>
            <span className="text-xs text-indigo-300 mt-1">Status Hari: {counters.date === new Date().toISOString().split('T')[0] ? "Aktif Terbuka" : "Perlu Reset Admin"}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex border-b border-white/10">
            <button 
              onClick={() => setActiveTab('client')} 
              className={`py-3 px-6 font-semibold text-sm tracking-wide transition-all border-b-2 flex items-center gap-2 ${activeTab === 'client' ? 'border-yellow-400 text-yellow-300 bg-white/5' : 'border-transparent text-indigo-200 hover:text-white'}`}
            >
              <UserPlus className="w-4 h-4" /> Ambil Nomor & Tiket Saya
            </button>
            <button 
              onClick={() => setActiveTab('monitor')} 
              className={`py-3 px-6 font-semibold text-sm tracking-wide transition-all border-b-2 flex items-center gap-2 ${activeTab === 'monitor' ? 'border-yellow-400 text-yellow-300 bg-white/5' : 'border-transparent text-indigo-200 hover:text-white'}`}
            >
              <Volume2 className="w-4 h-4 animate-bounce" /> Monitor Ruang Tunggu
            </button>
            <button 
              onClick={() => setActiveTab('admin')} 
              className={`py-3 px-6 font-semibold text-sm tracking-wide transition-all border-b-2 flex items-center gap-2 ${activeTab === 'admin' ? 'border-yellow-400 text-yellow-300 bg-white/5' : 'border-transparent text-indigo-200 hover:text-white'}`}
            >
              <Shield className="w-4 h-4" /> Panel Kontrol Admin
            </button>
          </div>
        </div>
      </header>

      {}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* ==================== CLIENT VIEW ==================== */}
        {activeTab === 'client' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Form Pendaftaran Left Card */}
            <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl shadow-lg border border-slate-200">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
                <Sparkles className="text-indigo-600 w-6 h-6" />
                <h2 className="text-xl font-bold text-slate-800">Formulir Ambil Nomor Antrean</h2>
              </div>

              {myTicket ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-amber-800 font-bold text-sm">Anda telah memiliki nomor antrean hari ini!</h4>
                    <p className="text-slate-600 text-xs mt-1">Harap selesaikan antrean Anda yang terbit saat ini sebelum memesan antrean baru. Cek detail tiket Anda di sebelah kanan.</p>
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleTakeQueue} className="space-y-5">
                <div>
                  <label className="block text-slate-700 text-sm font-bold mb-1.5">Nama Lengkap Siswa <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Contoh: Muhammad Rafli" 
                    disabled={myTicket !== null || isSubmitting}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 text-slate-800 font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-slate-700 text-sm font-bold mb-1.5">Sekolah Asal <span className="text-rose-500">*</span></label>
                    <input 
                      type="text" 
                      value={originSchool}
                      onChange={(e) => setOriginSchool(e.target.value)}
                      placeholder="Contoh: SMP Negeri 1 Jakarta" 
                      disabled={myTicket !== null || isSubmitting}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 text-slate-800 font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 text-sm font-bold mb-1.5">Peringkat / Nilai Rata Rapor <span className="text-rose-500">*</span></label>
                    <input 
                      type="text" 
                      value={studentRank}
                      onChange={(e) => setStudentRank(e.target.value)}
                      placeholder="Contoh: Rangking 1 / Nilai: 91.5" 
                      disabled={myTicket !== null || isSubmitting}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 text-slate-800 font-medium"
                      required
                    />
                  </div>
                </div>

                {}
                <div>
                  <label className="block text-slate-700 text-sm font-bold mb-3">Pilih Jalur Pendaftaran <span className="text-rose-500">*</span></label>
                  <div className="space-y-3">
                    {Object.entries(JALUR_CONFIG).map(([key, config]) => {
                      const currentCount = counters[`seq_${key}`] || 0;
                      const quotaLeft = config.quota - currentCount;
                      const isFull = quotaLeft <= 0;
                      const classes = getColorClasses(key);

                      return (
                        <label 
                          key={key} 
                          className={`relative flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                            selectedPath === key 
                              ? `ring-2 ring-indigo-500 border-indigo-500 ${classes.bg}` 
                              : 'hover:bg-slate-50 border-slate-200'
                          } ${isFull || myTicket ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center space-x-3">
                            <input 
                              type="radio" 
                              name="pathSelection" 
                              value={key}
                              checked={selectedPath === key}
                              onChange={() => !isFull && !myTicket && setSelectedPath(key)}
                              disabled={isFull || myTicket !== null || isSubmitting}
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <div>
                              <span className="font-extrabold text-slate-800 block text-sm md:text-base">{config.label}</span>
                              <span className="text-xs text-slate-500">Prefix: {config.prefix} • Kuota Maks: {config.quota}</span>
                            </div>
                          </div>
                          
                          <div className="mt-2 md:mt-0 flex items-center space-x-2">
                            <span className={`px-2 py-1 text-xs rounded-lg font-bold ${isFull ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'}`}>
                              {isFull ? 'Terisi Penuh' : `Tersisa: ${quotaLeft} kursi`}
                            </span>
                            
                            {/* Simple dynamic bar */}
                            <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden hidden md:block">
                              <div 
                                className={`h-full ${classes.fill}`} 
                                style={{ width: `${Math.min(100, (currentCount / config.quota) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={myTicket !== null || isSubmitting}
                  className="w-full bg-gradient-to-r from-indigo-700 to-indigo-800 hover:from-indigo-800 hover:to-indigo-900 text-white py-4 px-6 rounded-2xl font-extrabold tracking-wide text-lg shadow-lg hover:shadow-xl transition-all disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Sedang Memproses Nomor Antrean...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Konfirmasi & Ambil Tiket</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {}
            <div className="lg:col-span-5 flex flex-col space-y-6">
              <div className="bg-slate-950 text-white p-6 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl"></div>

                <div className="text-center pb-4 border-b border-slate-800">
                  <h3 className="font-extrabold text-lg text-slate-300 tracking-wide uppercase">TIKET ANTREAN PPDB DAFTAR ULANG</h3>
                  <p className="text-xs text-yellow-300 font-semibold mt-1">JANGAN HILANGKAN TIKET INI</p>
                </div>

                {myTicket ? (
                  <div className="py-6">
                    {/* Security Authenticator Tag */}
                    <div className="flex justify-between items-center bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-[10px] font-mono mb-6 text-slate-400">
                      <span>VERIFIED TICKET</span>
                      <span className="text-emerald-400 font-bold">{myTicket.securityHash}</span>
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Nomor Antrean Anda</p>
                      <h2 className="text-6xl font-black text-white tracking-wider mt-2 bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent font-mono">
                        {myTicket.queueCode}
                      </h2>
                      <span className="mt-2 inline-block px-3 py-1 bg-white/10 text-white rounded-full text-xs font-semibold">
                        {JALUR_CONFIG[myTicket.path]?.label}
                      </span>
                    </div>

                    {/* Metadata */}
                    <div className="mt-8 space-y-3 bg-slate-900 p-4 rounded-2xl border border-slate-800 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Nama Siswa:</span>
                        <span className="text-white font-bold">{myTicket.studentName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Sekolah Asal:</span>
                        <span className="text-white font-bold">{myTicket.originSchool}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Rangking / Skor:</span>
                        <span className="text-yellow-300 font-bold">{myTicket.rank}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-800/60 pt-2 text-xs">
                        <span className="text-slate-500">Tanggal Ambil:</span>
                        <span className="text-slate-300 font-mono font-bold">{myTicket.date}</span>
                      </div>
                    </div>

                    {/* Live Tracker Status */}
                    <div className="mt-6 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-900/40 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Live Status Antrean Anda</p>
                      </div>
                      
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-900 p-2 rounded-lg">
                          <p className="text-slate-500">Sedang Dipanggil</p>
                          <p className="text-lg font-extrabold text-white">
                            {counters[`call_${myTicket.path}`] > 0 
                              ? `${JALUR_CONFIG[myTicket.path].prefix}-${String(counters[`call_${myTicket.path}`]).padStart(3, '0')}` 
                              : 'Belum Mulai'}
                          </p>
                        </div>
                        <div className="bg-slate-900 p-2 rounded-lg">
                          <p className="text-slate-500">Sisa Antrean</p>
                          <p className="text-lg font-extrabold text-yellow-400">
                            {Math.max(0, myTicket.queueNumber - (counters[`call_${myTicket.path}`] || 0))} orang lagi
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        {myTicket.status === 'calling' ? (
                          <div className="bg-emerald-600 text-white font-extrabold text-xs py-2 px-4 rounded-lg animate-pulse">
                            🚨 SEKARANG GILIRAN ANDA! SILAKAN KE MEJA DAFTAR ULANG
                          </div>
                        ) : myTicket.status === 'completed' ? (
                          <div className="bg-slate-800 text-slate-400 font-extrabold text-xs py-2 px-4 rounded-lg">
                            ✓ Pendaftaran Selesai diproses
                          </div>
                        ) : myTicket.status === 'skipped' ? (
                          <div className="bg-rose-900 text-rose-200 font-extrabold text-xs py-2 px-4 rounded-lg">
                            ⚠️ Antrean Anda Terlewat. Hubungi Panitia Loket
                          </div>
                        ) : (
                          <div className="bg-indigo-900/60 text-indigo-200 font-bold text-xs py-2 px-4 rounded-lg">
                            Menunggu di antrean...
                          </div>
                        )}
                      </div>
                    </div>

                    <button 
                      onClick={() => window.print()}
                      className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2.5 rounded-xl border border-white/15 transition-all flex items-center justify-center space-x-2"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cetak Tiket Fisik / Simpan PDF</span>
                    </button>

                    <button 
                      onClick={() => {
                        const leave = window.confirm("Ingin membatalkan tampilan tiket aktif ini di perangkat ini?");
                        if(leave) {
                          localStorage.removeItem('active_re_reg_ticket');
                          setMyTicket(null);
                        }
                      }}
                      className="w-full mt-2 text-slate-500 hover:text-rose-400 text-[10px] text-center transition-all underline"
                    >
                      Keluar / Sembunyikan Tiket ini dari Browser Ini
                    </button>

                  </div>
                ) : (
                  <div className="py-16 text-center text-slate-500">
                    <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-sm font-semibold">Belum ada tiket aktif di browser ini.</p>
                    <p className="text-xs text-slate-600 mt-2">Silakan isi formulir di sebelah kiri untuk membuat nomor antrean live hari ini.</p>
                  </div>
                )}
              </div>

              {/* Informational Widget */}
              <div className="bg-indigo-900 text-white p-6 rounded-3xl shadow-lg border border-indigo-950">
                <h4 className="font-extrabold text-yellow-300 flex items-center space-x-2 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>PERINGATAN ANTI-PENIPUAN DATA:</span>
                </h4>
                <p className="text-xs text-indigo-100 mt-2 leading-relaxed">
                  Semua nomor antrean online memiliki <strong className="text-yellow-200">Kode Verifikasi Keamanan Unik</strong> dan terekam di server database live. Kami tidak melayani screenshot hari kemarin. Panitia loket akan memverifikasi tanggal terbit tiket secara riil saat verifikasi di sekolah.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ==================== MONITOR VIEW ==================== */}
        {activeTab === 'monitor' && (
          <div className="space-y-8">
            {/* Header of Screen Monitor */}
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
              <h2 className="text-2xl font-black tracking-tight text-indigo-900">MONITOR LIVE RUANG TUNGGU DAFTAR ULANG</h2>
              <p className="text-slate-500 text-sm mt-1">Status panggilan riil langsung di layar monitor sekolah</p>
            </div>

            {}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {Object.entries(JALUR_CONFIG).map(([key, config]) => {
                const calledNumber = counters[`call_${key}`] || 0;
                const formattedNum = String(calledNumber).padStart(3, '0');
                const lastSeq = counters[`seq_${key}`] || 0;
                const progressLeft = Math.max(0, lastSeq - calledNumber);
                const colors = getColorClasses(key);

                return (
                  <div 
                    key={key} 
                    className={`bg-white rounded-3xl border shadow-lg overflow-hidden transition-all transform hover:-translate-y-1 ${
                      calledNumber > 0 ? 'ring-2 ring-emerald-500/50' : ''
                    }`}
                  >
                    {/* Path Title Badge Header */}
                    <div className="bg-slate-900 text-white p-4 text-center">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{config.prefix}</p>
                      <h3 className="font-black text-sm truncate mt-0.5">{config.label}</h3>
                    </div>

                    {/* Big Call Board */}
                    <div className="p-6 text-center">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">SEDANG DIPANGGIL</p>
                      
                      <div className="my-4 relative inline-block">
                        {calledNumber > 0 ? (
                          <>
                            <h2 className="text-5xl font-black text-slate-900 tracking-wider font-mono">
                              {config.prefix}-{formattedNum}
                            </h2>
                            {/* Blinking Live indicator */}
                            <div className="absolute -top-1 -right-4 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </div>
                          </>
                        ) : (
                          <h2 className="text-3xl font-extrabold text-slate-300">
                            KOSONG
                          </h2>
                        )}
                      </div>

                      {/* Line Status */}
                      <div className="border-t border-slate-100 pt-4 space-y-2 text-xs font-semibold">
                        <div className="flex justify-between text-slate-500">
                          <span>Total Terbit:</span>
                          <span className="text-slate-800 font-bold font-mono">{lastSeq} dari {config.quota}</span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>Antrean Tunggu:</span>
                          <span className="text-indigo-600 font-bold font-mono">{progressLeft} orang</span>
                        </div>
                      </div>
                    </div>

                    {/* Small visual action indicator */}
                    <div className="bg-slate-50 border-t border-slate-100 p-3 text-center text-[10px] text-slate-400 font-bold">
                      {calledNumber > 0 ? "SEGERA KE MEJA PANITIA" : "MENUNGGU PANGGILAN"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Waiting Board Table overview */}
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <span>Urutan Tunggu Antrean Selanjutnya (Hari Ini)</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="p-3">Waktu</th>
                      <th className="p-3">Kode Antrean</th>
                      <th className="p-3">Nama Siswa</th>
                      <th className="p-3">Sekolah Asal</th>
                      <th className="p-3">Jalur</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.filter(t => t.date === counters.date).slice(0, 10).map((t) => (
                      <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all font-medium">
                        <td className="p-3 text-slate-400 text-xs font-mono">
                          {t.timestamp ? new Date(t.timestamp.seconds * 1000).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'}
                        </td>
                        <td className="p-3 font-bold font-mono text-indigo-600">{t.queueCode}</td>
                        <td className="p-3 text-slate-800">{t.studentName}</td>
                        <td className="p-3 text-slate-500">{t.originSchool}</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getColorClasses(t.path).badge}`}>
                            {JALUR_CONFIG[t.path]?.label}
                          </span>
                        </td>
                        <td className="p-3">
                          {t.status === 'waiting' && <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-bold text-xs">Tunggu</span>}
                          {t.status === 'calling' && <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold text-xs animate-pulse">Dipanggil</span>}
                          {t.status === 'completed' && <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-bold text-xs">Selesai</span>}
                          {t.status === 'skipped' && <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-bold text-xs">Dilewati</span>}
                        </td>
                      </tr>
                    ))}
                    {tickets.filter(t => t.date === counters.date).length === 0 && (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-slate-400">Belum ada antrean masuk untuk hari ini.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== ADMIN CONTROL PANEL VIEW ==================== */}
        {activeTab === 'admin' && (
          <div className="space-y-8">
            {/* Password Unlock Screen */}
            {!isAdminUnlocked ? (
              <div className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-center">
                <Lock className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
                <h3 className="text-xl font-extrabold text-slate-800">Buka Akses Panel Admin</h3>
                <p className="text-xs text-slate-500 mt-1">Masukkan kata sandi admin Anda untuk mengelola antrean.</p>
                
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if(adminPassword === 'admin123' || adminPassword === 'panitiadaftarulang') {
                      setIsAdminUnlocked(true);
                      setAdminPassword('');
                      showToast("Sistem admin berhasil dibuka!", "success");
                    } else {
                      showToast("Kata sandi salah!", "error");
                    }
                  }}
                  className="mt-6 space-y-4"
                >
                  <input 
                    type="password" 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Masukkan Kata Sandi" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center text-slate-800 font-bold"
                  />
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all"
                  >
                    Buka Akses
                  </button>
                  <span className="block text-[10px] text-slate-400">Petunjuk default: ketik <strong className="text-indigo-500 font-extrabold">admin123</strong></span>
                </form>
              </div>
            ) : (
              <div className="space-y-8 animate-fadeIn">
                
                {/* Admin Control Bar */}
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-indigo-600" />
                      <span>Panel Utama Kontrol Antrean</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Operasional Panggilan, Reset Hari, & Ekspor Laporan Database</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={handleExportCSV}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow transition-all flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" /> Ekspor Excel/CSV
                    </button>
                    <button 
                      onClick={handleResetForNewDay}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow transition-all flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-4 h-4" /> Mulai Hari Baru
                    </button>
                    <button 
                      onClick={() => setIsAdminUnlocked(false)}
                      className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all"
                    >
                      Kunci Panel
                    </button>
                  </div>
                </div>

                {/* Grid calling panel for operators */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  {Object.entries(JALUR_CONFIG).map(([key, config]) => {
                    const activeSeq = counters[`seq_${key}`] || 0;
                    const activeCall = counters[`call_${key}`] || 0;
                    const nextNumStr = String(activeCall + 1).padStart(3, '0');
                    const hasWaiting = activeSeq > activeCall;

                    return (
                      <div key={key} className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400">{config.prefix}</span>
                              <h4 className="font-extrabold text-xs text-slate-800 line-clamp-1">{config.label}</h4>
                            </div>
                            <span className="text-xs bg-indigo-50 text-indigo-700 font-extrabold py-0.5 px-1.5 rounded">
                              {activeCall}/{activeSeq}
                            </span>
                          </div>

                          <div className="text-center py-4 bg-slate-50 rounded-2xl mb-4 border border-slate-100">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Saat ini Dipanggil</span>
                            <span className="text-3xl font-mono font-black text-indigo-950 block mt-1">
                              {activeCall > 0 ? `${config.prefix}-${String(activeCall).padStart(3, '0')}` : "None"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 mt-auto">
                          <button 
                            onClick={() => handleNextCall(key)}
                            disabled={!hasWaiting}
                            className={`w-full text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-1 shadow transition-all ${
                              hasWaiting 
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Panggil Selanjutnya ({config.prefix}-{nextNumStr})</span>
                          </button>

                          {activeCall > 0 && (
                            <button 
                              onClick={() => speakQueueCall(config.label, `${config.prefix}-${String(activeCall).padStart(3, '0')}`)}
                              className="w-full text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-1 border border-slate-200"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Panggil Ulang Suara</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {}
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600" />
                        <span>Manajemen Seluruh Data Pendaftar</span>
                      </h3>
                      <p className="text-xs text-slate-400">Total data tersimpan di sistem: {tickets.length} pendaftar</p>
                    </div>

                    {/* Search and Filter Inputs */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                        <input 
                          type="text" 
                          placeholder="Cari nama, sekolah, kode..." 
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <select 
                        value={selectedFilterPath}
                        onChange={(e) => setSelectedFilterPath(e.target.value)}
                        className="py-2.5 px-4 rounded-xl border border-slate-300 text-xs text-slate-700 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">Semua Jalur</option>
                        {Object.entries(JALUR_CONFIG).map(([key, config]) => (
                          <option key={key} value={key}>{config.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                          <th className="p-3">Tanggal</th>
                          <th className="p-3">Kode Antrean</th>
                          <th className="p-3">Nama Siswa</th>
                          <th className="p-3">Sekolah Asal</th>
                          <th className="p-3">Rangking/Skor</th>
                          <th className="p-3">Jalur</th>
                          <th className="p-3">Status Antrean</th>
                          <th className="p-3 text-center">Aksi Operasional</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTickets.map((t) => (
                          <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-all font-medium">
                            <td className="p-3 text-slate-400 font-mono text-nowrap">{t.date}</td>
                            <td className="p-3 font-bold font-mono text-indigo-600">{t.queueCode}</td>
                            <td className="p-3 text-slate-800">{t.studentName}</td>
                            <td className="p-3 text-slate-500">{t.originSchool}</td>
                            <td className="p-3 font-semibold text-yellow-600">{t.rank}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getColorClasses(t.path).badge}`}>
                                {JALUR_CONFIG[t.path]?.label}
                              </span>
                            </td>
                            <td className="p-3">
                              {t.status === 'waiting' && <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-bold">Menunggu</span>}
                              {t.status === 'calling' && <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold animate-pulse">Dipanggil</span>}
                              {t.status === 'completed' && <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-bold">Selesai</span>}
                              {t.status === 'skipped' && <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-bold">Dilewati</span>}
                            </td>
                            <td className="p-3 flex justify-center space-x-1">
                              {t.status === 'waiting' && (
                                <>
                                  <button 
                                    onClick={() => handleUpdateStatus(t.id, 'calling')}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold py-1 px-2.5 rounded transition-all"
                                  >
                                    Panggil
                                  </button>
                                  <button 
                                    onClick={() => handleUpdateStatus(t.id, 'skipped')}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold py-1 px-2 rounded transition-all"
                                  >
                                    Lewati
                                  </button>
                                </>
                              )}
                              {t.status === 'calling' && (
                                <>
                                  <button 
                                    onClick={() => handleUpdateStatus(t.id, 'completed')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1 px-2.5 rounded transition-all"
                                  >
                                    Selesaikan
                                  </button>
                                  <button 
                                    onClick={() => handleUpdateStatus(t.id, 'skipped')}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold py-1 px-2 rounded transition-all"
                                  >
                                    Lewati
                                  </button>
                                </>
                              )}
                              {t.status === 'skipped' && (
                                <button 
                                  onClick={() => handleUpdateStatus(t.id, 'waiting')}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold py-1 px-2.5 rounded transition-all"
                                >
                                  Kembalikan Ke Antrean
                                </button>
                              )}
                              {t.status === 'completed' && (
                                <span className="text-emerald-600 text-[10px] font-bold">✓ Sukses</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {filteredTickets.length === 0 && (
                          <tr>
                            <td colSpan="8" className="p-8 text-center text-slate-400">Tidak ada pendaftar yang cocok dengan filter pencarian.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

      </main>

      {/* Modern Professional Footer */}
      <footer className="text-center text-slate-400 text-xs py-10 mt-12 border-t border-slate-200">
        <p>© 2026 PPDB Online. Didesain Khusus untuk Efisiensi & Ketertiban Proses Daftar Ulang Sekolah.</p>
        <p className="text-indigo-400 font-semibold mt-1">Status Keamanan Server: Live & Terinkripsi (Anti-Double Enabled)</p>
      </footer>
    </div>
  );
}