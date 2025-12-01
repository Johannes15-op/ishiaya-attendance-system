import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyDh9cwDmEC5UBirud98e2nrSwLPJU27LlM",
    authDomain: "ishiayasgardenbistro-fcafd.firebaseapp.com",
    projectId: "ishiayasgardenbistro-fcafd",
    storageBucket: "ishiayasgardenbistro-fcafd.firebasestorage.app",
    messagingSenderId: "600218357249",
    appId: "1:600218357249:web:79f75bcfd196f12b093a00",
    measurementId: "G-XY6Y8HQHEJ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);

export const USE_FIREBASE = true;

export const localDB = {
    users: [],
    schedules: [],
    attendance: [],
    payroll: [],
    notifications: [],
    employeeSchedules: {}
};

export function saveToLocalStorage(key, data) {
    try {
        if (key && data) {
            localDB[key] = data;
        }
        
        localStorage.setItem('ishiaya_notifications', JSON.stringify(localDB.notifications));
        localStorage.setItem('ishiayaDB', JSON.stringify(localDB));
        
        console.log('✅ Data saved to localStorage');
        console.log('📊 Notifications count:', localDB.notifications.length);
        
        window.dispatchEvent(new CustomEvent('notificationUpdate', { 
            detail: { 
                count: localDB.notifications.length,
                timestamp: Date.now()
            } 
        }));
        
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'ishiaya_notifications',
            newValue: JSON.stringify(localDB.notifications),
            url: window.location.href
        }));
        
        localStorage.setItem('notification_update_timestamp', Date.now().toString());
        
        return true;
    } catch (error) {
        console.error('❌ Error saving to localStorage:', error);
        return false;
    }
}

export function loadFromLocalStorage(key) {
    try {
        const savedNotifications = localStorage.getItem('ishiaya_notifications');
        if (savedNotifications) {
            try {
                localDB.notifications = JSON.parse(savedNotifications);
                if (!Array.isArray(localDB.notifications)) {
                    localDB.notifications = [];
                }
                console.log('✅ Loaded notifications:', localDB.notifications.length);
            } catch (e) {
                console.error('❌ Error parsing notifications, resetting to empty array');
                localDB.notifications = [];
            }
        } else {
            localDB.notifications = [];
        }
        
        const savedData = localStorage.getItem('ishiayaDB');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                
                if (key) {
                    return parsed[key] || localDB[key];
                }
                
                localDB.users = Array.isArray(parsed.users) ? parsed.users : [];
                localDB.schedules = Array.isArray(parsed.schedules) ? parsed.schedules : [];
                localDB.attendance = Array.isArray(parsed.attendance) ? parsed.attendance : [];
                localDB.payroll = Array.isArray(parsed.payroll) ? parsed.payroll : [];
                localDB.employeeSchedules = parsed.employeeSchedules || {};
                
                if (!savedNotifications && parsed.notifications) {
                    localDB.notifications = Array.isArray(parsed.notifications) ? parsed.notifications : [];
                }
                
                return parsed;
            } catch (e) {
                console.error('❌ Error parsing ishiayaDB:', e);
                return key ? localDB[key] : localDB;
            }
        }
        
        return key ? localDB[key] : localDB;
    } catch (error) {
        console.error('❌ Error loading from localStorage:', error);
        localDB.notifications = [];
        return key ? [] : localDB;
    }
}

loadFromLocalStorage();

export async function loginUser(email, password) {
    try {
        if (USE_FIREBASE) {
            console.log('🔐 Attempting Firebase login for:', email);
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const userId = userCredential.user.uid;
            
            console.log('✅ Firebase Auth successful, UID:', userId);
            
            const userDoc = await getDoc(doc(db, 'users', userId));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                console.log('✅ User document found:', userData.name);
                
                if (!userData.hasOwnProperty('profilePicture')) {
                    console.warn('⚠️ profilePicture field missing, adding it now...');
                    try {
                        await updateDoc(doc(db, 'users', userId), {
                            profilePicture: '',
                            updatedAt: new Date().toISOString()
                        });
                        userData.profilePicture = '';
                        console.log('✅ profilePicture field added successfully');
                    } catch (updateError) {
                        console.error('❌ Failed to add profilePicture field:', updateError);
                        userData.profilePicture = '';
                    }
                }
                
                console.log('✅ Login successful:', userData.name);
                return {
                    id: userId,
                    email: userData.email,
                    name: userData.name,
                    role: userData.role,
                    position: userData.position,
                    salary: userData.salary || '',
                    phone: userData.phone || '',
                    address: userData.address || '',
                    department: userData.department || '',
                    profilePicture: userData.profilePicture || '',
                    createdAt: userData.createdAt,
                    updatedAt: userData.updatedAt,
                    status: userData.status || 'active'
                };
            } else {
                console.error('❌ User document not found in Firestore for UID:', userId);
                throw new Error('User not found in database. Please contact the administrator.');
            }
        } else {
            const users = loadFromLocalStorage('users');
            const user = users.find(u => u.email === email && u.password === password);
            
            if (user) {
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    position: user.position || '',
                    salary: user.salary || '',
                    phone: user.phone || '',
                    address: user.address || '',
                    profilePicture: user.profilePicture || user.profilePic || ''
                };
            }
            return null;
        }
    } catch (error) {
        console.error('❌ Login error:', error);
        
        if (error.code === 'auth/user-not-found') {
            throw new Error('No account found with this email address.');
        } else if (error.code === 'auth/wrong-password') {
            throw new Error('Incorrect password. Please try again.');
        } else if (error.code === 'auth/invalid-email') {
            throw new Error('Invalid email address format.');
        } else if (error.code === 'auth/too-many-requests') {
            throw new Error('Too many failed login attempts. Please try again later.');
        } else {
            throw new Error('Login failed: ' + error.message);
        }
    }
}

export async function getAllUsers() {
    if (USE_FIREBASE) {
        const querySnapshot = await getDocs(collection(db, 'users'));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return localDB.users;
}

export async function getAllSchedules() {
    if (USE_FIREBASE) {
        const querySnapshot = await getDocs(collection(db, 'schedules'));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return localDB.schedules;
}

export async function getAllAttendance() {
    if (USE_FIREBASE) {
        const querySnapshot = await getDocs(collection(db, 'attendance'));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return localDB.attendance;
}

export async function addSchedule(scheduleData) {
    if (USE_FIREBASE) {
        const docRef = await addDoc(collection(db, 'schedules'), scheduleData);
        return docRef.id;
    }
    const newId = localDB.schedules.length > 0 ? Math.max(...localDB.schedules.map(s => s.id)) + 1 : 1;
    const newSchedule = { id: newId, ...scheduleData };
    localDB.schedules.push(newSchedule);
    saveToLocalStorage('schedules', localDB.schedules);
    return newId;
}

export async function updateSchedule(scheduleId, scheduleData) {
    if (USE_FIREBASE) {
        await updateDoc(doc(db, 'schedules', scheduleId), scheduleData);
        return;
    }
    const schedule = localDB.schedules.find(s => s.id.toString() === scheduleId.toString());
    if (schedule) {
        Object.assign(schedule, scheduleData);
        saveToLocalStorage('schedules', localDB.schedules);
    }
}

export async function deleteScheduleById(scheduleId) {
    if (USE_FIREBASE) {
        await deleteDoc(doc(db, 'schedules', scheduleId));
        return;
    }
    const index = localDB.schedules.findIndex(s => s.id.toString() === scheduleId.toString());
    if (index > -1) {
        localDB.schedules.splice(index, 1);
        saveToLocalStorage('schedules', localDB.schedules);
    }
}

export async function addAttendance(attendanceData) {
    try {
        if (USE_FIREBASE) {
            const docRef = await addDoc(collection(db, 'attendance'), attendanceData);
            console.log('✅ Attendance added to Firebase:', docRef.id);
            return docRef.id;
        }
        const newId = Date.now().toString();
        const newAttendance = { id: newId, ...attendanceData };
        localDB.attendance.push(newAttendance);
        saveToLocalStorage('attendance', localDB.attendance);
        console.log('✅ Attendance added to localStorage:', newId);
        return newId;
    } catch (error) {
        console.error('❌ Error adding attendance:', error);
        throw error;
    }
}

export async function updateAttendance(attendanceId, updates) {
    try {
        if (USE_FIREBASE) {
            await updateDoc(doc(db, 'attendance', attendanceId), updates);
            console.log('✅ Attendance updated in Firebase');
            return;
        }
        const attendance = localDB.attendance.find(a => a.id.toString() === attendanceId.toString());
        if (attendance) {
            Object.assign(attendance, updates);
            saveToLocalStorage('attendance', localDB.attendance);
            console.log('✅ Attendance updated in localStorage');
        }
    } catch (error) {
        console.error('❌ Error updating attendance:', error);
        throw error;
    }
}

export async function updateUser(userId, userData) {
    if (USE_FIREBASE) {
        try {
            await updateDoc(doc(db, 'users', userId), {
                ...userData,
                updatedAt: new Date().toISOString()
            });
            console.log('✅ User profile updated in Firestore');
            return true;
        } catch (error) {
            console.error('❌ Error updating user in Firestore:', error);
            throw error;
        }
    } else {
        const userIndex = localDB.users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            Object.assign(localDB.users[userIndex], userData);
            saveToLocalStorage('users', localDB.users);
            console.log('✅ User profile updated in local storage');
            return true;
        }
        return false;
    }
}

export async function updateUserProfilePicture(userId, profilePictureUrl) {
    if (USE_FIREBASE) {
        try {
            await updateDoc(doc(db, 'users', userId), {
                profilePicture: profilePictureUrl,
                updatedAt: new Date().toISOString()
            });
            console.log('✅ Profile picture updated in Firestore');
            return true;
        } catch (error) {
            console.error('❌ Error updating profile picture in Firestore:', error);
            throw error;
        }
    } else {
        const userIndex = localDB.users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            localDB.users[userIndex].profilePicture = profilePictureUrl;
            localDB.users[userIndex].profilePic = profilePictureUrl;
            saveToLocalStorage('users', localDB.users);
            return true;
        }
        return false;
    }
}

export async function addUser(userData) {
    try {
        if (USE_FIREBASE) {
            console.log('👤 Adding user to Firebase:', userData.email);
            
            const userCredential = await createUserWithEmailAndPassword(
                auth, 
                userData.email, 
                userData.password
            );
            const userId = userCredential.user.uid;
            
            console.log('✅ Firebase Auth user created, UID:', userId);
            
            const userDoc = {
                email: userData.email,
                name: userData.name,
                role: userData.role || 'employee',
                position: userData.position || '',
                salary: userData.salary || '',
                phone: userData.phone || '',
                address: userData.address || '',
                department: userData.department || '',
                profilePicture: userData.profilePic || userData.profilePicture || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'active'
            };
            
            await setDoc(doc(db, 'users', userId), userDoc);
            console.log('✅ User document created in Firestore');
        
            const defaultSchedule = getDefaultSchedule();
            await saveEmployeeSchedule(userId, defaultSchedule);
            console.log('✅ Default schedule created for new employee');
            
            return { id: userId, ...userDoc };
        } else {
            const newId = Date.now().toString();
            const newUser = { 
                id: newId, 
                ...userData,
                createdAt: new Date().toISOString()
            };
            
            if (!localDB.users) {
                localDB.users = [];
            }
            
            localDB.users.push(newUser);
            saveToLocalStorage('users', localDB.users);
            
            const defaultSchedule = getDefaultSchedule();
            await saveEmployeeSchedule(newId, defaultSchedule);
            
            console.log('✅ User added to localStorage:', newId);
            
            return newUser;
        }
    } catch (error) {
        console.error('❌ Error adding user:', error);
        
        if (error.code === 'auth/email-already-in-use') {
            throw new Error('Email address is already in use.');
        } else if (error.code === 'auth/weak-password') {
            throw new Error('Password should be at least 6 characters.');
        } else if (error.code === 'auth/invalid-email') {
            throw new Error('Invalid email address format.');
        } else {
            throw new Error('Failed to add user: ' + error.message);
        }
    }
}


export async function deleteUser(userId) {
    try {
        if (USE_FIREBASE) {
            console.log('🗑️ Attempting to delete user from Firebase:', userId);
            
        
            if (!auth.currentUser) {
                throw new Error('You must be logged in to delete users. Please refresh and try again.');
            }
            
            console.log('✅ Authenticated as:', auth.currentUser.email);
            console.log('🔑 Current auth UID:', auth.currentUser.uid);
            
          
            let currentUserDoc;
            try {
                currentUserDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            } catch (error) {
                console.error('❌ Error fetching current user document:', error);
                throw new Error('Unable to verify admin status. Please refresh and try again.');
            }
            
            if (!currentUserDoc.exists()) {
                console.error('❌ Current user document not found in Firestore');
                throw new Error('Admin user document not found. Please contact system administrator.');
            }
            
            const currentUserData = currentUserDoc.data();
            console.log('📋 Current user data:', currentUserData);
            console.log('👤 Current user role:', currentUserData.role);
            
            
            const sessionUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
            sessionUser.role = currentUserData.role; 
            sessionStorage.setItem('currentUser', JSON.stringify(sessionUser));
            console.log('🔄 Updated session storage role:', sessionUser.role);
            
          
            const userRole = currentUserData.role?.toLowerCase().trim();
            const isAdminRole = userRole === 'admin' || userRole === 'owner';
            
            console.log('🔍 Role check - userRole:', userRole, '| isAdminRole:', isAdminRole);
            
            if (!isAdminRole) {
                throw new Error(`Only administrators can delete users. Your current role: "${userRole}". Please contact an administrator.`);
            }
            
            
            if (userId === auth.currentUser.uid) {
                throw new Error('You cannot delete your own account while logged in.');
            }
            
            console.log('✅ Admin verification passed. Proceeding with deletion...');
            
       
            try {
                await deleteDoc(doc(db, 'users', userId));
                console.log('✅ User document deleted from Firestore');
            } catch (deleteError) {
                console.error('❌ Error deleting user document:', deleteError);
                if (deleteError.code === 'permission-denied') {
                    throw new Error('Permission denied by Firestore security rules. Please check your Firebase Console → Firestore → Rules.');
                }
                throw deleteError;
            }
            
         
            try {
                const scheduleDoc = await getDoc(doc(db, 'employeeSchedules', userId));
                if (scheduleDoc.exists()) {
                    await deleteDoc(doc(db, 'employeeSchedules', userId));
                    console.log('✅ Employee schedule deleted');
                } else {
                    console.log('ℹ️ No schedule found for this employee');
                }
            } catch (error) {
                console.warn('⚠️ Could not delete schedule (non-critical):', error.message);
            }
            
          
            try {
                const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
                const deletePromises = [];
                attendanceSnapshot.docs.forEach(attendanceDoc => {
                    if (attendanceDoc.data().userId === userId) {
                        deletePromises.push(deleteDoc(doc(db, 'attendance', attendanceDoc.id)));
                    }
                });
                if (deletePromises.length > 0) {
                    await Promise.all(deletePromises);
                    console.log('✅ Deleted', deletePromises.length, 'attendance records');
                } else {
                    console.log('ℹ️ No attendance records found for this employee');
                }
            } catch (error) {
                console.warn('⚠️ Could not delete all attendance records (non-critical):', error.message);
            }
            
            console.log('✅ User and all related data successfully deleted from Firebase');
            return true;
            
        } else {
      
            const userIndex = localDB.users.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                localDB.users.splice(userIndex, 1);
                saveToLocalStorage('users', localDB.users);
                
               
                if (localDB.employeeSchedules[userId]) {
                    delete localDB.employeeSchedules[userId];
                    saveToLocalStorage('employeeSchedules', localDB.employeeSchedules);
                }
                
               
                localDB.attendance = localDB.attendance.filter(a => a.userId !== userId);
                saveToLocalStorage('attendance', localDB.attendance);
                
                console.log('✅ User and related data deleted from localStorage');
                return true;
            }
            console.warn('⚠️ User not found in localStorage');
            return false;
        }
    } catch (error) {
        console.error('❌ Error deleting user:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        
      
        if (error.code === 'permission-denied') {
            throw new Error('❌ Permission denied by Firebase. Please check:\n1. Your Firestore security rules\n2. Your admin role in Firebase Console');
        } else if (error.message?.includes('Missing or insufficient permissions')) {
            throw new Error('❌ Insufficient permissions. Please ensure:\n1. You are logged in as admin\n2. Your role field is set to "admin" in Firestore\n3. Firestore rules allow deletion');
        } else if (error.message?.includes('Role mismatch') || 
                   error.message?.includes('Only administrators') || 
                   error.message?.includes('logged in') ||
                   error.message?.includes('Admin user document')) {
        
            throw error;
        } else {
            throw new Error('Failed to delete employee: ' + error.message);
        }
    }
}

export async function debugCurrentUserRole() {
    try {
        console.log('=== 🔍 DEBUG: Current User Role Check ===');
        
        if (!auth.currentUser) {
            console.log('❌ No user is currently logged in');
            return null;
        }
        
        console.log('✅ Auth UID:', auth.currentUser.uid);
        console.log('✅ Auth Email:', auth.currentUser.email);
        
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        
        if (!userDoc.exists()) {
            console.log('❌ User document does NOT exist in Firestore');
            return null;
        }
        
        const userData = userDoc.data();
        console.log('📋 Full User Data:', userData);
        console.log('👤 Role field:', userData.role);
        console.log('👤 Role type:', typeof userData.role);
        console.log('👤 Role lowercase:', userData.role?.toLowerCase());
        
        const sessionUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        console.log('📦 Session Storage Role:', sessionUser.role);
        
        const isAdmin = userData.role?.toLowerCase().trim() === 'admin' || userData.role?.toLowerCase().trim() === 'owner';
        console.log('🔐 Is Admin?', isAdmin);
        
        console.log('=== End Debug ===');
        
        return userData;
    } catch (error) {
        console.error('❌ Error during role debug:', error);
        return null;
    }
}

export async function getAllNotifications() {
    loadFromLocalStorage();
    console.log('📊 Getting notifications:', localDB.notifications.length);
    return localDB.notifications || [];
}

export async function addNotification(notification) {
    try {
        loadFromLocalStorage();

        if (!Array.isArray(localDB.notifications)) {
            console.warn('⚠️ localDB.notifications is not an array, initializing...');
            localDB.notifications = [];
        }
        
        const newNotification = {
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...notification,
            timestamp: new Date().toISOString(),
            read: false
        };
        
        console.log('🔔 Adding notification:', newNotification.message);
        
        localDB.notifications.unshift(newNotification);
        const saved = saveToLocalStorage('notifications', localDB.notifications);
        
        if (saved) {
            console.log('✅ Notification saved successfully');
            console.log('📊 Total notifications:', localDB.notifications.length);
            
            return newNotification;
        } else {
            throw new Error('Failed to save notification');
        }
    } catch (error) {
        console.error('❌ Error adding notification:', error);
        throw error;
    }
}

export async function markNotificationAsRead(notificationId) {
    try {
        loadFromLocalStorage();
        
        const notifIndex = localDB.notifications.findIndex(n => n.id === notificationId);
        if (notifIndex !== -1) {
            localDB.notifications[notifIndex].read = true;
            saveToLocalStorage('notifications', localDB.notifications);
            console.log('✅ Notification marked as read');
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Error marking notification as read:', error);
        return false;
    }
}

export async function markAllNotificationsAsRead() {
    try {
        loadFromLocalStorage();
        
        localDB.notifications.forEach(n => n.read = true);
        saveToLocalStorage('notifications', localDB.notifications);
        console.log('✅ All notifications marked as read');
        return true;
    } catch (error) {
        console.error('❌ Error marking all as read:', error);
        return false;
    }
}

export async function clearAllNotifications() {
    try {
        localDB.notifications = [];
        saveToLocalStorage('notifications', localDB.notifications);
        console.log('🗑️ All notifications cleared');
        return true;
    } catch (error) {
        console.error('❌ Error clearing notifications:', error);
        return false;
    }
}

export const getDefaultSchedule = () => {
    return {
        monday: { enabled: true, start: '08:00', end: '17:00', break: '12:00-13:00' },
        tuesday: { enabled: true, start: '08:00', end: '17:00', break: '12:00-13:00' },
        wednesday: { enabled: true, start: '08:00', end: '17:00', break: '12:00-13:00' },
        thursday: { enabled: true, start: '08:00', end: '17:00', break: '12:00-13:00' },
        friday: { enabled: true, start: '08:00', end: '17:00', break: '12:00-13:00' },
        saturday: { enabled: true, start: '08:00', end: '12:00', break: '' },
        sunday: { enabled: false, start: '', end: '', break: '' }
    };
};

export const getAllEmployeeSchedules = async () => {
    try {
        if (USE_FIREBASE) {
            const querySnapshot = await getDocs(collection(db, 'employeeSchedules'));
            const schedules = {};
            querySnapshot.docs.forEach(doc => {
                schedules[doc.id] = doc.data();
            });
            return schedules;
        }
        loadFromLocalStorage();
        return localDB.employeeSchedules || {};
    } catch (error) {
        console.error('Error getting all schedules:', error);
        return {};
    }
};

export const getEmployeeSchedule = async (employeeId) => {
    try {
        if (USE_FIREBASE) {
            const scheduleDoc = await getDoc(doc(db, 'employeeSchedules', employeeId));
            if (scheduleDoc.exists()) {
                return scheduleDoc.data();
            }
            return getDefaultSchedule();
        }
        loadFromLocalStorage();
        return localDB.employeeSchedules[employeeId] || getDefaultSchedule();
    } catch (error) {
        console.error('Error getting employee schedule:', error);
        return getDefaultSchedule();
    }
};

export const saveEmployeeSchedule = async (employeeId, schedule) => {
    try {
        if (USE_FIREBASE) {
            await setDoc(doc(db, 'employeeSchedules', employeeId), {
                ...schedule,
                updatedAt: new Date().toISOString()
            });
            console.log('✅ Schedule saved to Firebase for employee:', employeeId);
        } else {
            loadFromLocalStorage();
            localDB.employeeSchedules[employeeId] = schedule;
            saveToLocalStorage('employeeSchedules', localDB.employeeSchedules);
            console.log('✅ Schedule saved to localStorage for employee:', employeeId);
        }
        return true;
    } catch (error) {
        console.error('Error saving schedule:', error);
        throw error;
    }
};

export const updateDaySchedule = async (employeeId, day, daySchedule) => {
    try {
        const schedule = await getEmployeeSchedule(employeeId);
        schedule[day] = daySchedule;
        await saveEmployeeSchedule(employeeId, schedule);
        return true;
    } catch (error) {
        console.error('Error updating day schedule:', error);
        throw error;
    }
};

export const calculateDayHours = (start, end) => {
    if (!start || !end) return 0;
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const hours = (endH * 60 + endM - startH * 60 - startM) / 60;
    return hours;
};

export const calculateWeeklyHours = (schedule) => {
    let total = 0;
    Object.values(schedule).forEach(day => {
        if (day.enabled && day.start && day.end) {
            total += calculateDayHours(day.start, day.end);
        }
    });
    return total;
};

export const getWorkingDaysCount = (schedule) => {
    return Object.values(schedule).filter(day => day.enabled).length;
};

export const isWorkingToday = async (employeeId) => {
    try {
        const schedule = await getEmployeeSchedule(employeeId);
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        return schedule[today]?.enabled || false;
    } catch (error) {
        console.error('Error checking work status:', error);
        return false;
    }
};

export const getTodayShift = async (employeeId) => {
    try {
        const schedule = await getEmployeeSchedule(employeeId);
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        return schedule[today] || null;
    } catch (error) {
        console.error('Error getting today shift:', error);
        return null;
    }
};

export const deleteEmployeeSchedule = async (employeeId) => {
    try {
        if (USE_FIREBASE) {
            await deleteDoc(doc(db, 'employeeSchedules', employeeId));
            console.log('✅ Schedule deleted from Firebase');
        } else {
            loadFromLocalStorage();
            delete localDB.employeeSchedules[employeeId];
            saveToLocalStorage('employeeSchedules', localDB.employeeSchedules);
            console.log('✅ Schedule deleted from localStorage');
        }
        return true;
    } catch (error) {
        console.error('Error deleting schedule:', error);
        throw error;
    }
};

export const listenToScheduleChanges = (employeeId, callback) => {
    if (!USE_FIREBASE) {
        console.warn('Real-time listeners only work with Firebase');
        return () => {};
    }
    
    try {
        const scheduleRef = doc(db, 'employeeSchedules', employeeId);
        
        console.log('👂 Setting up real-time listener for schedule:', employeeId);
        
        const unsubscribe = onSnapshot(scheduleRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const newSchedule = docSnapshot.data();
                console.log('🔔 Schedule updated in real-time!', newSchedule);
                
                callback(newSchedule);
                
                if (typeof window !== 'undefined' && window.Notification) {
                    if (Notification.permission === 'granted') {
                        new Notification('📅 Schedule Updated', {
                            body: 'Your work schedule has been updated by the administrator.',
                            icon: '/favicon.ico'
                        });
                    }
                }
            }
        }, (error) => {
            console.error('❌ Error listening to schedule changes:', error);
        });
        
        return unsubscribe;
    } catch (error) {
        console.error('❌ Error setting up schedule listener:', error);
        return () => {};
    }
};

export const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && window.Notification) {
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            console.log('🔔 Notification permission:', permission);
            return permission === 'granted';
        }
        return Notification.permission === 'granted';
    }
    return false;
};

export const notifyScheduleChange = async (employeeId, employeeName, changeDetails) => {
    try {
        const notification = {
            type: 'schedule-update',
            employeeId: employeeId,
            employeeName: employeeName,
            message: `Schedule updated: ${changeDetails}`,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            read: false
        };
        
        await addNotification(notification);
        console.log('✅ Schedule change notification sent');
        return true;
    } catch (error) {
        console.error('❌ Error sending schedule notification:', error);
        return false;
    }
};

export const debugLocalDB = () => {
    loadFromLocalStorage();
    console.log('=== 🔍 DATABASE DEBUG ===');
    console.log('📡 Mode: FIREBASE (Users, Attendance, Schedules)');
    console.log('💾 Mode: LOCAL STORAGE (Notifications, Employee Schedules)');
    console.log('');
    console.log('🔐 Firebase Auth Status:', auth.currentUser ? `✅ Logged in as ${auth.currentUser.email}` : '❌ Not authenticated');
    console.log('🔔 Notifications:', localDB.notifications.length);
    console.log('📅 Employee Schedules:', Object.keys(localDB.employeeSchedules).length);
    console.log('');
    if (localDB.notifications.length > 0) {
        console.log('📝 Notification Details:');
        localDB.notifications.forEach((n, i) => {
            console.log(`  ${i + 1}. [${n.type}] ${n.employeeName} - ${n.message}`);
            console.log(`     Time: ${n.time}, Date: ${n.date}, Read: ${n.read}`);
        });
    } else {
        console.log('  No notifications yet');
    }
    console.log('=====================');
    return localDB;
};

if (typeof window !== 'undefined') {
    window.debugLocalDB = debugLocalDB;
    window.localDB = localDB;
    window.clearAllNotifications = clearAllNotifications;
    
    window.addEventListener('storage', (e) => {
        if (e.key === 'ishiaya_notifications' || e.key === 'notification_update') {
            console.log('🔄 Notification update detected from another tab');
            loadFromLocalStorage();
            window.dispatchEvent(new CustomEvent('notificationUpdate'));
        }
    });
}