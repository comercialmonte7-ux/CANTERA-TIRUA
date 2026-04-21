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
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    // Check if we already have an admin (first user becomes admin)
    let role: UserProfile['role'] = 'UNAUTHORIZED';
    
    // Explicitly set the developer as ADMIN
    if (user.email === 'mari.ricardo@gmail.com') {
      role = 'ADMIN';
    } else {
      try {
        // This will only work if the user is already ADMIN or if rules allow it
        // Since we want the FIRST user to be admin, but rules block list,
        // we handle the error.
        const usersCount = (await getDocs(collection(db, 'users'))).size;
        if (usersCount === 0) role = 'ADMIN';
      } catch (error) {
        // If we can't list, assume we are not the first user or just fall back to UNAUTHORIZED
        console.log('Using default unauthorized role due to restricted list access');
        role = 'UNAUTHORIZED';
      }
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
