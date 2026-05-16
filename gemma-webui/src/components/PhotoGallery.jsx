import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, ChevronLeft, ChevronRight, Maximize2, X, 
  Home, RefreshCw, Upload, Loader2, Image as ImageIcon,
  FolderPlus, Trash2, AlertCircle, CheckCircle2
} from 'lucide-react';

export default function PhotoGallery() {
  const [rootFolder, setRootFolder] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [modal, setModal] = useState({ show: false, title: '', msg: '', type: 'confirm', onConfirm: null });
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const fileInputRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(p => ({ ...p, show: false })), 3000);
  };

  const currentFolder = useMemo(() => history.length > 0 ? history[history.length - 1] : rootFolder, [history, rootFolder]);
  const currentPath = useMemo(() => history.map(f => f.name).join('/'), [history]);

  const loadPhotos = useCallback((isManualRefresh = false) => {
    if (!isManualRefresh) setLoading(true);
    fetch(`/media/tree.json?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        setRootFolder(data);
        setHistory(prev => {
          let updated = data;
          const newHistory = [];
          for (const histFolder of prev) {
            const found = updated.children?.find(c => c.name === histFolder.name);
            if (found) { updated = found; newHistory.push(found); } else break;
          }
          return newHistory;
        });
      }).catch(() => showToast("Error de conexión con el NAS", "error")).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  useEffect(() => {
    if (viewingPhotoIndex === null || !currentFolder?.photos?.length) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        setViewingPhotoIndex(p => (p + 1) % currentFolder.photos.length);
      } else if (e.key === 'ArrowLeft') {
        setViewingPhotoIndex(p => (p - 1 + currentFolder.photos.length) % currentFolder.photos.length);
      } else if (e.key === 'Escape') {
        setViewingPhotoIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingPhotoIndex, currentFolder]);

  const triggerManualRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/scan-photos');
      const data = await res.json();
      if (data.status === "success") loadPhotos(true);
    } finally { setRefreshing(false); }
  };

  // --- FUNCIÓN PARA MOVER FOTOS ---
  const handleMovePhoto = async (sourceUrl, targetAlbumPath) => {
    const cleanSourcePath = sourceUrl.split('/media/').pop().replace(/^\/+/, '');
    
    try {
      setRefreshing(true);
      const res = await fetch('/api/move-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: cleanSourcePath, targetAlbum: targetAlbumPath })
      });
      const result = await res.json();
      
      if (result.status === "success") {
        showToast("Foto movida exitosamente");
        
        // Actualización optimista de la UI
        setRootFolder(prev => {
          const updateFolderTree = (node) => {
            if (node.path === currentFolder.path) {
              return { ...node, photos: node.photos.filter(p => p.url !== sourceUrl) };
            }
            if (node.children) {
              return { ...node, children: node.children.map(updateFolderTree) };
            }
            return node;
          };
          return updateFolderTree(prev);
        });

        triggerManualRefresh();
      } else {
        showToast(result.message, "error");
      }
    } catch (e) { 
      showToast("Error al mover la foto", "error"); 
    } finally {
      setRefreshing(false);
    }
  };

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    const totalFiles = files.length;
    setUploadProgress({ current: 0, total: totalFiles });

    for (let i = 0; i < totalFiles; i++) {
      const formData = new FormData();
      formData.append("albumPath", currentPath);
      formData.append("files", files[i]);
      setUploadProgress({ current: i + 1, total: totalFiles });

      try {
        const response = await fetch('/api/upload-photos', { method: 'POST', body: formData });
        if (response.ok) await new Promise(r => setTimeout(r, 800));
      } catch (e) { console.error(e); }
    }
    setUploading(false);
    showToast(`Subida finalizada: ${totalFiles} fotos`);
    triggerManualRefresh();
  };

  const handleDeletePhoto = (photo) => {
    const cleanPath = photo.url.split('/media/').pop().replace(/^\/+/, '');
    
    setModal({
      show: true,
      title: 'Eliminar Foto',
      msg: '¿Confirmas que deseas borrar esta foto? Las demás se reacomodarán al instante.',
      type: 'confirm',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/delete-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoPath: cleanPath })
          });
          const result = await res.json();
          
          if (result.status === "success") {
            showToast("Foto eliminada");
            setRootFolder(prev => {
              const updateFolderTree = (node) => {
                if (node.path === currentFolder.path) {
                  return { ...node, photos: node.photos.filter(p => p.url !== photo.url) };
                }
                if (node.children) {
                  return { ...node, children: node.children.map(updateFolderTree) };
                }
                return node;
              };
              return updateFolderTree(prev);
            });
            triggerManualRefresh();
          } else {
            showToast(result.message, "error");
            triggerManualRefresh();
          }
        } catch (e) { showToast("Error de conexión", "error"); }
        setModal(p => ({ ...p, show: false }));
      }
    });
  };

  const handleCreateAlbum = () => {
    setModal({
      show: true,
      title: 'Nuevo Álbum',
      msg: 'Nombre de la carpeta:',
      type: 'prompt',
      onConfirm: async (name) => {
        if (!name) return;
        setRefreshing(true);
        try {
          const res = await fetch('/api/create-album', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPath, albumName: name })
          });
          if ((await res.json()).status === "success") {
            showToast("Álbum creado");
            triggerManualRefresh();
          }
        } finally {
          setRefreshing(false);
          setModal(p => ({ ...p, show: false }));
        }
      }
    });
  };

  const getAlbumCover = (child) => {
    const explicitCover = child.photos?.find(p => p.name.toLowerCase().split('.')[0] === 'cover');
    return explicitCover ? explicitCover.thumb : child.cover;
  };

  if (loading || !rootFolder) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500 font-medium">
      <Loader2 className="animate-spin text-blue-500" size={48} />
      <span>Sincronizando con el servidor...</span>
    </div>
  );

  return (
    <div className={`p-8 h-full overflow-y-auto custom-scrollbar ${isDragging ? 'bg-blue-500/5' : ''}`}
      onDragOver={(e) => {e.preventDefault(); setIsDragging(true);}} onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault(); 
        setIsDragging(false); 
        // Si hay archivos arrastrados desde fuera del navegador (subida normal)
        if (e.dataTransfer.files?.length > 0) {
          handleFiles(e.dataTransfer.files);
        }
      }}>
      
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6 font-medium">
              <button onClick={() => setHistory([])} className="hover:text-blue-400 transition-colors">Inicio</button>
              {history.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-slate-800">/</span>
                  <button onClick={() => setHistory(history.slice(0, i + 1))} className={i === history.length - 1 ? 'text-white' : 'hover:text-blue-400'}>{f.name}</button>
                </div>
              ))}
            </nav>
            <div className="flex items-center gap-4">
              {history.length > 0 && <button onClick={() => setHistory(p => p.slice(0, -1))} className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 transition-all"><ChevronLeft size={24} /></button>}
              <h1 className="text-4xl font-black text-white tracking-tight">{currentFolder.name}</h1>
            </div>
          </div>
          <div className="flex gap-3">
            <input type="file" multiple ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} className="hidden" accept="image/*" />
            <button onClick={handleCreateAlbum} className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl border border-white/5 transition-all">Nuevo Álbum</button>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50">
              {uploading ? `Subiendo ${uploadProgress.current}/${uploadProgress.total}` : "Cargar Fotos"}
            </button>
            <button onClick={triggerManualRefresh} className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white transition-all"><RefreshCw className={refreshing ? "animate-spin" : ""} size={22} /></button>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-6 gap-6">
          {/* CARPETAS / ÁLBUMES (Receptores de Drag & Drop) */}
          {currentFolder.children?.map(child => (
            <motion.div 
              key={child.path} 
              whileHover={{ y: -5 }} 
              onClick={() => setHistory(p => [...p, child])} 
              className="group cursor-pointer bg-zinc-900 rounded-2xl overflow-hidden aspect-4/5 relative border border-white/5 shadow-2xl hover:border-blue-500/50 transition-colors"
              
              /* EVENTOS PARA RECIBIR LA FOTO SOLTADA */
              onDragOver={(e) => {
                e.preventDefault(); 
                e.stopPropagation(); 
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                
                const draggedPhotoUrl = e.dataTransfer.getData('text/plain');
                if (draggedPhotoUrl) {
                  handleMovePhoto(draggedPhotoUrl, child.path);
                }
              }}
            >
              <img src={getAlbumCover(child) || ''} className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-500 pointer-events-none" />
              <div className="absolute inset-0 bg-linear-to-t from-black via-black/10 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none">
                <div className="text-white font-bold truncate text-sm mb-1">{child.name}</div>
                <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{child.photos?.length || 0} fotos</div>
              </div>
            </motion.div>
          ))}

          {/* FOTOS (Arrastrables) */}
          {currentFolder.photos?.map((photo, idx) => (
            <motion.div 
              layout 
              key={photo.url} 
              className="group relative aspect-square bg-zinc-900 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing border border-white/5 shadow-xl" 
              onClick={() => setViewingPhotoIndex(idx)}
              
              /* EVENTOS PARA ARRASTRAR */
              draggable={true}
              onDragStart={(e) => {
                e.stopPropagation(); 
                e.dataTransfer.setData('text/plain', photo.url);
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              <img 
                src={photo.thumb} 
                draggable={false} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 pointer-events-none" 
                loading="lazy" 
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                <Maximize2 className="text-white pointer-events-none" size={20} />
                <button 
                  onMouseDown={(e) => e.stopPropagation()} 
                  onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo); }} 
                  className="p-3 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded-full transition-all backdrop-blur-sm shadow-xl"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* MODALES Y TOASTS */}
      <AnimatePresence>
        {modal.show && (
          <div className="fixed inset-0 z-210 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModal(p => ({ ...p, show: false }))} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
              <h3 className="text-2xl font-black text-white mb-2 tracking-tight">{modal.title}</h3>
              <p className="text-slate-400 mb-8 text-sm leading-relaxed">{modal.msg}</p>
              {modal.type === 'prompt' && <input id="modalInput" autoFocus className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white mb-8 focus:border-blue-500 outline-none transition-all" />}
              <div className="flex justify-center gap-4 font-bold text-sm">
                <button onClick={() => setModal(p => ({ ...p, show: false }))} className="px-6 py-2 text-slate-500 hover:text-white transition-colors">Cancelar</button>
                <button 
                  onClick={() => modal.onConfirm(modal.type === 'prompt' ? document.getElementById('modalInput').value : null)} 
                  className={`px-8 py-3 rounded-xl transition-all shadow-lg ${modal.title.includes('Eliminar') ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'} text-white`}
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast.show && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-220 flex items-center gap-3 px-6 py-4 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl">
            {toast.type === 'success' ? <CheckCircle2 className="text-emerald-500" size={20} /> : <AlertCircle className="text-red-500" size={20} />}
            <span className="text-white text-sm font-bold">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingPhotoIndex !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-100 bg-black/98 flex items-center justify-center" onClick={() => setViewingPhotoIndex(null)}>
            <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2"><X size={32} /></button>
            <button onClick={(e) => {e.stopPropagation(); setViewingPhotoIndex(p => (p - 1 + currentFolder.photos.length) % currentFolder.photos.length)}} className="absolute left-6 text-white p-4 hover:bg-white/10 rounded-full transition-all"><ChevronLeft size={48} /></button>
            <motion.img key={viewingPhotoIndex} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} src={currentFolder.photos[viewingPhotoIndex].url} className="max-w-full max-h-full object-contain shadow-2xl shadow-black" />
            <button onClick={(e) => {e.stopPropagation(); setViewingPhotoIndex(p => (p + 1) % currentFolder.photos.length)}} className="absolute right-6 text-white p-4 hover:bg-white/10 rounded-full transition-all"><ChevronRight size={48} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}