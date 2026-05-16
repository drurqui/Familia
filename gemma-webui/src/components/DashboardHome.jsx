import { useState, useEffect, useRef } from 'react';
import { HardDrive, Cpu, Network, Activity, ArrowDown, ArrowUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function DashboardHome({ netData, currentSpeed }) {
  const containerRef = useRef(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    // Usamos ResizeObserver para obtener píxeles reales, no porcentajes
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        // Solo actualizamos si el tamaño es válido para evitar el error de Recharts
        if (width > 0 && height > 0) {
          setChartSize({ width, height });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const stats = [
    { title: "Almacenamiento NAS", value: "Conectado", icon: <HardDrive size={20} className="text-blue-400" />, status: "En línea" },
    { title: "Servidor Debian", value: "Operativo", icon: <Cpu size={20} className="text-emerald-400" />, status: "Estable" },
    { title: "Red Local", value: "HTTPS Seguro", icon: <Network size={20} className="text-purple-400" />, status: "SSL Activo" },
    { title: "Gemma AI", value: "Modelo 26B", icon: <Activity size={20} className="text-amber-400" />, status: "Lista" },
  ];

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header>
          <h1 className="text-3xl font-bold text-white tracking-tight">Centro de Control Familiar</h1>
          <p className="text-slate-400 mt-2">Métricas en tiempo real y estado del sistema.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="bg-zinc-900 border border-white/5 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-white/5 rounded-lg">{stat.icon}</div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{stat.status}</span>
              </div>
              <h3 className="text-slate-400 text-sm font-medium">{stat.title}</h3>
              <p className="text-xl font-semibold text-white mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           
           <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-white font-semibold text-sm">Tráfico de Red</h3>
                <div className="flex gap-4 text-xs font-medium">
                  <span className="flex items-center gap-1 text-blue-400">
                    <ArrowDown size={14} /> {currentSpeed.rx.toFixed(2)} KB/s
                  </span>
                  <span className="flex items-center gap-1 text-purple-400">
                    <ArrowUp size={14} /> {currentSpeed.tx.toFixed(2)} KB/s
                  </span>
                </div>
              </div>
              
              {/* Contenedor con altura h-60 fija */}
              <div ref={containerRef} className="w-full h-60 relative overflow-hidden">
                {/* Eliminamos ResponsiveContainer y pasamos width/height manuales */}
                {chartSize.width > 0 && (
                  <AreaChart 
                    width={chartSize.width} 
                    height={chartSize.height} 
                    data={netData} 
                    margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="time" stroke="#475569" fontSize={10} tickMargin={10} />
                    <YAxis stroke="#475569" fontSize={10} tickFormatter={(val) => `${val} KB`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="rx" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRx)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="tx" stroke="#a855f7" fillOpacity={1} fill="url(#colorTx)" isAnimationActive={false} />
                  </AreaChart>
                )}
              </div>
           </div>

           <div className="bg-zinc-900 border border-white/5 rounded-2xl p-8 shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="text-white font-semibold text-lg">Servidor IA Local</h3>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                  El motor de IA está funcionando localmente. Tus conversaciones y documentos no salen de tu red.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest font-bold">API Proxy Nginx Activo</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}