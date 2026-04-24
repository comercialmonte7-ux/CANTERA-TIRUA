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

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined);

if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    console.warn('Persistencia offline no disponible:', err.code);
  });
}

// Validación de Conexión
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('✅ [Firebase] Conexión establecida.');
  } catch (error: any) {
    if (error.code === 'permission-denied') return;
    console.error("Firebase Connection Error:", error.code);
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
  observations?: string;
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
  const counterRef = doc(db, 'counters', 'guides');

  // USAR GUIONES BAJOS PARA CONSISTENCIA CON SEED
  const inventoryId = dispatchData.materialType.toLowerCase().replace(/ /g, '_');
  const inventoryRef = doc(db, 'inventory', inventoryId);

  return runTransaction(db, async (transaction) => {
    // 1. Obtener y actualizar el contador secuencial
    const counterSnap = await transaction.get(counterRef);
    let nextNumber = 1001; // Valor inicial por defecto
    
    if (counterSnap.exists()) {
      nextNumber = (counterSnap.data().lastNumber || 1000) + 1;
      transaction.update(counterRef, { lastNumber: nextNumber });
    } else {
      transaction.set(counterRef, { lastNumber: nextNumber });
    }

    // Usar el número generado si no viene uno válido
    const guideNumber = (dispatchData.guideNumber && dispatchData.guideNumber !== 'N/A' && dispatchData.guideNumber !== '') 
      ? dispatchData.guideNumber 
      : nextNumber.toString();

    // 2. Gestionar Inventario
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

    // 3. Preparar datos finales
    const finalData = Object.entries(dispatchData)
      .reduce((acc, [key, value]) => {
        if (value !== undefined) acc[key] = value;
        return acc;
      }, { 
        createdAt: serverTimestamp(),
        guideNumber // Sobrescribir con el generado o el manual validado
      } as any);

    transaction.set(dispatchRef, finalData);
    
    return { dispatchId: dispatchRef.id, guideNumber };
  });
};

export const getInventory = (callback: (inventory: Inventory[]) => void) => {
  return onSnapshot(collection(db, 'inventory'), (snapshot) => {
    if (snapshot.empty) {
      const defaultMaterials = ['Base Estabilizada', 'Grava 3/4', 'Gravilla', 'Arena de Planta', 'Integral'];
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
  return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
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
    }).catch(e => console.warn("Admin sync error:", e));

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
    new Promise<UserProfile>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 6000))
  ]).catch(() => ({
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    role: 'UNAUTHORIZED' as const
  }));
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
  // Buscamos si ya existe por email
  const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    const userDoc = snap.docs[0];
    return updateDoc(doc(db, 'users', userDoc.id), { role });
  } else {
    // Si no existe, creamos un perfil preliminar usando el email como ID temporal o generamos uno
    // En Firestore, es mejor crear un documento con un ID generado si no tenemos el UID
    const newUserRef = doc(collection(db, 'users'));
    return setDoc(newUserRef, {
      uid: newUserRef.id,
      email,
      displayName: 'Invitado',
      role,
      createdAt: serverTimestamp(),
    });
  }
};

export const deleteUser = async (uid: string) => {
  const docRef = doc(db, 'users', uid);
  return updateDoc(docRef, { role: 'UNAUTHORIZED' });
};

export const deleteDispatch = async (dispatchId: string) => {
  const dispatchRef = doc(db, 'dispatches', dispatchId);
  
  return runTransaction(db, async (transaction) => {
    const dispatchSnap = await transaction.get(dispatchRef);
    if (!dispatchSnap.exists()) throw new Error('Despacho no encontrado');
    
    const dispatchData = dispatchSnap.data();
    const inventoryId = (dispatchData.materialType as string).toLowerCase().replace(/ /g, '_');
    const inventoryRef = doc(db, 'inventory', inventoryId);
    
    const inventorySnap = await transaction.get(inventoryRef);
    if (inventorySnap.exists()) {
      const currentStock = inventorySnap.data().currentStock;
      transaction.update(inventoryRef, {
        currentStock: currentStock + dispatchData.materialVolume,
        updatedAt: serverTimestamp()
      });
    }
    
    transaction.delete(dispatchRef);
  });
};

export const updateDispatch = async (dispatchId: string, newData: Partial<Dispatch>) => {
  const dispatchRef = doc(db, 'dispatches', dispatchId);
  
  return runTransaction(db, async (transaction) => {
    const dispatchSnap = await transaction.get(dispatchRef);
    if (!dispatchSnap.exists()) throw new Error('Despacho no encontrado');
    
    const oldData = dispatchSnap.data() as Dispatch;
    const oldMaterialId = oldData.materialType.toLowerCase().replace(/ /g, '_');
    const newMaterialId = (newData.materialType || oldData.materialType).toLowerCase().replace(/ /g, '_');
    
    // Si cambió el volumen o el material, ajustamos stock
    if (newData.materialVolume !== undefined || newData.materialType !== undefined) {
      const oldVol = oldData.materialVolume;
      const newVol = newData.materialVolume !== undefined ? newData.materialVolume : oldVol;
      
      if (oldMaterialId === newMaterialId) {
        // Mismo material, solo cambia volumen
        const invRef = doc(db, 'inventory', oldMaterialId);
        const invSnap = await transaction.get(invRef);
        if (invSnap.exists()) {
          const currentStock = invSnap.data().currentStock;
          const diff = oldVol - newVol; 
          transaction.update(invRef, {
            currentStock: currentStock + diff,
            updatedAt: serverTimestamp()
          });
        }
      } else {
        // Cambió el material, revertimos viejo y aplicamos nuevo
        const oldInvRef = doc(db, 'inventory', oldMaterialId);
        const newInvRef = doc(db, 'inventory', newMaterialId);
        
        const oldInvSnap = await transaction.get(oldInvRef);
        if (oldInvSnap.exists()) {
          transaction.update(oldInvRef, {
            currentStock: oldInvSnap.data().currentStock + oldVol,
            updatedAt: serverTimestamp()
          });
        }
        
        const newInvSnap = await transaction.get(newInvRef);
        if (newInvSnap.exists()) {
          transaction.update(newInvRef, {
            currentStock: newInvSnap.data().currentStock - newVol,
            updatedAt: serverTimestamp()
          });
        }
      }
    }
    
    const cleanUpdate = Object.entries(newData).reduce((acc, [key, value]) => {
      if (value !== undefined) acc[key] = value;
      return acc;
    }, {} as any);
    
    transaction.update(dispatchRef, cleanUpdate);
  });
};

export const getRegistrySuggestions = (callback: (suggestions: { plates: string[], drivers: string[], destinations: string[] }) => void) => {
  const q = query(collection(db, 'dispatches'), orderBy('createdAt', 'desc'), limit(300));
  return onSnapshot(q, (snapshot) => {
    const plates = new Set<string>();
    const drivers = new Set<string>();
    const destinations = new Set<string>();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.truckPlate) plates.add(data.truckPlate.toUpperCase());
      if (data.truckDriver) drivers.add(data.truckDriver);
      if (data.destination) destinations.add(data.destination);
    });
    
    callback({
      plates: Array.from(plates).sort(),
      drivers: Array.from(drivers).sort(),
      destinations: Array.from(destinations).sort()
    });
  });
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
