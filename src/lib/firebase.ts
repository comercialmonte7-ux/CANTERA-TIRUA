import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { 
  initializeFirestore, 
  collection, 
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
  runTransaction,
  enableIndexedDbPersistence,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Inicialización Robusta de Firestore con fallback a Long Polling para evitar errores 'unavailable'
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined);

// Habilitar Persistencia Offline para velocidad
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    console.warn('Persistencia offline no disponible:', err.code);
  });
}

// Validación de Conexión a Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('✅ [Firebase] Conexión establecida con éxito.');
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.warn("⚠️ Conexión Activa: Permisos restringidos (normal).");
      return;
    }
    
    if (error.code === 'unavailable' || error.code === 'failed-precondition') {
      console.error(
        "❌ [Firebase] ERROR DE CONEXIÓN.\n\n" +
        "1. Revisa que Firestore esté en 'Modo Nativo' en tu consola.\n" +
        "2. Asegúrate de que las reglas de seguridad estén publicadas.\n" +
        "3. Verifica que la API Key sea la correcta."
      );
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
  photoUrl?: string; 
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

export const createDispatch = async (dispatchData: Omit<Dispatch, 'id' | 'createdAt'>) => {
  const dispatchRef = doc(collection(db, 'dispatches'));
  const inventoryId = dispatchData.materialType.toLowerCase().replace(/\s+/g, '-');
  const inventoryRef = doc(db, 'inventory', inventoryId);

  return runTransaction(db, async (transaction) => {
    const inventoryDoc = await transaction.get(inventoryRef);
    
    if (inventoryDoc.exists()) {
      const currentStock = inventoryDoc.data().currentStock;
      transaction.update(inventoryRef, {
        currentStock: currentStock - dispatchData.materialVolume,
        updatedAt: serverTimestamp()
      });
    } else {
      transaction.set(inventoryRef, {
        materialType: dispatchData.materialType,
        currentStock: -dispatchData.materialVolume,
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
    if (snapshot.empty) {
      const defaultMaterials = [
        'Base Estabilizada',
        'Grava 3/4',
        'Gravilla',
        'Arena de Planta',
        'Integral'
      ];
      defaultMaterials.forEach(async (mat) => {
        const id = mat.toLowerCase().replace(/ /g, '_');
        await setDoc(doc(db, 'inventory', id), {
          materialType: mat,
          currentStock: 0,
          unit: 'm3',
          updatedAt: serverTimestamp()
        });
      });
    }

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
  
  if (user.email === 'mari.ricardo@gmail.com') {
    getDoc(docRef).then(async (snap) => {
      if (!snap.exists()) {
        await setDoc(docRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          role: 'ADMIN',
          createdAt: serverTimestamp(),
        });
      } else if (snap.data()?.role !== 'ADMIN') {
        await updateDoc(docRef, { role: 'ADMIN' });
      }
    }).catch(e => console.warn("Sync ADMIN background error:", e));

    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      role: 'ADMIN' as const,
    };
  }

  const fetchProfile = async (): Promise<UserProfile> => {
    const qEmail = query(collection(db, 'users'), where('email', '==', user.email), limit(1));
    const emailSnap = await getDocs(qEmail);

    if (!emailSnap.empty) {
      const existingDoc = emailSnap.docs[0];
      const data = existingDoc.data() as UserProfile;
      
      if (existingDoc.id !== user.uid) {
        const userData = { ...data, uid: user.uid, updatedAt: serverTimestamp() };
        await setDoc(docRef, userData);
        return userData;
      }
      return data;
    }

    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return docSnap.data() as UserProfile;

    const qCount = query(collection(db, 'users'), limit(1));
    const countSnap = await getDocs(qCount);
    const role: UserProfile['role'] = countSnap.empty ? 'ADMIN' : 'UNAUTHORIZED';

    const newUser: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      role,
      createdAt: serverTimestamp(),
    };
    await setDoc(docRef, newUser);
    return newUser;
  };

  return Promise.race([
    fetchProfile(),
    new Promise<UserProfile>((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT_SYNC')), 6000)
    )
  ]).catch(err => {
    console.error("Sync Error or Timeout:", err);
    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      role: 'UNAUTHORIZED' as const
    };
  });
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

export const preAuthorizeUser = async (email: string, role: UserProfile['role']) => {
  const cleanEmail = email.toLowerCase().trim();
  const inviteId = `invite_${cleanEmail.replace(/[.@]/g, '_')}`;
  const docRef = doc(db, 'users', inviteId);
  
  const q = query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1));
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    const userDoc = snap.docs[0];
    return updateDoc(doc(db, 'users', userDoc.id), { role });
  }

  return setDoc(docRef, {
    uid: inviteId,
    email: cleanEmail,
    displayName: 'Usuario Invitado',
    role: role,
    createdAt: serverTimestamp(),
    isInvited: true
  });
};

export const deleteUser = async (uid: string) => {
  const docRef = doc(db, 'users', uid);
  return updateDoc(docRef, { role: 'UNAUTHORIZED' }); 
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
