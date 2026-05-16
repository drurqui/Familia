import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Camera, Bot, Menu, X } from 'lucide-react';
import GemmaChat from './components/GemmaChat';
import PhotoGallery from './components/PhotoGallery';
import DashboardHome from './components/DashboardHome';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('tab') || 'home';
  });
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState({ rx: 0, tx: 0 });
  const [netData, setNetData] = useState(() => {
    const initData = [];
    const now = new Date();
    for (let i = 19; i >= 0; i--) {
      const past = new Date(now.getTime() - (i * 2000));
      initData.push({
        time: past.toLocaleTimeString('es-SV', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        rx: 0, tx: 0
      });
    }
    return initData;
  });

  useEffect(() => {
    const newUrl = activeTab === 'home' ? window.location.pathname : `${window.location.pathname}?tab=${activeTab}`;
    window.history.replaceState(null, '', newUrl);
  }, [activeTab]);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`/network-metrics.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();

        setCurrentSpeed(data);
        setNetData(prev => {
          const now = new Date();
          const timeString = now.toLocaleTimeString('es-SV', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
          return [...prev.slice(1), { time: timeString, rx: data.rx, tx: data.tx }];
        });
      } catch (e) { /* Error silencioso */ }
    };

    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { id: 'home', label: 'Inicio', icon: <LayoutDashboard size={20} /> },
    { id: 'photos', label: 'Fotos', icon: <Camera size={20} /> },
    { id: 'gemma', label: 'Gemma AI', icon: <Bot size={20} /> },
  ];

  const handleTabChange = (id) => {
    setActiveTab(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-slate-200 overflow-hidden font-sans relative">
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden" 
          />
        )}
      </AnimatePresence>

      <aside className={`fixed md:relative inset-y-0 left-0 w-64 bg-[#121214] border-r border-white/5 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 md:p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
              <span className="font-bold text-white">UB</span>
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-white">Urquilla's <span className="text-blue-500">Home</span></h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-500 hover:text-white p-2"><X size={24} /></button>
        </div>

        <nav className="flex-1 px-4 space-y-1.5">
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => handleTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${activeTab === item.id ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}>
              <span className={activeTab === item.id ? 'text-blue-400' : 'group-hover:text-slate-300'}>{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 bg-[#0e0e10]">
          <div className="flex items-center gap-3 p-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Debian Server Online</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 relative flex flex-col min-w-0 w-full bg-[#09090b]">
        <header className="h-16 shrink-0 border-b border-white/5 flex items-center gap-4 px-4 md:px-8 bg-[#09090b]/80 backdrop-blur-md z-20">
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg transition-colors"><Menu size={24} /></button>
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 truncate">{menuItems.find(i => i.id === activeTab)?.label}</h2>
        </header>

        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full w-full">
              {activeTab === 'home' && <DashboardHome netData={netData} currentSpeed={currentSpeed} />}
              {activeTab === 'photos' && <PhotoGallery />}
              {activeTab === 'gemma' && <GemmaChat />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}