import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Plus, Trash2, Shirt, Home, X, Save, Cloud, Loader2, HelpCircle, Share, MoreVertical, Layers, Check, LayoutGrid, Sparkles, Settings, Download, Upload, AlertCircle, PenTool, Scissors, Paperclip, Edit3, Map } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- Firebase 初始化 ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- 插畫風格配置 ---
const THEME = {
  taipei: {
    bgColor: 'bg-[#f0f9ff]', 
    cardColor: 'bg-white',
    accentColor: 'bg-[#bae6fd]', 
    textColor: 'text-[#0369a1]',
    tapeColor: 'bg-[#7dd3fc]', 
    borderColor: 'border-[#0c4a6e]', 
    shadow: 'shadow-[4px_4px_0px_#bae6fd]'
  },
  kaohsiung: { // 將 changhua 更改為 kaohsiung
    bgColor: 'bg-[#fff7ed]', 
    cardColor: 'bg-white',
    accentColor: 'bg-[#fed7aa]', 
    textColor: 'text-[#c2410c]',
    tapeColor: 'bg-[#fdba74]', 
    borderColor: 'border-[#7c2d12]', 
    shadow: 'shadow-[4px_4px_0px_#fed7aa]'
  }
};

const CATEGORIES = ['上衣', '褲子/裙子', '外套', '洋裝', '鞋包', '配件', '其他'];

// --- 輔助工具 ---
const generatePlaceholderImage = (text, bgColor) => {
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 400; const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fffdf5'; ctx.fillRect(0, 0, 400, 400);
  ctx.beginPath(); ctx.arc(200, 200, 150, 0, 2 * Math.PI); ctx.fillStyle = bgColor; ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#44403c'; ctx.font = 'bold 80px cursive';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text.substring(0, 2), 200, 200);
  return canvas.toDataURL('image/jpeg', 0.5);
};

export default function App() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [locationNames, setLocationNames] = useState({ taipei: '台北家', kaohsiung: '高雄家' }); // 預設改為台北家與高雄家
  const [currentLocation, setCurrentLocation] = useState('taipei');
  const [viewMode, setViewMode] = useState('wardrobe');
  
  // Modals & UI States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null); 
  const [showOutfitModal, setShowOutfitModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toast, setToast] = useState(null); 
  const [confirmDialog, setConfirmDialog] = useState(null); 

  const [filterCategory, setFilterCategory] = useState('全部');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { console.error("Auth Error:", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // 監聽衣物
    const unsubItems = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'wardrobe_items'), (s) => {
      const d = s.docs.map(doc => ({ id: doc.id, ...doc.data() })); d.sort((a,b)=>new Date(b.dateAdded)-new Date(a.dateAdded)); setItems(d); setLoading(false);
    });
    
    // 監聽穿搭
    const unsubOutfits = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'wardrobe_outfits'), (s) => {
      const d = s.docs.map(doc => ({ id: doc.id, ...doc.data() })); d.sort((a,b)=>new Date(b.dateAdded)-new Date(a.dateAdded)); setOutfits(d);
    });

    // 監聽用戶設定
    const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.locationNames) {
          setLocationNames(data.locationNames);
        }
      }
    });

    return () => { unsubItems(); unsubOutfits(); unsubSettings(); };
  }, [user]);

  // --- Operations ---

  const addNewItem = async (newItem) => {
    if (!user) return; setSaving(true);
    try { 
      const { id, ...data } = newItem; 
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'wardrobe_items'), data); 
      setShowAddModal(false); 
      showToast('貼上貼紙了！'); 
    } catch (e) { showToast('失敗了...', 'error'); } finally { setSaving(false); }
  };

  const updateItem = async (updatedItem) => {
    if (!user) return; setSaving(true);
    try {
      const itemRef = doc(db, 'artifacts', appId, 'users', user.uid, 'wardrobe_items', updatedItem.id);
      const { id, ...dataToUpdate } = updatedItem;
      await updateDoc(itemRef, dataToUpdate);
      setEditingItem(null); 
      showToast('修改好囉！');
    } catch (e) {
      console.error(e);
      showToast('修改失敗...', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addNewOutfit = async (newOutfit) => {
    if (!user) return; setSaving(true);
    try { 
       const { id, ...data } = newOutfit;
       await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'wardrobe_outfits'), data); 
       setShowOutfitModal(false); showToast('搭配筆記完成！'); 
    } catch (e) { showToast('失敗了...', 'error'); } finally { setSaving(false); }
  }

  const handleDeleteRequest = (collectionName, id) => {
    setConfirmDialog({
      message: '要撕掉這張紀錄嗎？',
      onConfirm: async () => {
        if (!user) return;
        try { 
          await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, collectionName, id)); 
          showToast('撕掉了'); 
          setEditingItem(null);
        } catch (e) { showToast('撕不掉...', 'error'); }
        setConfirmDialog(null);
      }
    });
  };

  const saveLocationNames = async (newNames) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'), { locationNames: newNames }, { merge: true });
      showToast('名稱更新成功！');
    } catch (e) {
      showToast('更新失敗...', 'error');
    }
  };

  const loadDemoData = async () => {
    if (!user) return; setSaving(true);
    try {
      const collRef = collection(db, 'artifacts', appId, 'users', user.uid, 'wardrobe_items');
      const demoItems = [
        { name: '塗鴉T恤', category: '上衣', location: 'taipei', color: '#a5b4fc', text: 'Tee' },
        { name: '單寧外套', category: '外套', location: 'taipei', color: '#818cf8', text: 'Jkt' },
        { name: '卡其長褲', category: '褲子/裙子', location: 'taipei', color: '#fde68a', text: 'Pnt' },
        { name: '格紋襯衫', category: '上衣', location: 'kaohsiung', color: '#fca5a5', text: 'Sht' },
      ];
      for (const item of demoItems) { await addDoc(collRef, { ...item, image: generatePlaceholderImage(item.text, item.color), dateAdded: new Date().toISOString() }); }
      showToast('範例貼紙已貼上');
    } catch (e) { showToast('載入失敗', 'error'); } finally { setSaving(false); }
  };

  const currentTheme = { ...THEME[currentLocation], name: locationNames[currentLocation] };
  const filteredItems = items.filter(item => item.location === currentLocation && (filterCategory === '全部' || item.category === filterCategory));
  const filteredOutfits = outfits.filter(outfit => outfit.location === currentLocation);

  // --- Styles ---
  const polaroidStyle = `bg-white p-2 pb-8 shadow-[2px_3px_5px_rgba(0,0,0,0.1)] rotate-1 hover:rotate-0 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out border border-stone-100 cursor-pointer group`;
  const handButton = `${currentTheme.accentColor} ${currentTheme.textColor} font-bold px-4 py-2 rounded-[255px_15px_225px_15px/15px_225px_15px_255px] border-2 border-transparent hover:border-stone-400 transition-all active:scale-95 shadow-sm`;
  const washiTape = `absolute -top-3 left-1/2 transform -translate-x-1/2 w-16 h-6 ${currentTheme.tapeColor} opacity-80 rotate-[-2deg] z-10`;

  if (!user && loading) return <div className="min-h-screen flex items-center justify-center bg-[#fffdf5] text-stone-400 font-medium tracking-widest"><Loader2 className="animate-spin mr-2" /> 準備手帳中...</div>;

  return (
    // 移除會造成滾動鎖死的 fixed 或 inset-0
    <div className={`min-h-screen font-sans text-stone-600 transition-colors duration-500 pb-32 relative ${currentTheme.bgColor}`}>
      {/* 讓背景固定不跟著滾動 */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#a8a29e 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}></div>
      
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navbar */}
        <div className="bg-white/90 backdrop-blur-sm border-b-2 border-stone-100 border-dashed sticky top-0 safe-area-inset-top z-20 shadow-sm">
          <div className="max-w-md mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-[30%_70%_70%_30%/30%_30%_70%_70%] ${currentTheme.accentColor} border-2 border-stone-200 shadow-sm`}> <Home size={22} className={currentTheme.textColor} strokeWidth={2.5} /> </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-stone-700 flex items-center">雙城手帳</h1>
                  <div className="flex items-center text-xs font-medium text-stone-400 mt-0.5">
                    <MapPin size={10} className="mr-1" />
                    <span>{currentTheme.name}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-stone-100 p-1 rounded-full border border-stone-200">
                  {Object.keys(THEME).map(locId => ( 
                    <button key={locId} onClick={() => setCurrentLocation(locId)} className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-300 ${currentLocation === locId ? 'bg-white shadow-sm text-stone-700' : 'text-stone-400 hover:text-stone-500'}`}> 
                      {locationNames[locId]} 
                    </button> 
                  ))}
                </div>
                <button onClick={() => setShowSettingsModal(true)} className="p-2 bg-white rounded-full border border-stone-200 text-stone-400 hover:text-stone-600 shadow-sm"> <Settings size={20} strokeWidth={2} /> </button>
              </div>
            </div>
            {viewMode === 'wardrobe' && (
              <div className="flex space-x-2 overflow-x-auto pb-2 hide-scrollbar px-1">
                <button onClick={() => setFilterCategory('全部')} className={`flex-shrink-0 px-4 py-1.5 text-xs font-bold transition-all rounded-[10px_5px_15px_5px] ${filterCategory === '全部' ? `${currentTheme.accentColor} ${currentTheme.textColor} border-2 border-transparent` : 'bg-white border-2 border-stone-100 text-stone-500'}`}>全部</button>
                {CATEGORIES.map(cat => ( <button key={cat} onClick={() => setFilterCategory(cat)} className={`flex-shrink-0 px-4 py-1.5 text-xs font-bold transition-all rounded-[10px_5px_15px_5px] ${filterCategory === cat ? `${currentTheme.accentColor} ${currentTheme.textColor} border-2 border-transparent` : 'bg-white border-2 border-stone-100 text-stone-500'}`}>{cat}</button> ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <main className="max-w-md mx-auto p-4 w-full flex-grow">
          {loading ? ( <div className="flex flex-col items-center justify-center py-20"><Loader2 className="animate-spin mb-4 text-stone-300" size={32}/><p className="font-bold text-stone-300">翻開筆記...</p></div> ) : viewMode === 'wardrobe' ? (
            filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className={`w-28 h-28 rounded-full flex items-center justify-center ${currentTheme.accentColor} bg-opacity-50 mb-6 border-2 border-dashed border-stone-300`}> <Scissors size={40} className={currentTheme.textColor} strokeWidth={1.5} /> </div>
                <p className="font-bold text-lg text-stone-600 mb-2">這裡還是空白頁</p>
                <p className="text-sm text-stone-400 mb-8 font-medium">來貼一些衣服的貼紙吧！</p>
                {items.length === 0 && ( <button onClick={loadDemoData} disabled={saving} className={`px-6 py-3 font-bold rounded-2xl bg-white border-2 border-stone-200 shadow-[2px_2px_0px_#e7e5e4] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] transition-all flex items-center text-stone-600`}> <Sparkles className="mr-2 text-yellow-400" size={18}/> 貼上範例貼紙 </button> )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                {filteredItems.map(item => (
                  <div key={item.id} className={polaroidStyle} onClick={() => setEditingItem(item)}>
                    <div className={washiTape}></div>
                    <div className="aspect-[1/1] bg-stone-50 overflow-hidden relative border border-stone-100 mb-2">
                      {item.image ? ( <img src={item.image} alt={item.name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" /> ) : ( <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-300"><Shirt size={32} /></div> )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                        <div className="bg-white/90 p-2 rounded-full shadow-sm text-stone-500"><Edit3 size={16} /></div>
                      </div>
                    </div>
                    <div className="px-1 text-center relative">
                      <div className="text-[10px] font-bold text-stone-400 tracking-wider mb-0.5">{item.category}</div>
                      <h3 className="font-bold text-sm text-stone-700 truncate font-sans">{item.name}</h3>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest('wardrobe_items', item.id); }} className="absolute -bottom-1 -right-1 p-2 text-stone-300 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredOutfits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center"> <div className={`w-24 h-24 rounded-full flex items-center justify-center bg-white border-2 border-dashed border-stone-200 mb-6`}> <PenTool size={40} className="text-stone-300" strokeWidth={1.5} /> </div> <p className="font-bold text-stone-500">還沒有穿搭筆記</p> </div>
            ) : (
              <div className="space-y-6">
                {filteredOutfits.map(outfit => (
                  <div key={outfit.id} className="bg-white p-4 rounded-lg shadow-sm border border-stone-100 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-evenly items-center border-r border-dashed border-stone-100 bg-stone-50/50 rounded-l-lg">{[1,2,3].map(i=><div key={i} className="w-3 h-3 rounded-full bg-stone-200 shadow-inner"></div>)}</div>
                    <div className="pl-10">
                      <div className={`flex justify-between items-start mb-3 border-b-2 border-stone-100 pb-2 border-dashed`}>
                        <h3 className="font-bold text-stone-700 text-lg flex items-center"><span className={`inline-block w-2 h-2 rounded-full mr-2 ${currentTheme.tapeColor}`}></span>{outfit.name}</h3>
                        <button onClick={() => handleDeleteRequest('wardrobe_outfits', outfit.id)} className="text-stone-300 hover:text-red-400 transition-colors"><Trash2 size={18} /></button>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                        {outfit.itemIds.map(itemId => {
                          const item = items.find(i => i.id === itemId); if (!item) return null;
                          return ( <div key={itemId} className="w-16 h-16 flex-shrink-0 bg-white border border-stone-200 p-1 shadow-sm rotate-1 first:rotate-[-2deg]"> <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> </div> );
                        })}
                      </div>
                      <div className="mt-2 text-[10px] font-medium text-right text-stone-400 font-mono">{new Date(outfit.dateAdded).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </main>
      </div>

      <div className="fixed bottom-24 right-6 z-40">
         <button onClick={() => viewMode === 'wardrobe' ? setShowAddModal(true) : setShowOutfitModal(true)} className={`w-16 h-16 flex items-center justify-center rounded-full ${currentTheme.accentColor} border-4 border-white shadow-lg text-stone-700 transition-transform active:scale-95 hover:rotate-12`}> <Plus size={32} strokeWidth={3} /> </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-stone-200 safe-area-inset-bottom z-30 h-16 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-full max-w-md mx-auto">
          <button onClick={() => setViewMode('wardrobe')} className={`group w-1/2 h-full flex flex-col items-center justify-center transition-colors ${viewMode === 'wardrobe' ? 'bg-stone-50' : ''}`}>
            <div className={`mb-1 transition-transform ${viewMode === 'wardrobe' ? 'scale-110 -translate-y-1' : ''}`}><LayoutGrid size={24} strokeWidth={2.5} className={viewMode === 'wardrobe' ? currentTheme.textColor : 'text-stone-300'} /></div><span className={`text-[10px] font-bold ${viewMode === 'wardrobe' ? 'text-stone-600' : 'text-stone-400'}`}>衣櫥</span>
          </button>
          <button onClick={() => setViewMode('outfits')} className={`group w-1/2 h-full flex flex-col items-center justify-center transition-colors ${viewMode === 'outfits' ? 'bg-stone-50' : ''}`}>
            <div className={`mb-1 transition-transform ${viewMode === 'outfits' ? 'scale-110 -translate-y-1' : ''}`}><Layers size={24} strokeWidth={2.5} className={viewMode === 'outfits' ? currentTheme.textColor : 'text-stone-300'} /></div><span className={`text-[10px] font-bold ${viewMode === 'outfits' ? 'text-stone-600' : 'text-stone-400'}`}>搭配</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-white text-stone-600 border border-stone-200 px-6 py-3 shadow-lg rounded-full z-[100] animate-fade-in-up flex items-center font-bold">
          {toast.type === 'error' ? <AlertCircle size={18} className="mr-2 text-red-400"/> : <Check size={18} className="mr-2 text-green-400"/>}
          <span className="text-sm">{toast.message}</span>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/20 backdrop-blur-sm p-6 animate-fade-in">
          <div className="bg-[#fef9c3] w-full max-w-xs shadow-xl p-6 rotate-[-2deg] relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-24 h-8 bg-[#fde047] opacity-60 rotate-2"></div>
            <h3 className="text-lg font-bold mb-4 text-stone-800 text-center font-handwriting">Wait a sec!</h3>
            <p className="text-sm font-medium mb-6 text-stone-700 text-center leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2 font-bold text-stone-500 hover:bg-stone-100 rounded">取消</button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 py-2 font-bold bg-white text-stone-800 border-2 border-stone-800 rounded shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0px_rgba(0,0,0,1)] active:shadow-none transition-all">確定</button>
            </div>
          </div>
        </div>
      )}

      {(showAddModal || editingItem) && (
        <ItemFormModal 
          key={editingItem ? editingItem.id : 'add-new'}
          onClose={() => { setShowAddModal(false); setEditingItem(null); }} 
          onSave={editingItem ? updateItem : addNewItem} 
          defaultLocation={currentLocation} 
          isSaving={saving} 
          theme={currentTheme} 
          handButton={handButton}
          initialItem={editingItem}
          isEditMode={!!editingItem}
          onDelete={() => handleDeleteRequest('wardrobe_items', editingItem?.id)}
          locationNames={locationNames}
        />
      )}
      
      {showOutfitModal && <AddOutfitModal onClose={() => setShowOutfitModal(false)} onSave={addNewOutfit} items={items} location={currentLocation} locationName={currentTheme.name} isSaving={saving} theme={currentTheme} handButton={handButton} />}
      
      {showSettingsModal && (
        <SettingsModal 
          onClose={() => setShowSettingsModal(false)} 
          items={items} outfits={outfits} user={user} db={db} appId={appId} 
          onShowHelp={() => { setShowSettingsModal(false); setShowHelpModal(true); }} 
          showToast={showToast} theme={currentTheme} handButton={handButton}
          locationNames={locationNames} onSaveLocationNames={saveLocationNames} 
        />
      )}
      
      {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} theme={currentTheme} />}
    </div>
  );
}

// --- Components ---

function SettingsModal({ onClose, items, outfits, user, db, appId, onShowHelp, showToast, theme, handButton, locationNames, onSaveLocationNames }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [localNames, setLocalNames] = useState(locationNames); 
  const fileInputRef = useRef(null);

  const handleExport = () => { setIsProcessing(true); try { const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items, outfits }); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); link.download = `wardrobe_backup_${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(link); link.click(); document.body.removeChild(link); showToast('備份下載好囉'); } catch (e) { showToast('怪怪的...', 'error'); } finally { setIsProcessing(false); } };
  const handleImport = async (e) => { const file = e.target.files[0]; if (!file) return; setIsProcessing(true); const reader = new FileReader(); reader.onload = async (event) => { try { const data = JSON.parse(event.target.result); if (!data.items) throw new Error(); const idMap = {}; for (const item of data.items) { const { id, ...d } = item; const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'wardrobe_items'), d); idMap[id] = docRef.id; } if (data.outfits) { for (const outfit of data.outfits) { const { id, ...d } = outfit; if(d.itemIds) d.itemIds = d.itemIds.map(oid => idMap[oid] || oid).filter(i=>i); await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'wardrobe_outfits'), d); } } showToast('匯入完成！'); onClose(); } catch (err) { showToast('格式不對喔', 'error'); } finally { setIsProcessing(false); } }; reader.readAsText(file); };

  const handleSaveNames = () => {
    if (!localNames.taipei.trim() || !localNames.kaohsiung.trim()) {
      showToast('名稱不能空白喔', 'error');
      return;
    }
    onSaveLocationNames(localNames);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-800/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden border-4 border-white">
        <div className={`absolute top-0 left-0 right-0 h-4 ${theme.accentColor}`}></div>
        <div className="p-6 pt-8 flex justify-between items-center bg-stone-50 border-b border-dashed border-stone-200">
          <h2 className="text-xl font-bold text-stone-700 flex items-center"><Settings size={22} className="mr-2 text-stone-400"/>設定與工具</h2>
          <button onClick={onClose} className="p-2 bg-white rounded-full border border-stone-200 text-stone-400 hover:text-stone-600 shadow-sm"><X size={20}/></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-8 bg-white" style={{ backgroundImage: 'linear-gradient(#f5f5f4 1px, transparent 1px)', backgroundSize: '100% 32px' }}>
          
          <div>
            <h3 className="text-xs font-bold text-stone-400 mb-3 uppercase tracking-widest bg-white inline-block px-1 flex items-center"><Map size={14} className="mr-1"/> 自訂地點名稱</h3>
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 space-y-3">
              <div className="flex items-center">
                <span className="text-sm font-bold text-stone-400 w-12 flex-shrink-0">地點1</span>
                <input 
                  type="text" maxLength={6}
                  value={localNames.taipei} 
                  onChange={(e) => setLocalNames({...localNames, taipei: e.target.value})}
                  className="flex-1 p-2 bg-white border-2 border-stone-200 rounded-lg outline-none focus:border-stone-400 font-bold text-stone-700 text-sm"
                />
              </div>
              <div className="flex items-center">
                <span className="text-sm font-bold text-stone-400 w-12 flex-shrink-0">地點2</span>
                <input 
                  type="text" maxLength={6}
                  value={localNames.kaohsiung} 
                  onChange={(e) => setLocalNames({...localNames, kaohsiung: e.target.value})}
                  className="flex-1 p-2 bg-white border-2 border-stone-200 rounded-lg outline-none focus:border-stone-400 font-bold text-stone-700 text-sm"
                />
              </div>
              <div className="pt-2 flex justify-end">
                 <button onClick={handleSaveNames} className={`px-4 py-1.5 rounded-full bg-stone-700 text-white font-bold text-xs shadow-md hover:bg-stone-800 active:scale-95 transition-all`}>儲存新名稱</button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-stone-400 mb-3 uppercase tracking-widest bg-white inline-block px-1">新手教學</h3>
            <button onClick={onShowHelp} className={`w-full flex justify-between p-4 bg-white border-2 border-dashed border-stone-200 rounded-2xl hover:border-stone-400 transition-all group`}>
              <span className="flex items-center text-sm font-bold text-stone-600"><HelpCircle size={18} className="mr-3 text-stone-400"/> 安裝到手機桌面</span>
              <span className="text-stone-300 group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
          
          <div>
            <h3 className="text-xs font-bold text-stone-400 mb-3 uppercase tracking-widest bg-white inline-block px-1">資料搬家</h3>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={handleExport} disabled={isProcessing} className="flex flex-col items-center justify-center p-5 bg-stone-50 rounded-2xl border border-stone-100 hover:shadow-md transition-all active:scale-95">
                {isProcessing ? <Loader2 className="animate-spin mb-2 text-stone-400"/> : <><Download size={28} className="mb-2 text-blue-400"/><span className="text-sm font-bold text-stone-600">打包帶走</span></>}
              </button>
              <button onClick={()=>!isProcessing&&fileInputRef.current?.click()} disabled={isProcessing} className="flex flex-col items-center justify-center p-5 bg-stone-50 rounded-2xl border border-stone-100 hover:shadow-md transition-all active:scale-95">
                {isProcessing ? <Loader2 className="animate-spin mb-2 text-stone-400"/> : <><Upload size={28} className="mb-2 text-green-400"/><span className="text-sm font-bold text-stone-600">搬家匯入</span></>}
              </button>
              <input type="file" ref={fileInputRef} accept=".json" className="hidden" onChange={handleImport}/>
            </div>
          </div>
          <div className="text-center pt-4"><p className="text-[10px] text-stone-300 font-mono">User ID: {user?.uid?.slice(0, 8)}</p></div>
        </div>
      </div>
    </div>
  );
}

function AddOutfitModal({ onClose, onSave, items, location, locationName, isSaving, theme, handButton }) {
  const [name, setName] = useState(''); const [selectedIds, setSelectedIds] = useState([]);
  const locationItems = items.filter(i => i.location === location);
  const toggleSelection = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const handleSubmit = (e) => { e.preventDefault(); if (!name.trim() || selectedIds.length === 0) return; onSave({ id: Date.now().toString(), name, itemIds: selectedIds, location, dateAdded: new Date().toISOString() }); };
  
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-800/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[85vh] h-[80vh] relative border-4 border-white">
        <div className={`absolute top-0 left-0 right-0 h-4 ${theme.accentColor}`}></div>
        <div className="p-6 pt-8 border-b border-dashed border-stone-200 flex justify-between items-center bg-stone-50 flex-shrink-0">
          <div><h2 className="text-xl font-bold text-stone-700">新搭配</h2><p className="text-xs text-stone-500 font-medium mt-1">地點：{locationName}</p></div>
          <button onClick={onClose} className="p-2 bg-white rounded-full border border-stone-200 text-stone-400 hover:text-stone-600 shadow-sm"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-white" style={{ backgroundImage: 'linear-gradient(#f5f5f4 1px, transparent 1px)', backgroundSize: '100% 32px' }}>
          <div className="mb-6">
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 bg-white inline-block px-1">名稱</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：週末野餐..." className="w-full p-4 border-2 border-stone-200 rounded-xl bg-white focus:border-stone-400 focus:ring-0 outline-none transition-all font-bold text-stone-700 placeholder-stone-300"/>
          </div>
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-3 bg-white inline-block px-1">選擇單品 ({selectedIds.length})</label>
          <div className="grid grid-cols-3 gap-3">
            {locationItems.length === 0 ? <div className="col-span-3 text-center text-stone-300 py-10 font-bold border-2 border-dashed border-stone-100 rounded-xl">還沒有貼紙</div> : locationItems.map(item => { 
              const isSelected = selectedIds.includes(item.id); 
              return ( <div key={item.id} onClick={() => toggleSelection(item.id)} className={`aspect-[1/1] rounded-lg overflow-hidden relative cursor-pointer border-4 transition-all duration-200 ${isSelected ? `border-[${theme.textColor}] rotate-[-2deg] scale-95 shadow-md` : 'border-white shadow-sm hover:rotate-1'}`}> <img src={item.image} className="w-full h-full object-cover" /> {isSelected && <div className={`absolute inset-0 ${theme.accentColor} opacity-40 mix-blend-multiply`}></div>} {isSelected && <div className="absolute top-1 right-1 bg-white text-stone-700 rounded-full p-1 shadow-sm"><Check size={14} strokeWidth={3} /></div>} </div> ) 
            })}
          </div>
        </div>
        <div className="p-6 border-t border-dashed border-stone-200 bg-stone-50 flex-shrink-0">
          <button onClick={handleSubmit} disabled={!name || selectedIds.length === 0 || isSaving} className={`w-full ${handButton} justify-center flex`}>{isSaving ? <Loader2 className="animate-spin" /> : '完成筆記'}</button>
        </div>
      </div>
    </div>
  );
}

function ItemFormModal({ onClose, onSave, defaultLocation, isSaving, theme, handButton, initialItem, isEditMode, onDelete, locationNames }) {
  const [name, setName] = useState(''); 
  const [category, setCategory] = useState(CATEGORIES[0]); 
  const [location, setLocation] = useState(defaultLocation); 
  const [image, setImage] = useState(null); 
  const [isProcessing, setIsProcessing] = useState(false); 
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (initialItem) {
      setName(initialItem.name || '');
      setCategory(initialItem.category || CATEGORIES[0]);
      setLocation(initialItem.location || defaultLocation);
      setImage(initialItem.image || null);
    }
  }, [initialItem, defaultLocation]);

  const handleImageChange = (e) => { const file = e.target.files[0]; if (!file) return; setIsProcessing(true); const reader = new FileReader(); reader.onload = (event) => { const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); let width = img.width; let height = img.height; const MAX_SIZE = 600; if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } } canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height); setImage(canvas.toDataURL('image/jpeg', 0.6)); setIsProcessing(false); }; img.src = event.target.result; }; reader.readAsDataURL(file); };
  
  const handleSubmit = (e) => { 
    e.preventDefault(); 
    if (!name.trim()) return; 
    
    const itemData = { 
      name, 
      category, 
      location, 
      image,
    };

    if (isEditMode) {
      onSave({ ...initialItem, ...itemData }); 
    } else {
      onSave({ 
        id: Date.now().toString(), 
        ...itemData, 
        dateAdded: new Date().toISOString() 
      }); 
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-800/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[85vh] relative border-4 border-white">
        <div className={`absolute top-0 left-0 right-0 h-4 ${theme.accentColor}`}></div>
        <div className="p-6 pt-8 border-b border-dashed border-stone-200 flex justify-between items-center bg-stone-50">
          <h2 className="text-xl font-bold text-stone-700">{isEditMode ? '修改貼紙' : '新貼紙'}</h2>
          <button onClick={onClose} className="p-2 bg-white rounded-full border border-stone-200 text-stone-400 hover:text-stone-600 shadow-sm"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 bg-white" style={{ backgroundImage: 'linear-gradient(#f5f5f4 1px, transparent 1px)', backgroundSize: '100% 32px' }}>
          <div className="flex flex-col items-center">
            <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`w-full aspect-[4/3] rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden group ${image ? 'border-transparent shadow-md rotate-1' : 'border-dashed border-stone-300 bg-stone-50 hover:bg-white hover:border-stone-400'}`}>
              {image ? <img src={image} className="w-full h-full object-cover" /> : <div className="text-center p-4"><div className={`bg-white p-3 rounded-full mb-3 inline-block shadow-sm border border-stone-100 ${theme.textColor}`}><Camera size={28} strokeWidth={2.5}/></div><p className="text-stone-400 font-bold text-sm">拍張照</p></div>}
              {image && <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-white font-bold bg-black/50 px-3 py-1 rounded-full text-sm">更換照片</span></div>}
              {isProcessing && <div className="absolute inset-0 bg-white/90 flex items-center justify-center"><span className="animate-pulse font-bold text-stone-400">剪裁中...</span></div>}
            </div>
            <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleImageChange}/>
          </div>
          <div className="space-y-4">
            <div><label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 bg-white inline-block px-1">名稱</label><input type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full p-4 border-2 border-stone-200 rounded-xl bg-white focus:border-stone-400 focus:ring-0 outline-none transition-all font-bold text-stone-700 placeholder-stone-300" placeholder="這件衣服叫..."/></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 bg-white inline-block px-1">分類</label><select value={category} onChange={e=>setCategory(e.target.value)} className="w-full p-4 border-2 border-stone-200 rounded-xl bg-white focus:border-stone-400 outline-none font-bold text-stone-600">{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 bg-white inline-block px-1">位置</label>
                <select value={location} onChange={e=>setLocation(e.target.value)} className="w-full p-4 border-2 border-stone-200 rounded-xl bg-white focus:border-stone-400 outline-none font-bold text-stone-600">
                  {Object.keys(THEME).map(k=><option key={k} value={k}>{locationNames[k]}</option>)}
                </select>
              </div>
            </div>
          </div>
        </form>
        <div className="p-6 border-t border-dashed border-stone-200 bg-stone-50 flex flex-col gap-3">
          <button onClick={handleSubmit} disabled={!name||isProcessing||isSaving} className={`w-full ${handButton} justify-center flex`}>{isSaving ? '處理中...' : (isEditMode ? '修改完成' : '貼上去')}</button>
          
          {isEditMode && (
            <button onClick={onDelete} className="w-full py-2 text-stone-400 hover:text-red-400 font-bold text-sm transition-colors flex items-center justify-center">
              <Trash2 size={16} className="mr-1" /> 撕掉這張貼紙
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function HelpModal({onClose, theme}) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-800/40 backdrop-blur-sm p-4"><div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8 border-4 border-white relative"><div className={`absolute top-0 left-0 right-0 h-4 ${theme.accentColor}`}></div> <div className="text-center mb-6 mt-4"> <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-stone-100 text-stone-500 border-2 border-dashed border-stone-200`}><Paperclip size={32} strokeWidth={2}/></div> <h2 className="text-xl font-bold text-stone-700">釘選到桌面</h2> </div> <p className="text-stone-500 mb-8 text-center leading-relaxed font-medium">想要更方便紀錄嗎？<br/>用瀏覽器的 <span className="bg-stone-100 px-1 py-0.5 rounded text-stone-700 font-bold border border-stone-200">分享</span> 功能<br/>選 <span className="bg-stone-100 px-1 py-0.5 rounded text-stone-700 font-bold border border-stone-200">加入主畫面</span> 就可以囉！</p> <button onClick={onClose} className={`w-full py-3 rounded-xl font-bold text-white shadow-md active:scale-95 transition-all bg-stone-700`}>好喔</button></div></div>; }