import * as React from 'react';
import { 
  auth, 
  signInWithGoogle, 
  logout, 
  createDispatch, 
  getRecentDispatches, 
  getRegistrySuggestions,
  updateDispatch,
  deleteDispatch,
  repairGuides,
  Dispatch,
  UserProfile,
  syncUserProfile,
  getAllUserProfiles,
  updateUserRole
} from './lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';
import { 
  Truck, 
  PlusCircle, 
  BarChart3, 
  History, 
  LogOut, 
  ChevronRight, 
  Calendar as CalendarIcon,
  HardHat,
  Mountain,
  ChevronLeft,
  Users,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  LayoutDashboard,
  FileText,
  Camera,
  Package,
  Trash2,
  Edit,
  X,
  RefreshCw,
  TrendingUp,
  Copy
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { Badge } from './components/ui/badge';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { format, startOfDay, endOfDay, isWithinInterval, subDays, startOfMonth, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { getInventory, updateInventoryStock, Inventory } from './lib/firebase';

export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [dispatches, setDispatches] = React.useState<Dispatch[]>([]);
  const [inventory, setInventory] = React.useState<Inventory[]>([]);
  const [activeTab, setActiveTab] = React.useState('inicio');
  const [suggestions, setSuggestions] = React.useState({ plates: [], drivers: [], destinations: [] });
  const [editingDispatch, setEditingDispatch] = React.useState<Dispatch | null>(null);

  const formattedDate = React.useMemo(() => format(new Date(), "EEEE, d 'de' MMMM", { locale: es }), []);

  const handleLogout = async () => {
    try {
      await logout();
      setProfile(null);
      setUser(null);
      setActiveTab('inicio');
      toast.info('Sesión finalizada');
    } catch (error) {
      toast.error('Error al cerrar sesión');
    }
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Login detail:", error);
      if (error.code === 'auth/unauthorized-domain') {
        toast.error('Error: Dominio no autorizado en Firebase.', { duration: 8000 });
        console.error("COPIE Y PEGUE ESTOS DOMINIOS EN 'Authentication > Settings > Authorized domains' EN FIREBASE CONSOLE:");
        console.log("- " + window.location.hostname);
        console.log("- ais-dev-he3vkjaxmigjtowenqz7ls-607323100315.us-east1.run.app");
        console.log("- ais-pre-he3vkjaxmigjtowenqz7ls-607323100315.us-east1.run.app");
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('Ventana emergente bloqueada. Por favor, permita popups.');
      } else {
        toast.error('Error al iniciar sesión: ' + (error.message || 'Error desconocido'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Intentar recuperación rápida de sesión si existe
  React.useEffect(() => {
    const cachedUser = auth.currentUser;
    if (cachedUser && cachedUser.email === 'mari.ricardo@gmail.com') {
      setUser(cachedUser);
      setProfile({
        uid: cachedUser.uid,
        email: cachedUser.email,
        displayName: cachedUser.displayName || 'Administrador',
        role: 'ADMIN'
      });
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      // Prioridad: Si es el administrador, desbloquear UI de inmediato
      if (authUser && authUser.email === 'mari.ricardo@gmail.com') {
        setUser(authUser);
        setProfile({
          uid: authUser.uid,
          email: authUser.email,
          displayName: authUser.displayName || 'Administrador',
          role: 'ADMIN'
        });
        setActiveTab('inicio');
        setLoading(false);
        // Sincronizar en segundo plano sin bloquear
        syncUserProfile(authUser).then(setProfile).catch(console.error);
      } else if (authUser) {
        setLoading(true);
        try {
          const userProfile = await syncUserProfile(authUser);
          setProfile(userProfile);
          if (userProfile.role === 'OPERATOR') setActiveTab('despacho');
          else setActiveTab('inicio');
          setUser(authUser);
        } catch (error) {
          console.error("Error syncing profile:", error);
          toast.error("Error de conexión. Reintentando...");
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setActiveTab('inicio');
        setLoading(false);
      }
      
      // Eliminar el loader estático una vez que React está listo
      const loader = document.getElementById('initial-loader');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
      }
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (user) {
      const unsubDispatches = getRecentDispatches(setDispatches);
      const unsubInventory = getInventory(setInventory);
      const unsubSuggestions = getRegistrySuggestions(setSuggestions);
      return () => {
        unsubDispatches();
        unsubInventory();
        unsubSuggestions();
      };
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50">
        <div className="animate-pulse flex flex-col items-center">
          <Mountain className="w-12 h-12 text-amber-600 mb-4" />
          <p className="text-zinc-500 font-medium uppercase tracking-[0.2em] text-xs">Cargando Sistema...</p>
        </div>
      </div>
    );
  }

  if (!user || profile?.role === 'UNAUTHORIZED') {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2rem] shadow-2xl border border-zinc-200 overflow-hidden">
          <div className={`${profile?.role === 'UNAUTHORIZED' ? 'bg-zinc-900' : 'bg-amber-600'} p-10 flex flex-col items-center text-white transition-colors duration-500`}>
            <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm border border-white/20">
              {profile?.role === 'UNAUTHORIZED' ? <ShieldAlert className="w-12 h-12 text-amber-500 animate-pulse" /> : <Mountain className="w-12 h-12" />}
            </div>
            <h1 className="text-3xl font-black font-sans tracking-tight">
              {profile?.role === 'UNAUTHORIZED' ? 'Acceso Pendiente' : 'Cantera Tirúa'}
            </h1>
            <p className="text-amber-100 text-center mt-2 font-medium opacity-80 uppercase tracking-widest text-[10px]">
              {profile?.role === 'UNAUTHORIZED' ? 'Validación de Seguridad' : 'Gestión • Control • Reportabilidad'}
            </p>
          </div>
          <div className="p-10">
            {profile?.role === 'UNAUTHORIZED' ? (
              <div className="flex flex-col items-center text-center">
                <p className="text-zinc-600 mb-6 leading-relaxed font-medium">
                  Hola <span className="font-bold text-zinc-900">{user?.displayName}</span>, tu cuenta ha sido registrada pero aún no tienes permisos autorizados.
                </p>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl mb-8">
                  <p className="text-[11px] text-amber-800 font-bold leading-tight">
                    Contacta al administrador para que valide tu identidad y asigne tu jerarquía en el sistema.
                  </p>
                </div>
                <Button 
                  variant="outline"
                  onClick={handleLogout} 
                  className="w-full h-12 text-xs font-black uppercase tracking-widest border-zinc-200 rounded-xl hover:bg-zinc-50 flex items-center justify-center gap-2 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar Sesión
                </Button>
              </div>
            ) : (
              <>
                <p className="text-zinc-600 text-center mb-10 leading-relaxed font-medium">
                  Accede al sistema de despacho con tu cuenta corporativa autorizada.
                </p>
                <Button 
                  onClick={handleLogin} 
                  className="w-full h-14 text-base font-bold bg-zinc-950 text-white rounded-2xl hover:bg-zinc-800 flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-lg shadow-zinc-200"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Iniciar Sesión Google
                </Button>
              </>
            )}
          </div>
          <div className="bg-zinc-50 p-4 border-t border-zinc-100 flex justify-center items-center gap-2">
            <HardHat className="w-4 h-4 text-zinc-300" />
            <span className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.25em]">Estación Punto de Control</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex flex-col">
      <header className="bg-white border-b border-zinc-200 px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-black text-sm sm:text-lg shadow-sm">
            CT
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm sm:text-xl font-black tracking-tight text-zinc-800 leading-none">Cantera Tirúa</h1>
            <p className="text-[7px] sm:text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5 sm:mt-1">Gestión de Áridos</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-8">
          <div className="hidden sm:block text-right">
            <p className="text-xs sm:text-sm font-bold text-zinc-800 lowercase first-letter:uppercase">{formattedDate}</p>
            <p className="text-[8px] sm:text-[10px] text-emerald-600 flex items-center justify-end gap-1 sm:gap-1.5 font-black uppercase tracking-wider">
              <span className="w-1.5 h-1.5 sm:w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> {user.email === 'mari.ricardo@gmail.com' ? 'ADMIN' : (profile?.role || 'Visitante')}
            </p>
          </div>
          <div className="h-6 sm:h-8 w-px bg-zinc-200"></div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-right leading-none max-w-[80px] sm:max-w-[150px]">
              <p className="text-[10px] sm:text-sm font-bold text-zinc-900 truncate">{user.displayName || 'Usuario'}</p>
              <p className="text-[7px] sm:text-[10px] text-zinc-400 font-medium truncate">{user.email}</p>
            </div>
            <Button variant="outline" size="icon" onClick={handleLogout} className="rounded-xl border-zinc-200 hover:bg-zinc-100 h-8 w-8 sm:h-10 sm:w-10">
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-500" />
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation (Roles based) */}
      <nav className="bg-white border-b border-zinc-200 px-4 sm:px-8 py-2 overflow-x-auto whitespace-nowrap scrollbar-hide sticky top-[65px] sm:top-[81px] z-40">
        <div className="flex gap-2 sm:gap-4 max-w-7xl mx-auto">
          {(profile?.role === 'ADMIN' || profile?.role === 'MANAGER' || profile?.role === 'VIEWER' || user?.email === 'mari.ricardo@gmail.com') && (
            <NavButton active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} icon={<LayoutDashboard className="w-4 h-4" />} label="Inicio" />
          )}
          {(profile?.role === 'ADMIN' || profile?.role === 'MANAGER' || profile?.role === 'OPERATOR' || user?.email === 'mari.ricardo@gmail.com') && (
            <NavButton active={activeTab === 'despacho'} onClick={() => setActiveTab('despacho')} icon={<Truck className="w-4 h-4" />} label="Despachar" />
          )}
          {(profile?.role === 'ADMIN' || profile?.role === 'MANAGER' || profile?.role === 'VIEWER' || user?.email === 'mari.ricardo@gmail.com') && (
            <NavButton active={activeTab === 'historial'} onClick={() => setActiveTab('historial')} icon={<History className="w-4 h-4" />} label="Historial" />
          )}
          {(profile?.role === 'ADMIN' || profile?.role === 'MANAGER' || user?.email === 'mari.ricardo@gmail.com') && (
            <NavButton active={activeTab === 'inventario'} onClick={() => setActiveTab('inventario')} icon={<Package className="w-4 h-4" />} label="Inventario" />
          )}
          {(profile?.role === 'ADMIN' || profile?.role === 'MANAGER' || user?.email === 'mari.ricardo@gmail.com') && (
            <NavButton active={activeTab === 'reportes'} onClick={() => setActiveTab('reportes')} icon={<FileText className="w-4 h-4" />} label="Reportes" />
          )}
          {(profile?.role === 'ADMIN' || user?.email === 'mari.ricardo@gmail.com') && (
            <NavButton active={activeTab === 'usuarios'} onClick={() => setActiveTab('usuarios')} icon={<Users className="w-4 h-4" />} label="Usuarios" />
          )}
        </div>
      </nav>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto w-full flex-1 min-h-0">
        {activeTab === 'inicio' && (
          <div className="grid grid-cols-12 gap-6">
            <DashboardStats dispatches={dispatches} />
            <div className="col-span-12 lg:col-span-8">
              <ProductionChart dispatches={dispatches} />
            </div>
            <div className="col-span-12 lg:col-span-4">
              <InventoryBrief inventory={inventory} />
            </div>
          </div>
        )}

        {activeTab === 'inventario' && (
          <InventoryView inventory={inventory} />
        )}

        {activeTab === 'despacho' && (
          <div className="max-w-3xl mx-auto">
            <DispatchForm user={user} suggestions={suggestions} />
          </div>
        )}

        {activeTab === 'historial' && (
          <div className="h-full">
            <HistoryView 
              dispatches={dispatches} 
              isAdmin={profile?.role === 'ADMIN' || user?.email === 'mari.ricardo@gmail.com'} 
              onEdit={setEditingDispatch}
            />
          </div>
        )}

        {activeTab === 'reportes' && (
          <div className="space-y-8">
            <ReportsCard dispatches={dispatches} />
            <DashboardStats dispatches={dispatches} />
          </div>
        )}

        {activeTab === 'usuarios' && (profile?.role === 'ADMIN' || user?.email === 'mari.ricardo@gmail.com') && (
          <UsersView />
        )}
      </main>

      <footer className="bg-zinc-100 border-t border-zinc-200 px-4 sm:px-8 py-4 flex flex-col sm:flex-row justify-between gap-2 items-center">
        <div className="flex items-center gap-3">
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-3 font-black text-[10px]">{profile?.role}</Badge>
          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.25em]">Operador: {user.displayName}</span>
        </div>
        <span className="text-[9px] font-black text-amber-600 uppercase tracking-[0.25em]">v3.1.0 • FORCE_ADMIN_READY • 2026.04.21</span>
      </footer>
      <Toaster position="top-right" richColors />
      {editingDispatch && (
        <EditDispatchModal 
          dispatch={editingDispatch} 
          onClose={() => setEditingDispatch(null)} 
          onUpdate={updateDispatch}
          suggestions={suggestions}
        />
      )}
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 ${
        active 
          ? 'bg-zinc-950 text-white shadow-lg shadow-zinc-200 scale-[1.02] sm:scale-105' 
          : 'bg-transparent text-zinc-400 hover:text-zinc-900'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function DashboardStats({ dispatches }: { dispatches: Dispatch[] }) {
  const today = startOfDay(new Date());
  const dispatchesToday = dispatches.filter(d => d.date >= today);
  const volumeToday = dispatchesToday.reduce((sum, d) => sum + d.materialVolume, 0);
  
  const yesterdayStart = startOfDay(subDays(new Date(), 1));
  const yesterdayEnd = endOfDay(subDays(new Date(), 1));
  const volumeYesterday = dispatches.filter(d => isWithinInterval(d.date, { start: yesterdayStart, end: yesterdayEnd })).reduce((sum, d) => sum + d.materialVolume, 0);

  const percentChange = volumeYesterday > 0 
    ? Math.round(((volumeToday - volumeYesterday) / volumeYesterday) * 100) 
    : 100;

  return (
    <>
      <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white rounded-[1.25rem] sm:rounded-[1.5rem] border border-zinc-200 p-4 sm:p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Volumen Total Hoy</p>
        <div className="mt-2 sm:mt-0">
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tighter">
            {volumeToday.toFixed(1)} <span className="text-base sm:text-lg text-zinc-300 font-black">m³</span>
          </h2>
          <p className={`text-[10px] sm:text-xs font-bold mt-1 ${percentChange >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {percentChange >= 0 ? '↑' : '↓'} {Math.abs(percentChange)}% vs ayer
          </p>
        </div>
      </div>

      <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white rounded-[1.25rem] sm:rounded-[1.5rem] border border-zinc-200 p-4 sm:p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Camiones Despachados</p>
        <div className="mt-2 sm:mt-0">
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tighter">
            {dispatchesToday.length} <span className="text-base sm:text-lg text-zinc-300 font-black">uds</span>
          </h2>
          <p className="text-[9px] sm:text-[10px] text-zinc-400 font-bold uppercase mt-1">
            Promedio {(dispatchesToday.length > 0 ? (volumeToday / dispatchesToday.length).toFixed(1) : "0")} m³ / camión
          </p>
        </div>
      </div>
    </>
  );
}

function DispatchForm({ user, suggestions }: { user: User, suggestions: { plates: string[], drivers: string[], destinations: string[] } }) {
  const [loading, setLoading] = React.useState(false);
  const [isCustomMaterial, setIsCustomMaterial] = React.useState(false);
  
  // Extraer valores únicos para sugerencias
  const suggestedPlates = suggestions.plates;
  const suggestedDrivers = suggestions.drivers;
  const suggestedDestinations = suggestions.destinations;

  const [formData, setFormData] = React.useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    truckPlate: '',
    truckDriver: '',
    materialVolume: '14',
    materialType: 'Base Estabilizada',
    customMaterialType: '',
    destination: '',
    guideNumber: '',
    notes: '',
    observations: '',
    photoBase64: ''
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Redimensionar si es muy grande
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Comprimir a JPEG con calidad 0.6
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        setFormData({ ...formData, photoBase64: compressedBase64 });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const materialType = isCustomMaterial ? formData.customMaterialType : formData.materialType;
    const volume = parseFloat(formData.materialVolume);

    if (!formData.truckPlate || !formData.truckDriver || !materialType) {
      toast.error('Complete la información obligatoria');
      return;
    }

    if (isNaN(volume) || volume <= 0) {
      toast.error('El volumen debe ser un número mayor a 0');
      return;
    }

    setLoading(true);
    try {
      // Combinar fecha y hora seleccionada
      const [year, month, day] = formData.date.split('-').map(Number);
      const [hours, minutes] = formData.time.split(':').map(Number);
      const selectedDate = new Date(year, month - 1, day, hours, minutes);

      const dispatchData: any = {
        date: selectedDate,
        truckPlate: formData.truckPlate.trim().toUpperCase(),
        truckDriver: formData.truckDriver.trim(),
        materialVolume: volume,
        materialType: materialType.trim(),
        destination: formData.destination.trim() || 'No especificado',
        guideNumber: formData.guideNumber.trim(),
        notes: formData.notes.trim() || '',
        observations: formData.observations.trim() || '',
        creatorId: user.uid,
        creatorName: user.displayName || user.email || 'Usuario'
      };

      if (formData.photoBase64) {
        dispatchData.photoUrl = formData.photoBase64;
      }

      const result = await createDispatch(dispatchData);
      
      toast.success(`Guía N° ${result.guideNumber} registrada correctamente`);
      
      setFormData({ 
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        truckPlate: '', 
        truckDriver: '', 
        materialVolume: '14', 
        materialType: 'Base Estabilizada', 
        customMaterialType: '',
        destination: '',
        guideNumber: '',
        notes: '',
        observations: '',
        photoBase64: ''
      });
      setIsCustomMaterial(false);
    } catch (error: any) {
      console.error('Error detallado de registro:', error);
      toast.error('Error al registrar: ' + (error.message || 'Verifique su conexión'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full bg-white rounded-[1.5rem] sm:rounded-[2rem] border-2 border-amber-500 p-6 sm:p-8 shadow-xl shadow-amber-900/5 flex flex-col">
      <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-4 mb-6 sm:mb-10">
        <div className="flex items-center gap-3">
          <div className="bg-amber-600 p-2 sm:p-2.5 rounded-xl text-white shadow-lg shadow-amber-200">
            <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-xl font-black text-zinc-900 tracking-tight">Nueva Guía de Salida</h3>
            <p className="text-[8px] sm:text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Registro Punto de Control</p>
          </div>
        </div>
        <span className="text-[9px] sm:text-[10px] font-black bg-zinc-100 text-zinc-500 px-3 py-1.5 rounded-full tracking-widest border border-zinc-200">
          TURN #{format(new Date(), 'HHmm')}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 sm:gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 text-amber-600">Fecha de Despacho</Label>
              <div className="relative">
                <Input 
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="bg-amber-50 border-amber-200 rounded-xl h-12 sm:h-14 text-sm font-bold focus:ring-amber-500 focus:border-amber-500 [color-scheme:light]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 text-amber-600">Hora de Despacho</Label>
              <Input 
                type="time"
                value={formData.time}
                onChange={e => setFormData({ ...formData, time: e.target.value })}
                className="bg-amber-50 border-amber-200 rounded-xl h-12 sm:h-14 text-sm font-bold focus:ring-amber-500 focus:border-amber-500 [color-scheme:light]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Patente Camión</Label>
            <Input 
              placeholder="ABCD-12" 
              value={formData.truckPlate}
              onChange={e => setFormData({ ...formData, truckPlate: e.target.value })}
              list="plates-list"
              className="bg-zinc-50 border-zinc-200 rounded-xl h-12 sm:h-14 text-lg sm:text-xl font-mono focus:ring-amber-500 focus:border-amber-500 font-bold uppercase"
            />
            <datalist id="plates-list">
              {suggestedPlates.map(plate => <option key={plate} value={plate} />)}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Metros Cúbicos (m³)</Label>
            <Input 
              type="number"
              step="0.1"
              value={formData.materialVolume}
              onChange={e => setFormData({ ...formData, materialVolume: e.target.value })}
              className="bg-zinc-50 border-zinc-200 rounded-xl h-12 sm:h-14 text-lg sm:text-xl font-mono focus:ring-amber-500 focus:border-amber-500 font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nombre del Chofer</Label>
            <Input 
              placeholder="Nombre Completo" 
              value={formData.truckDriver}
              onChange={e => setFormData({ ...formData, truckDriver: e.target.value })}
              list="drivers-list"
              className="bg-zinc-50 border-zinc-200 rounded-xl h-12 sm:h-14 text-base sm:text-lg font-bold focus:ring-amber-500 focus:border-amber-500 px-4 sm:px-5"
            />
            <datalist id="drivers-list">
              {suggestedDrivers.map(driver => <option key={driver} value={driver} />)}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">N° Guía Correlativo</Label>
            <Input 
              placeholder="Automático" 
              value={formData.guideNumber}
              onChange={e => setFormData({ ...formData, guideNumber: e.target.value })}
              className="bg-zinc-50 border-zinc-200 rounded-xl h-12 sm:h-14 text-base sm:text-lg font-bold focus:ring-amber-500 focus:border-amber-500 px-4 sm:px-5 italic"
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Obra / Destino</Label>
            <Input 
              placeholder="Punto de entrega o cliente" 
              value={formData.destination}
              onChange={e => setFormData({ ...formData, destination: e.target.value })}
              list="destinations-list"
              className="bg-zinc-50 border-zinc-200 rounded-xl h-12 sm:h-14 text-base sm:text-lg font-bold focus:ring-amber-500 focus:border-amber-500 px-4 sm:px-5"
            />
            <datalist id="destinations-list">
              {suggestedDestinations.map(dest => <option key={dest} value={dest} />)}
            </datalist>
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <Label className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tipo de Material</Label>
              <button 
                type="button" 
                onClick={() => setIsCustomMaterial(!isCustomMaterial)}
                className="text-[9px] font-black text-amber-600 hover:text-amber-700 uppercase tracking-wider underline underline-offset-2"
              >
                {isCustomMaterial ? "Volver a lista" : "Agregar otro tipo..."}
              </button>
            </div>
            {isCustomMaterial ? (
              <Input 
                placeholder="Especifique tipo de material" 
                value={formData.customMaterialType}
                onChange={e => setFormData({ ...formData, customMaterialType: e.target.value })}
                className="bg-zinc-50 border-zinc-200 rounded-xl h-12 sm:h-14 text-base font-bold focus:ring-amber-500 focus:border-amber-500 px-4 sm:px-5"
              />
            ) : (
              <select 
                value={formData.materialType}
                onChange={e => setFormData({ ...formData, materialType: e.target.value })}
                className="flex h-12 sm:h-14 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 sm:px-5 py-2 text-sm sm:text-base font-bold focus:ring-2 focus:ring-amber-500 outline-none appearance-none cursor-pointer"
              >
                <option>Base Estabilizada</option>
                <option>Arena Gruesa</option>
                <option>Arena Fina</option>
                <option>Grava 3/4</option>
                <option>Integral Rajo</option>
                <option>Base Granular</option>
                <option>Bolón Seleccionado</option>
              </select>
            )}
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Observaciones / Comentarios (Opcional)</Label>
            <Input 
              placeholder="Detalles adicionales, condiciones de entrega, etc." 
              value={formData.observations}
              onChange={e => setFormData({ ...formData, observations: e.target.value })}
              className="bg-zinc-50 border-zinc-200 rounded-xl h-12 sm:h-14 text-base font-bold focus:ring-amber-500 focus:border-amber-500 px-4 sm:px-5"
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Evidencia Fotográfica (Opcional)</Label>
            <div className="flex items-center gap-4">
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleCapture}
              />
              <Button 
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="bg-zinc-50 border-zinc-200 h-14 rounded-xl flex items-center justify-center gap-2 px-6 hover:bg-zinc-100"
              >
                <Camera className="w-5 h-5 text-amber-600" />
                <span className="text-xs font-bold text-zinc-600">Capturar Foto</span>
              </Button>
              
              {formData.photoBase64 && (
                <div className="relative group">
                  <img 
                    src={formData.photoBase64} 
                    alt="Vista previa" 
                    className="w-14 h-14 object-cover rounded-xl border-2 border-amber-500 shadow-md"
                    referrerPolicy="no-referrer"
                  />
                  <button 
                    type="button"
                    onClick={() => setFormData({ ...formData, photoBase64: '' })}
                    className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-md hover:bg-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <Button 
          type="submit" 
          disabled={loading} 
          className="w-full h-14 sm:h-16 mt-4 sm:mt-6 bg-amber-600 text-white rounded-2xl font-black text-base sm:text-lg shadow-xl shadow-amber-200 hover:bg-amber-700 active:scale-[0.98] transition-all uppercase tracking-widest"
        >
          {loading ? 'PROCESANDO...' : 'REGISTRAR SALIDA'}
        </Button>
      </form>
    </div>
  );
}

function EditDispatchModal({ 
  dispatch, 
  onClose, 
  onUpdate, 
  suggestions 
}: { 
  dispatch: Dispatch, 
  onClose: () => void, 
  onUpdate: (id: string, data: Partial<Dispatch>) => void,
  suggestions: { plates: string[], drivers: string[], destinations: string[] }
}) {
  const [formData, setFormData] = React.useState({ ...dispatch });
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatch.id) return;
    setLoading(true);
    try {
      await onUpdate(dispatch.id, formData);
      toast.success('Despacho actualizado correctamente');
      onClose();
    } catch (error) {
      toast.error('Error al actualizar despacho');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async () => {
    const countStr = window.prompt('¿Cuántas veces desea duplicar este despacho? (Mantendrá la misma FECHA y HORA)', '1');
    const count = parseInt(countStr || '0');
    
    if (isNaN(count) || count <= 0) return;
    if (count > 20) {
      toast.error('Por seguridad, solo puede duplicar hasta 20 veces a la vez');
      return;
    }

    setLoading(true);
    const toastId = toast.loading(`Duplicando despacho ${count} veces...`);
    
    try {
      // Mantenemos createdAt para conservar fecha/hora
      // Eliminamos id y guideNumber para nuevos correlativos
      const { id, guideNumber, ...baseData } = formData;
      
      for (let i = 0; i < count; i++) {
        await createDispatch(baseData);
      }
      
      toast.success(`${count} despachos duplicados correctamente`, { id: toastId });
      onClose();
    } catch (error) {
      console.error('Error duplicando:', error);
      toast.error('Error al duplicar despachos', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Editar Guía de Salida</CardTitle>
            <CardDescription>Modifica los datos de la guía #{dispatch.guideNumber}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={loading}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Patente del Camión</Label>
                <Input 
                  value={formData.truckPlate} 
                  onChange={e => setFormData({...formData, truckPlate: e.target.value.toUpperCase()})}
                  list="edit-plates"
                  required
                />
                <datalist id="edit-plates">
                  {suggestions.plates.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Nombre del Chofer</Label>
                <Input 
                  value={formData.truckDriver} 
                  onChange={e => setFormData({...formData, truckDriver: e.target.value})}
                  list="edit-drivers"
                  required
                />
                <datalist id="edit-drivers">
                  {suggestions.drivers.map(d => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Volumen (m³)</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formData.materialVolume} 
                  onChange={e => setFormData({...formData, materialVolume: Number(e.target.value)})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Destino</Label>
                <Input 
                  value={formData.destination} 
                  onChange={e => setFormData({...formData, destination: e.target.value})}
                  list="edit-destinations"
                  required
                />
                <datalist id="edit-destinations">
                  {suggestions.destinations.map(d => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Número de Guía</Label>
                <Input 
                  value={formData.guideNumber} 
                  onChange={e => setFormData({...formData, guideNumber: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observaciones (Opcional)</Label>
              <Input 
                value={formData.observations || ''} 
                onChange={e => setFormData({...formData, observations: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input 
                value={formData.notes || ''} 
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleDuplicate} 
              disabled={loading}
              className="text-amber-600 border-amber-200 hover:bg-amber-50"
            >
              <Copy className="mr-2 h-4 w-4" />
              Duplicar X veces
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Guardar Cambios
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function HistoryView({ 
  dispatches, 
  isAdmin = false, 
  onEdit 
}: { 
  dispatches: Dispatch[], 
  isAdmin?: boolean,
  onEdit?: (dispatch: Dispatch) => void
}) {
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const filteredDispatches = dispatches.filter(d => 
    d.truckPlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.truckDriver.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.materialType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.guideNumber && d.guideNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este despacho? El stock será devuelto al inventario.')) return;
    try {
      await deleteDispatch(id);
      toast.success('Despacho eliminado correctamente');
    } catch (error) {
      toast.error('Error al eliminar despacho');
    }
  };

  const handleDuplicate = async (dispatch: Dispatch) => {
    const countStr = window.prompt('¿Cuántas veces desea duplicar este despacho? (Mantendrá la misma FECHA y HORA)', '1');
    const count = parseInt(countStr || '0');
    
    if (isNaN(count) || count <= 0) return;
    if (count > 20) {
      toast.error('Por seguridad, solo puede duplicar hasta 20 veces a la vez');
      return;
    }

    const toastId = toast.loading(`Duplicando despacho ${count} veces...`);
    
    try {
      // Preparar data base del despacho a duplicar
      // Mantenemos createdAt para conservar la misma fecha/hora
      // Eliminamos id y guideNumber para que se generen nuevos
      const { id, guideNumber, ...baseData } = dispatch;
      
      // Realizar duplicaciones secuencialmente para asegurar correlativos correctos
      for (let i = 0; i < count; i++) {
        await createDispatch(baseData);
      }
      
      toast.success(`${count} despachos duplicados correctamente`, { id: toastId });
    } catch (error) {
      console.error('Error duplicando:', error);
      toast.error('Error al duplicar despachos', { id: toastId });
    }
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-zinc-200 shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-zinc-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-50/10 shrink-0">
        <div>
          <h3 className="text-[10px] sm:text-xs font-black text-zinc-800 uppercase tracking-[0.2em]">Registro Histórico</h3>
          <p className="text-[8px] sm:text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Últimos movimientos</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isAdmin && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 px-3 text-[9px] font-black uppercase tracking-widest border-amber-200 text-amber-600 hover:bg-amber-50"
              onClick={async () => {
                if (window.confirm('¿Seguro que desea reparar las guías S/N? Se numerarán de 001 en adelante según fecha.')) {
                  const count = await repairGuides();
                  toast.success(`${count} guías reparadas`);
                }
              }}
            >
              Reparar Guías S/N
            </Button>
          )}
          <div className="w-full sm:w-64 relative">
            <Input 
              placeholder="Buscar patente, chofer..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-9 text-xs border-zinc-200 rounded-xl pl-3 w-full"
            />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-x-auto pb-4">
        <Table className="min-w-[600px] sm:min-w-0">
          <TableHeader className="bg-white sticky top-0 z-10">
            <TableRow className="border-none hover:bg-transparent">
              <TableHead className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-4 sm:px-6 h-10">Hora / Guía</TableHead>
              <TableHead className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-4 sm:px-6 h-10">Unidad</TableHead>
              <TableHead className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-4 sm:px-6 h-10">Detalles</TableHead>
              <TableHead className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-4 sm:px-6 h-10">Operador</TableHead>
              <TableHead className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-4 sm:px-6 h-10 text-right">Volumen</TableHead>
              {isAdmin && <TableHead className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-4 sm:px-6 h-10 text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDispatches.map((dispatch) => (
              <TableRow key={dispatch.id} className="hover:bg-zinc-50 border-b border-zinc-50 transition-colors">
                <TableCell className="px-4 sm:px-6 py-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-bold text-zinc-500">{format(dispatch.date, "HH:mm")}</span>
                    <span className="text-[9px] font-black text-zinc-700 uppercase tracking-tighter bg-zinc-100 px-1 rounded inline-block w-fit mt-0.5">N° {dispatch.guideNumber}</span>
                  </div>
                </TableCell>
                <TableCell className="px-4 sm:px-6 py-3">
                  <span className="inline-block px-1.5 py-0.5 bg-zinc-900 text-white rounded-md font-mono text-[10px] font-bold tracking-tight shadow-sm uppercase">
                    {dispatch.truckPlate}
                  </span>
                </TableCell>
                <TableCell className="px-4 sm:px-6 py-3">
                  <div className="flex flex-col min-w-[150px]">
                    <div className="flex items-center gap-2">
                       <span className="text-xs font-bold text-zinc-800 truncate">{dispatch.truckDriver}</span>
                       {dispatch.photoUrl && (
                         <div className="group/photo relative">
                           <Camera className="w-3 h-3 text-amber-500" />
                           <div className="hidden group-hover/photo:block absolute left-0 bottom-full mb-2 z-50">
                             <img src={dispatch.photoUrl} className="w-32 h-32 object-cover rounded-lg border-2 border-amber-500 shadow-xl" referrerPolicy="no-referrer" />
                           </div>
                         </div>
                       )}
                    </div>
                    <span className="text-[8px] text-zinc-400 font-black uppercase tracking-widest truncate">{dispatch.materialType}</span>
                    <span className="text-[8px] text-emerald-600 font-bold uppercase truncate">→ {dispatch.destination}</span>
                    {dispatch.observations && (
                      <span className="text-[8px] text-amber-700 italic truncate mt-1 bg-amber-50 px-1 rounded animate-in fade-in slide-in-from-left-1">
                        Obs: {dispatch.observations}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-4 sm:px-6 py-3">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-zinc-600 truncate">{dispatch.creatorName}</span>
                     <span className="text-[8px] text-zinc-400 font-black uppercase tracking-widest">Emisor</span>
                   </div>
                </TableCell>
                <TableCell className="px-4 sm:px-6 py-3 text-right">
                  <span className="text-sm font-black text-amber-600">{dispatch.materialVolume.toFixed(1)} <span className="text-[8px] text-zinc-300">m³</span></span>
                </TableCell>
                {isAdmin && (
                  <TableCell className="px-4 sm:px-6 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-zinc-400 hover:text-amber-600"
                        title="Duplicar Despacho"
                        onClick={() => handleDuplicate(dispatch)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-zinc-400 hover:text-amber-600"
                        onClick={() => onEdit?.(dispatch)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-zinc-400 hover:text-red-600"
                        onClick={() => dispatch.id && handleDelete(dispatch.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filteredDispatches.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="h-40 text-center text-xs text-zinc-400 italic">No se encontraron registros para mostrar en el historial.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function UsersView() {
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [updating, setUpdating] = React.useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<UserProfile['role']>('OPERATOR');
  const [isInviting, setIsInviting] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = getAllUserProfiles(setUsers);
    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (uid: string, newRole: UserProfile['role']) => {
    setUpdating(uid);
    try {
      await updateUserRole(uid, newRole);
      toast.success('Rango actualizado correctamente');
    } catch (error) {
      toast.error('Error al actualizar rango');
    } finally {
      setUpdating(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast.error('Ingrese un correo válido');
      return;
    }

    setIsInviting(true);
    try {
      await import('./lib/firebase').then(m => m.preAuthorizeUser(inviteEmail, inviteRole));
      toast.success(`Usuario ${inviteEmail} pre-autorizado como ${inviteRole}`);
      setInviteEmail('');
    } catch (error) {
      toast.error('Error al pre-autorizar usuario');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-950 p-6 sm:p-8 rounded-2xl sm:rounded-3xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">Administración de Jerarquías</h2>
            <p className="text-zinc-500 text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] max-w-md">Define quiénes pueden registrar metros, visualizar datos o generar informes.</p>
          </div>
          
          <form onSubmit={handleInvite} className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row gap-3">
             <div className="flex-1">
                <Input 
                  placeholder="correo@ejemplo.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 h-10 text-xs rounded-xl text-white"
                />
             </div>
             <select 
               value={inviteRole}
               onChange={e => setInviteRole(e.target.value as any)}
               className="bg-zinc-950 border border-zinc-800 text-white rounded-xl px-3 text-xs font-bold outline-none h-10"
             >
                <option value="VIEWER">VIEWER</option>
                <option value="OPERATOR">OPERATOR</option>
                <option value="MANAGER">MANAGER</option>
                <option value="ADMIN">ADMIN</option>
             </select>
             <Button 
               disabled={isInviting}
               type="submit"
               className="bg-amber-600 hover:bg-amber-500 h-10 rounded-xl px-6 text-[10px] font-black uppercase tracking-wider"
             >
                Autorizar
             </Button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200 shadow-sm overflow-hidden overflow-x-auto pb-4">
        <Table className="min-w-[700px] sm:min-w-0">
          <TableHeader>
            <TableRow className="border-zinc-100 hover:bg-transparent">
              <TableHead className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest px-6 sm:px-8">Usuario</TableHead>
              <TableHead className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest px-6 sm:px-8 text-center">Jerarquía</TableHead>
              <TableHead className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest px-6 sm:px-8">Permisos</TableHead>
              <TableHead className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest px-6 sm:px-8 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.uid} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                <TableCell className="px-6 sm:px-8 py-4 sm:py-6">
                  <div className="flex flex-col">
                    <span className="text-xs sm:text-sm font-bold text-zinc-800">{u.displayName}</span>
                    <span className="text-[10px] text-zinc-400 font-medium lowercase tracking-tight">{u.email}</span>
                  </div>
                </TableCell>
                <TableCell className="px-6 sm:px-8 py-4 sm:py-6 text-center">
                  <Badge variant="outline" className={`font-black text-[8px] sm:text-[9px] border-none px-2 sm:px-3 py-1 ${
                    u.role === 'ADMIN' ? 'bg-zinc-900 text-white' : 
                    u.role === 'MANAGER' ? 'bg-amber-100 text-amber-700' : 
                    u.role === 'OPERATOR' ? 'bg-emerald-100 text-emerald-700' : 
                    u.role === 'VIEWER' ? 'bg-blue-100 text-blue-700' :
                    'bg-zinc-100 text-zinc-400'
                  }`}>
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell className="px-6 sm:px-8 py-4 sm:py-6">
                  <div className="flex flex-wrap gap-1">
                    {u.role === 'ADMIN' && <PermissionBadge label="Todo" icon={<ShieldCheck className="w-2.5 h-2.5" />} color="bg-zinc-100" />}
                    {(u.role === 'ADMIN' || u.role === 'MANAGER' || u.role === 'OPERATOR') && <PermissionBadge label="Agregar Metros" color="bg-emerald-50 text-emerald-600" />}
                    {(u.role === 'ADMIN' || u.role === 'MANAGER' || u.role === 'VIEWER') && <PermissionBadge label="Visualizar" color="bg-blue-50 text-blue-600" />}
                    {(u.role === 'ADMIN' || u.role === 'MANAGER') && <PermissionBadge label="Informes" color="bg-amber-50 text-amber-600" />}
                    {u.role === 'UNAUTHORIZED' && <PermissionBadge label="Ninguno" icon={<ShieldAlert className="w-2.5 h-2.5" />} color="bg-zinc-50 text-zinc-400" />}
                  </div>
                </TableCell>
                <TableCell className="px-6 sm:px-8 py-4 sm:py-6 text-right">
                  <select 
                    value={u.role}
                    disabled={updating === u.uid}
                    onChange={(e) => handleRoleChange(u.uid, e.target.value as any)}
                    className="bg-zinc-50 border border-zinc-200 rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider outline-none cursor-pointer hover:border-amber-500 transition-colors disabled:opacity-50"
                  >
                    <option value="UNAUTHORIZED">PENDIENTE</option>
                    <option value="VIEWER">VIEWER</option>
                    <option value="OPERATOR">OPERATOR</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PermissionBadge({ label, icon, color }: { label: string, icon?: React.ReactNode, color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${color}`}>
      {icon}
      {label}
    </span>
  );
}

function ReportsCard({ dispatches }: { dispatches: Dispatch[] }) {
  const [startDate, setStartDate] = React.useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));

  const getFilteredDispatches = () => {
    const start = startOfDay(new Date(startDate + 'T00:00:00'));
    const end = endOfDay(new Date(endDate + 'T23:59:59'));
    
    return dispatches.filter(d => 
      isWithinInterval(d.date, { start, end })
    );
  };

  const exportToExcel = async () => {
    const filtered = getFilteredDispatches();
    if (filtered.length === 0) {
      toast.error('No hay datos en el rango seleccionado');
      return;
    }

    const toastId = toast.loading('Preparando Excel...');
    try {
      const XLSX = await import('xlsx');
      
      const dataToExport = filtered.map(d => ({
        Fecha: format(d.date, 'dd/MM/yyyy HH:mm'),
        Camion: d.truckPlate,
        Chofer: d.truckDriver,
        Volumen_m3: d.materialVolume,
        Material: d.materialType,
        Destino: d.destination,
        Guia: d.guideNumber,
        Registrado_Por: d.creatorName,
        Observaciones: d.observations || '',
        Notas: d.notes || ''
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Despachos");
      XLSX.writeFile(wb, `Reporte_Tirua_${startDate}_a_${endDate}.xlsx`);
      toast.success('Excel generado correctamente', { id: toastId });
    } catch (error) {
      toast.error('Error al generar Excel', { id: toastId });
    }
  };

  const exportToPDF = async () => {
    const filtered = getFilteredDispatches();
    if (filtered.length === 0) {
      toast.error('No hay datos en el rango seleccionado');
      return;
    }

    const toastId = toast.loading('Preparando PDF...');
    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF();
      const title = "Cantera Tirúa - Reporte de Despachos";
      const range = `Rango: ${format(new Date(startDate + 'T00:00:00'), 'dd/MM/yyyy')} al ${format(new Date(endDate + 'T00:00:00'), 'dd/MM/yyyy')}`;

      doc.setFontSize(18);
      doc.text(title, 14, 22);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(range, 14, 30);

      const body = filtered.map(d => [
        format(d.date, 'dd/MM/yyyy HH:mm'),
        d.truckPlate,
        d.truckDriver,
        d.materialVolume.toString(),
        d.materialType,
        d.destination,
        d.guideNumber,
        d.creatorName,
        d.observations || ''
      ]);

      autoTable(doc, {
        head: [['Fecha', 'Patente', 'Chofer', 'm3', 'Material', 'Destino', 'Guía', 'Operador', 'Obs']],
        body: body,
        startY: 35,
        theme: 'striped',
        headStyles: { fillColor: [180, 83, 9] },
        styles: { fontSize: 8 }
      });

      doc.save(`Reporte_Tirua_${startDate}_a_${endDate}.pdf`);
      toast.success('PDF generado correctamente', { id: toastId });
    } catch (error) {
      toast.error('Error al generar PDF', { id: toastId });
    }
  };

  return (
    <div className="w-full bg-zinc-950 rounded-2xl sm:rounded-[2rem] p-6 sm:p-10 flex flex-col xl:flex-row items-center justify-between shadow-2xl overflow-hidden relative group gap-6 sm:gap-8">
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/5 rounded-full blur-[100px] -mr-32 -mt-32 group-hover:bg-amber-600/10 transition-colors pointer-events-none"></div>
      
      <div className="relative z-10 text-center xl:text-left shrink-0">
        <h3 className="text-white font-black text-lg sm:text-2xl tracking-tight leading-none mb-2 sm:mb-3">Reporte para Gerencia</h3>
        <p className="text-zinc-500 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] max-w-sm">Define el rango temporal para exportar los datos.</p>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6 relative z-10 w-full xl:w-auto">
        <div className="flex items-center gap-2 sm:gap-4 bg-zinc-900/50 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-zinc-800/50 w-full md:w-auto">
          <div className="flex flex-col px-2 sm:px-3 flex-1 min-w-[100px]">
            <label className="text-[8px] sm:text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Desde</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-white text-xs sm:text-sm font-bold outline-none cursor-pointer [color-scheme:dark] w-full"
            />
          </div>
          <div className="w-[1px] h-6 sm:h-8 bg-zinc-800"></div>
          <div className="flex flex-col px-2 sm:px-3 flex-1 min-w-[100px]">
            <label className="text-[8px] sm:text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Hasta</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-white text-xs sm:text-sm font-bold outline-none cursor-pointer [color-scheme:dark] w-full"
            />
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3 w-full md:w-auto mt-2 md:mt-0">
          <button 
            onClick={exportToExcel}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-zinc-900 text-zinc-300 px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all active:scale-95"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            EXCEL
          </button>
          <button 
            onClick={exportToPDF}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-amber-600 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] shadow-lg shadow-amber-900/40 hover:bg-amber-500 active:scale-95 transition-all"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductionChart({ dispatches }: { dispatches: Dispatch[] }) {
  const last7Days = eachDayOfInterval({
    start: subDays(new Date(), 6),
    end: new Date()
  });

  const chartData = last7Days.map(date => {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    
    const dayDispatches = dispatches.filter(d => 
      isWithinInterval(d.date, { start: dayStart, end: dayEnd })
    );

    const totalVolume = dayDispatches.reduce((sum, d) => sum + d.materialVolume, 0);

    return {
      date: format(date, 'dd/MM', { locale: es }),
      volume: totalVolume,
      count: dayDispatches.length
    };
  });

  return (
    <Card className="bg-white rounded-[2rem] border-zinc-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg font-black text-zinc-900 tracking-tight">Tendencia de Producción</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Volumen despachado (m³) - Últimos 7 días</CardDescription>
          </div>
          <div className="bg-emerald-50 text-emerald-700 p-2 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-4">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 800, color: '#18181b' }}
              />
              <Area 
                type="monotone" 
                dataKey="volume" 
                name="Metros Cúbicos"
                stroke="#d97706" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorVolume)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function InventoryBrief({ inventory }: { inventory: Inventory[] }) {
  return (
    <Card className="bg-white rounded-[2rem] border-zinc-200 shadow-sm overflow-hidden h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-black text-zinc-900 tracking-tight">Resumen Stock</CardTitle>
        <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Estado de materiales</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pt-2 overflow-y-auto">
        <div className="space-y-4">
          {inventory.length > 0 ? (
            inventory.slice(0, 6).map(item => (
              <div key={item.id} className="flex justify-between items-center group">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-700 group-hover:text-amber-600 transition-colors uppercase">{item.materialType}</span>
                  <span className="text-[9px] font-black text-zinc-300 uppercase tracking-tighter">Stock Crítico: 150m³</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-black ${item.currentStock < 150 ? 'text-rose-500' : 'text-zinc-900'}`}>
                    {item.currentStock.toFixed(1)}
                  </span>
                  <span className="text-[9px] font-bold text-zinc-300 ml-1">m³</span>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-400">
              <Package className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Sin datos de inventario</p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="bg-zinc-50 border-t border-zinc-100 p-4 shrink-0">
        <div className="w-full flex items-center justify-between">
          <div className="flex gap-1">
             <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
             <div className="w-2 h-2 rounded-full bg-rose-500"></div>
          </div>
          <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Indicadores de Stock</span>
        </div>
      </CardFooter>
    </Card>
  );
}

function InventoryView({ inventory }: { inventory: Inventory[] }) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [newValue, setNewValue] = React.useState('');

  const handleUpdate = async (id: string, type: string) => {
    if (!newValue || isNaN(parseFloat(newValue))) return;
    try {
      await updateInventoryStock(id, type, parseFloat(newValue));
      setEditingId(null);
      setNewValue('');
      toast.success('Stock actualizado');
    } catch (e) {
      toast.error('Error al actualizar stock');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-600 p-8 rounded-3xl text-white relative overflow-hidden shadow-xl shadow-amber-900/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">Gestión de Inventario</h2>
            <p className="text-amber-100 text-xs font-bold uppercase tracking-widest opacity-80">Control de stock real en cantera</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {inventory.map(item => (
          <Card key={item.id} className="bg-white rounded-3xl border-zinc-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 border-b border-zinc-50 bg-zinc-50/50">
              <div className="flex justify-between items-start">
                <CardTitle className="text-sm font-black text-zinc-900 uppercase tracking-tight">{item.materialType}</CardTitle>
                <div className="bg-white p-1 rounded-lg border border-zinc-100 shadow-sm">
                  <RefreshCw className="w-3 h-3 text-zinc-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 pb-8">
              <div className="flex flex-col items-center text-center">
                <div className={`text-5xl font-black mb-2 tracking-tighter ${item.currentStock < 150 ? 'text-rose-500' : 'text-zinc-900'}`}>
                  {item.currentStock.toFixed(1)}
                  <span className="text-xl text-zinc-300 ml-2 font-black uppercase">m³</span>
                </div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Stock Disponible</p>
              </div>
            </CardContent>
            <CardFooter className="bg-zinc-50 border-t border-zinc-100 p-4">
              {editingId === item.id ? (
                <div className="flex gap-2 w-full">
                  <Input 
                    type="number"
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder="Nuevo Valor"
                    className="h-10 text-xs rounded-xl"
                  />
                  <Button onClick={() => handleUpdate(item.id, item.materialType)} className="h-10 px-4 bg-emerald-600 rounded-xl hover:bg-emerald-700">OK</Button>
                  <Button onClick={() => setEditingId(null)} variant="outline" className="h-10 px-4 rounded-xl">X</Button>
                </div>
              ) : (
                <Button 
                  onClick={() => {
                    setEditingId(item.id);
                    setNewValue(item.currentStock.toString());
                  }}
                  variant="outline" 
                  className="w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border-zinc-200 hover:bg-white transition-all"
                >
                  Reiniciar Stock / Ajustar
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
