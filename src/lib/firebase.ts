import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp, 
  Timestamp, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  runTransaction
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Inicialización de Firestore manejando el ID de base de datos
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Validación de Conexión a Firestore (Requerido por protocolo)
import { getDocFromServer } from 'firebase/firestore';
async function testConnection() {
  try {
    // Intentamos leer la ruta de prueba que acabamos de habilitar en las reglas
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('✅ Conexión a Firestore establecida correctamente.');
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.warn("Conexión activa, pero el documento de prueba no existe o está protegido (esto es normal).");
      return;
    }
    
    if (error.message?.includes('the client is offline') || error.code === 'unavailable') {
      console.error("❌ Error de Conexión: El cliente no puede alcanzar Firestore. Posibles causas: 1) Bloqueo de red/Firewall. 2) Credenciales (API Key/Project ID) incorrectas en firebase-applet-config.json. 3) Firestore no está habilitado en este proyecto.");
    } else {
      console.error("Detalle técnico del error de conexión:", error.message || error);
    }
  }
}
testConnection();

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

export interface Dispatch {
  id?: string;
  date: Date;
  truckPlate: string;
  truckDriver: string;
  materialVolume: number;
  materialType: string;
  destination: string;
  guideNumber: string;
  notes?: string;
  photoUrl?: string; // Evidencia fotográfica
  creatorId: string;
  creatorName: string;
  createdAt?: any;
}

export interface Inventory {
  id: string;
  materialType: string;
  currentStock: number;
  unit: string;
  updatedAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER' | 'UNAUTHORIZED';
  createdAt?: any;
}

// Actualizado para manejar inventario mediante transacciones
export const createDispatch = async (dispatchData: Omit<Dispatch, 'id' | 'createdAt'>) => {
  const dispatchRef = doc(collection(db, 'dispatches'));
  const inventoryId = dispatchData.materialType.toLowerCase().replace(/\s+/g, '-');
  const inventoryRef = doc(db, 'inventory', inventoryId);

  return runTransaction(db, async (transaction) => {
    const inventoryDoc = await transaction.get(inventoryRef);
    
    // Si existe el inventario, descontamos. Si no, lo creamos con un valor base (o negativo por ahora si no hay carga inicial)
    if (inventoryDoc.exists()) {
      const currentStock = inventoryDoc.data().currentStock;
      transaction.update(inventoryRef, {
        currentStock: currentStock - dispatchData.materialVolume,
        updatedAt: serverTimestamp()
      });
    } else {
      // Opcional: Crear inventario si no existe (podría iniciarse en 0 o un valor por defecto)
      transaction.set(inventoryRef, {
        materialType: dispatchData.materialType,
        currentStock: -dispatchData.materialVolume, // Empieza en negativo si no hubo carga inicial
        unit: 'm3',
        updatedAt: serverTimestamp()
      });
    }

    transaction.set(dispatchRef, {
      ...dispatchData,
      createdAt: serverTimestamp(),
    });
    
    return dispatchRef.id;
  });
};

export const getInventory = (callback: (inventory: Inventory[]) => void) => {
  return onSnapshot(collection(db, 'inventory'), (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Inventory));
    callback(items);
  });
};

export const updateInventoryStock = async (materialId: string, materialType: string, newStock: number) => {
  const docRef = doc(db, 'inventory', materialId);
  return setDoc(docRef, {
    materialType,
    currentStock: Math.max(0, newStock),
    unit: 'm3',
    updatedAt: serverTimestamp()
  });
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  return null;
};

export const syncUserProfile = async (user: User) => {
  const docRef = doc(db, 'users', user.uid);
  
  // Fast path para el administrador principal
  if (user.email === 'mari.ricardo@gmail.com') {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      const newUser: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        role: 'ADMIN',
        createdAt: serverTimestamp(),
      };
      await setDoc(docRef, newUser);
      return newUser;
    } else {
      const existingProfile = docSnap.data() as UserProfile;
      if (existingProfile.role !== 'ADMIN') {
        await updateDoc(docRef, { role: 'ADMIN' });
        return { ...existingProfile, role: 'ADMIN' };
      }
      return existingProfile;
    }
  }

  // Verificamos si ya existe alguien con este correo (invitado o registrado)
  const qEmail = query(collection(db, 'users'), where('email', '==', user.email), limit(1));
  const emailSnap = await getDocs(qEmail);

  if (!emailSnap.empty) {
    const existingDoc = emailSnap.docs[0];
    const data = existingDoc.data() as UserProfile;
    
    // Si el ID es distinto (era una invitación temporal), migramos los datos al ID real del usuario
    if (existingDoc.id !== user.uid) {
      const userData = {
        ...data,
        uid: user.uid,
        displayName: user.displayName || data.displayName,
        updatedAt: serverTimestamp(),
      };
      // Usamos un setDoc para crear el nuevo y el borrar el anterior es opcional pero ayuda a limpiar
      await setDoc(docRef, userData);
      return userData;
    }
    return data;
  }

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    // Check if we already have an admin (first user becomes admin)
    let role: UserProfile['role'] = 'UNAUTHORIZED';
    
    try {
      // Optimización: Solo intentamos ver si hay AL MENOS un usuario para no cargar toda la colección
      const q = query(collection(db, 'users'), limit(1));
      const usersSnap = await getDocs(q);
      if (usersSnap.empty) role = 'ADMIN';
    } catch (error) {
      console.log('Using default unauthorized role due to restricted list access');
      role = 'UNAUTHORIZED';
    }
    
    const newUser: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      role: role,
      createdAt: serverTimestamp(),
    };
    await setDoc(docRef, newUser);
    return newUser;
  }
  
  return docSnap.data() as UserProfile;
};

export const getAllUserProfiles = (callback: (users: UserProfile[]) => void) => {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const users = snapshot.docs.map(doc => doc.data() as UserProfile);
    callback(users);
  });
};

export const updateUserRole = async (uid: string, role: UserProfile['role']) => {
  const docRef = doc(db, 'users', uid);
  return updateDoc(docRef, { role });
};

// Permite pre-autorizar a un usuario por correo electrónico
export const preAuthorizeUser = async (email: string, role: UserProfile['role']) => {
  // Generamos un ID basado en el email para poder encontrarlo luego si es necesario
  const tempId = `invited_${email.replace(/[.@]/g, '_')}`;
  const docRef = doc(db, 'users', tempId);
  
  // Verificamos si ya existe alguien con ese correo
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    const userDoc = snap.docs[0];
    return updateDoc(doc(db, 'users', userDoc.id), { role });
  }

  return setDoc(docRef, {
    uid: tempId,
    email: email,
    displayName: 'Usuario Invitado',
    role: role,
    createdAt: serverTimestamp(),
    isInvited: true
  });
};

export const deleteUser = async (uid: string) => {
  // Nota: Esto solo borra el perfil en Firestore, no la cuenta en Auth
  const docRef = doc(db, 'users', uid);
  // Por seguridad, los admins no pueden borrarse a sí mismos accidentalmente aquí
  return updateDoc(docRef, { role: 'UNAUTHORIZED' }); // O usar deleteDoc(docRef)
};

export const getRecentDispatches = (callback: (dispatches: Dispatch[]) => void) => {
  const q = query(collection(db, 'dispatches'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
    const dispatches = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate(),
      } as Dispatch;
    });
    callback(dispatches);
  });
};
