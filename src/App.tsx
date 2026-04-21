import * as React from 'react';
import { 
  auth, 
  signInWithGoogle, 
  logout, 
  createDispatch, 
  getRecentDispatches, 
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
  RefreshCw,
  TrendingUp
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

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setLoading(true);
      if (authUser) {
        try {
          const userProfile = await syncUserProfile(authUser);
          setProfile(userProfile);
          if (userProfile.role === 'OPERATOR') setActiveTab('despacho');
          else setActiveTab('inicio');
        } catch (error) {
          console.error("Error syncing profile:", error);
          toast.error("Error de conexión con el servidor");
        }
      } else {
        setProfile(null);
        setActiveTab('inicio');
      }
      setUser(authUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (user) {
      const unsubDispatches = getRecentDispatches(setDispatches);
      const unsubInventory = getInventory(setInventory);
      return () => {
        unsubDispatches();
        unsubInventory();
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
                  onClick={signInWithGoogle} 
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
          {(profile?.role === 'ADMIN' || profile?.role === 'MANAGER' || profile?.role === 'VIEWER') && (
            <NavButton active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} icon={<LayoutDashboard className="w-4 h-4" />} label="Inicio" />
          )}
          {(profile?.role === 'ADMIN' || profile?.role === 'MANAGER' || profile?.role === 'OPERATOR') && (
            <NavButton active={activeTab === 'despacho'} onClick={() => setActiveTab('despacho')} icon={<Truck className="w-4 h-4" />} label="Despachar" />
          )}
          {(profile?.role === 'ADMIN' || profile?.role === 'MANAGER' || profile?.role === 'VIEWER') && (
            <NavButton active={activeTab === 'historial'} onClick={() => setActiveTab('historial')} icon={<History className="w-4 h-4" />} label="Historial" />
          )}
          {(profile?.role === 'ADMIN' || profile?.role === 'MANAGER') && (
            <NavButton active={activeTab === 'inventario'} onClick={() => setActiveTab('inventario')} icon={<Package className="w-4 h-4" />} label="Inventario" />
          )}
          {(profile?.role === 'ADMIN' || profile?.role === 'MANAGER') && (
            <NavButton active={activeTab === 'reportes'} onClick={() => setActiveTab('reportes')} icon={<FileText className="w-4 h-4" />} label="Reportes" />
          )}
          {profile?.role === 'ADMIN' && (
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
            <DispatchForm user={user} dispatches={dispatches} />
          </div>
        )}

        {activeTab === 'historial' && (
          <div className="h-full">
            <HistoryView dispatches={dispatches} />
          </div>
        )}

        {activeTab === 'reportes' && (
          <div className="space-y-8">
            <ReportsCard dispatches={dispatches} />
            <DashboardStats dispatches={dispatches} />
          </div>
        )}

        {activeTab === 'usuarios' && profile?.role === 'ADMIN' && (
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

function DispatchForm({ user, dispatches }: { user: User, dispatches: Dispatch[] }) {
  const [loading, setLoading] = React.useState(false);
  const [isCustomMaterial, setIsCustomMaterial] = React.useState(false);
  
  // Extraer valores únicos para sugerencias
  const suggestedPlates = Array.from(new Set(dispatches.map(d => d.truckPlate))).sort();
  const suggestedDrivers = Array.from(new Set(dispatches.map(d => d.truckDriver))).sort();
  const suggestedDestinations = Array.from(new Set(dispatches.map(d => d.destination))).sort();

  const [formData, setFormData] = React.useState({
    truckPlate: '',
    truckDriver: '',
    materialVolume: '14',
    materialType: 'Base Estabilizada',
    customMaterialType: '',
    destination: '',
    guideNumber: '',
    notes: '',
    photoBase64: ''
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) { // 800KB limit for Base64 in Firestore
      toast.error('La imagen es muy pesada. Intente con una resolución menor.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, photoBase64: reader.result as string });
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
      const dispatchData = {
        date: new Date(),
        truckPlate: formData.truckPlate.trim().toUpperCase(),
        truckDriver: formData.truckDriver.trim(),
        materialVolume: volume,
        materialType: materialType.trim(),
        destination: formData.destination.trim() || 'No especificado',
        guideNumber: formData.guideNumber.trim() || 'N/A',
        notes: formData.notes.trim() || '',
        photoUrl: formData.photoBase64 || undefined,
        creatorId: user.uid,
        creatorName: user.displayName || user.email || 'Usuario'
      };

      await createDispatch(dispatchData);
      
      toast.success('Guía de despacho registrada correctamente');
      
      setFormData({ 
        truckPlate: '', 
        truckDriver: '', 
        materialVolume: '14', 
        materialType: 'Base Estabilizada', 
        customMaterialType: '',
        destination: '',
        guideNumber: '',
        notes: '',
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
              placeholder="0001" 
              value={formData.guideNumber}
              onChange={e => setFormData({ ...formData, guideNumber: e.target.value })}
              className="bg-zinc-50 border-zinc-200 rounded-xl h-12 sm:h-14 text-base sm:text-lg font-bold focus:ring-amber-500 focus:border-amber-500 px-4 sm:px-5"
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

function HistoryView({ dispatches }: { dispatches: Dispatch[] }) {
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const filteredDispatches = dispatches.filter(d => 
    d.truckPlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.truckDriver.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.materialType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.destination.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-zinc-200 shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-zinc-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-50/10 shrink-0">
        <div>
          <h3 className="text-[10px] sm:text-xs font-black text-zinc-800 uppercase tracking-[0.2em]">Registro Histórico</h3>
          <p className="text-[8px] sm:text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Últimos movimientos</p>
        </div>
        <div className="w-full sm:w-64 relative">
          <Input 
            placeholder="Buscar patente, chofer..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-9 text-xs border-zinc-200 rounded-xl pl-3 w-full"
          />
        </div>
      </div>
      <div className="flex-1 overflow-x-auto pb-4">
        <Table className="min-w-[600px] sm:min-w-0">
          <TableHeader className="bg-white sticky top-0 z-10">
            <TableRow className="border-none hover:bg-transparent">
              <TableHead className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-4 sm:px-6 h-10">Hora / Guía</TableHead>
              <TableHead className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-4 sm:px-6 h-10">Unidad</TableHead>
              <TableHead className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-4 sm:px-6 h-10">Detalles</TableHead>
              <TableHead className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-4 sm:px-6 h-10 text-right">Volumen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDispatches.map((dispatch) => (
              <TableRow key={dispatch.id} className="hover:bg-zinc-50 border-b border-zinc-50 transition-colors">
                <TableCell className="px-4 sm:px-6 py-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-bold text-zinc-500">{format(dispatch.date, "HH:mm")}</span>
                    <span className="text-[8px] font-black text-zinc-300 uppercase tracking-tighter">ID: {dispatch.guideNumber}</span>
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
                  </div>
                </TableCell>
                <TableCell className="px-4 sm:px-6 py-3 text-right">
                  <span className="text-sm font-black text-amber-600">{dispatch.materialVolume.toFixed(1)} <span className="text-[8px] text-zinc-300">m³</span></span>
                </TableCell>
              </TableRow>
            ))}
            {filteredDispatches.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center text-xs text-zinc-400 italic">No se encontraron registros para mostrar en el historial.</TableCell>
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

  return (
    <div className="space-y-6">
      <div className="bg-zinc-950 p-6 sm:p-8 rounded-2xl sm:rounded-3xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">Administración de Jerarquías</h2>
          <p className="text-zinc-500 text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] max-w-md">Define quiénes pueden registrar metros, visualizar datos o generar informes.</p>
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
        d.guideNumber
      ]);

      autoTable(doc, {
        head: [['Fecha', 'Patente', 'Chofer', 'm3', 'Material', 'Destino', 'Guía']],
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
