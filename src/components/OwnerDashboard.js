import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
getAllUsers,
getAllAttendance,
localDB,
saveToLocalStorage,
getAllNotifications,
markNotificationAsRead,
markAllNotificationsAsRead,
clearAllNotifications
} from '../config/firebase-config';
import '../styles/Dashboard.css';
import logo from '../assets/ishiaya.jpg';

function OwnerDashboard() {
const navigate = useNavigate();
const [currentUser, setCurrentUser] = useState(null)
const [users, setUsers] = useState([]);
const [attendance, setAttendance] = useState([]);
const [showProfileDropdown, setShowProfileDropdown] = useState(false);
const [loading, setLoading] = useState(true);
const [activeSection, setActiveSection] = useState('dashboard');

const [showProfilePicModal, setShowProfilePicModal] = useState(false);
const [profilePicPreview, setProfilePicPreview] = useState(null);

const [notifications, setNotifications] = useState([]);
const [unreadCount, setUnreadCount] = useState(0);
const [showNotifications, setShowNotifications] = useState(false);

const [stats, setStats] = useState({
totalEmployees: 0,
activeToday: 0,
totalPayroll: 0,
pendingApprovals: 0
});

const [payrollData, setPayrollData] = useState([]);
const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
const [showPayrollPreview, setShowPayrollPreview] = useState(false);
const [generatedPayroll, setGeneratedPayroll] = useState([]);
const [showFormalReport, setShowFormalReport] = useState(false);
const [searchPayrollEmployee, setSearchPayrollEmployee] = useState('');


const DAILY_RATE = 415.00;
const OVERTIME_RATE = 415.00 * 0.12;
const HOLIDAY_RATE = 124.50;
const LATE_DEDUCTION = 50.00;
const SSS_RATE = 0.045;
const PHILHEALTH_RATE = 0.02;
const PAGIBIG_RATE = 0.02;

const getProfilePicture = (user) => {
if (user?.profilePic) {
return user.profilePic;
}
if (user?.profilePicture) {
return user.profilePicture;
}
return null;
};

const getInitials = (name) => {
if (!name) return '?';
const parts = name.split(' ');
if (parts.length >= 2) {
return parts[0][0] + parts[parts.length - 1][0];
}
return name.substring(0, 2);
};

const loadData = async () => {
try {
setLoading(true);

const { loadFromLocalStorage } = await import('../config/firebase-config');
loadFromLocalStorage();

console.log('📊 Loading data for Owner Dashboard...');

const usersData = await getAllUsers() || [];
const attendanceData = await getAllAttendance() || [];

console.log('📊 Loaded attendance records:', attendanceData.length);

setUsers(usersData);
setAttendance(attendanceData);

const user = JSON.parse(sessionStorage.getItem('currentUser'));
const updatedUser = usersData.find(u => u.id === user.id);
if (updatedUser) {
const mergedUser = {
...updatedUser,
profilePic: updatedUser.profilePicture || updatedUser.profilePic || user.profilePic,
profilePicture: updatedUser.profilePicture || updatedUser.profilePic || user.profilePicture
};
setCurrentUser(mergedUser);
sessionStorage.setItem('currentUser', JSON.stringify(mergedUser));
}

console.log('🔔 Loading notifications from Firebase...');
const allNotifications = await getAllNotifications();

console.log('✅ Loaded notifications:', allNotifications.length);
console.log('📝 Notifications:', allNotifications);

const sorted = allNotifications.sort((a, b) =>
new Date(b.timestamp) - new Date(a.timestamp)
);

setNotifications(sorted);
setUnreadCount(sorted.filter(n => !n.read).length);

console.log('🔔 Set notifications state:', sorted.length);
console.log('🔴 Unread count:', sorted.filter(n => !n.read).length);

const employees = usersData.filter(u => u.role === 'employee');
const today = new Date().toISOString().split('T')[0];
const activeToday = attendanceData.filter(a => a.date === today).length;

const totalPayroll = (localDB && localDB.payroll)
? localDB.payroll.reduce((sum, p) => {
return sum + (p.data || []).reduce((s, d) => s + (d.netPay || 0), 0);
}, 0)
: 0;

setStats({
totalEmployees: employees.length,
activeToday,
totalPayroll,
pendingApprovals: 0
});

if (localDB && localDB.payroll) {
setPayrollData(localDB.payroll);
}
} catch (error) {
console.error('Error loading data:', error);
setUsers([]);
setAttendance([]);
setNotifications([]);
setStats({
totalEmployees: 0,
activeToday: 0,
totalPayroll: 0,
pendingApprovals: 0
});
} finally {
setLoading(false);
}
};

useEffect(() => {
const stored = sessionStorage.getItem('currentUser');
if (!stored) {
navigate('/');
return;
}

let user;
try {
user = JSON.parse(stored);
} catch (error) {
console.error('Error parsing user data:', error);
navigate('/');
return;
}
if (!user || user.role !== 'owner') {
navigate('/');
return;
}

setCurrentUser(user);
loadData();


const handleNotificationUpdate = (e) => {
console.log('🔔 Owner: Notification update detected', e?.detail);
loadData();
};

window.addEventListener('notificationUpdate', handleNotificationUpdate);

const handleStorageChange = (e) => {
if (e.key === 'ishiaya_notifications' || e.key === 'notification_trigger' || e.key === 'ishiayaDB' || e.key === 'notification_update_timestamp') {
console.log('🔔 Owner: Storage change detected:', e.key);
loadData();
}
};
window.addEventListener('storage', handleStorageChange);


const pollInterval = setInterval(() => {
import('../config/firebase-config').then(({ loadFromLocalStorage, localDB }) => {
loadFromLocalStorage();

const currentNotifCount = notifications.length;
const newNotifCount = localDB.notifications?.length || 0;

if (newNotifCount !== currentNotifCount) {
console.log('🔔 Owner: New notifications detected via polling:', newNotifCount, 'vs', currentNotifCount);
loadData();
}
});
}, 3000);

return () => {
window.removeEventListener('notificationUpdate', handleNotificationUpdate);
window.removeEventListener('storage', handleStorageChange);
clearInterval(pollInterval);
};
}, [navigate, notifications.length]);

const handleLogout = () => {
sessionStorage.removeItem('currentUser');
navigate('/');
};

const handleProfilePicChange = (e) => {
const file = e.target.files[0];
if (file) {
const reader = new FileReader();
reader.onloadend = () => {
setProfilePicPreview(reader.result);
};
reader.readAsDataURL(file);
}
};

const handleSaveProfilePic = async () => {
if (!profilePicPreview) {
alert('Please select an image first');
return;
}

try {
const { updateUserProfilePicture } = await import('../config/firebase-config');
await updateUserProfilePicture(currentUser.id, profilePicPreview);

const updatedUser = {
...currentUser,
profilePic: profilePicPreview,
profilePicture: profilePicPreview
};

setCurrentUser(updatedUser);
sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
setShowProfilePicModal(false);
setProfilePicPreview(null);

alert('Profile picture updated successfully!');
await loadData();
} catch (error) {
console.error('Error updating profile picture:', error);
alert('Failed to update profile picture: ' + error.message);
}
};

const markAsRead = async (notificationId) => {
try {
console.log('🔵 Owner: Marking notification as read:', notificationId);
await markNotificationAsRead(notificationId);
await loadData();
console.log('✅ Owner: Notification marked as read successfully');
} catch (error) {
console.error('❌ Owner: Error marking notification as read:', error);
}
};

const markAllAsRead = async () => {
try {
console.log('🔵 Owner: Marking all notifications as read...');
await markAllNotificationsAsRead();
await loadData();
console.log('✅ Owner: All notifications marked as read successfully');
} catch (error) {
console.error('❌ Owner: Error marking all as read:', error);
}
};

const clearNotifications = async () => {
try {
if (window.confirm('Clear all notifications?')) {
console.log('🔵 Owner: Clearing all notifications...');
await clearAllNotifications();
await loadData();
console.log('✅ Owner: All notifications cleared successfully');
}
} catch (error) {
console.error('❌ Owner: Error clearing notifications:', error);
}
};

const generatePayroll = async () => {
try {
const employees = users.filter(u => u.role === 'employee');
const month = selectedMonth;
const payrollRecords = [];

for (const emp of employees) {
const empAttendance = attendance.filter(a =>
a.userId === emp.id && a.date.startsWith(month)
);

const daysWorked = empAttendance.filter(a =>
a.status === 'Present' || a.timeIn
).length;

const totalOvertimeHours = empAttendance.reduce((sum, a) =>
sum + (a.overtimeHours || 0), 0
);

const holidaysWorked = empAttendance.filter(a => a.isHoliday).length;
const lateDays = empAttendance.filter(a => a.isLate).length;

const basicPay = daysWorked * DAILY_RATE;
const overtimePay = totalOvertimeHours * OVERTIME_RATE;
const holidayPay = holidaysWorked * HOLIDAY_RATE;
const nightDiff = 0;
const incentives = 0;
const adjustment = 0;

const totalAmount = basicPay + overtimePay + holidayPay + nightDiff + incentives + adjustment;

const sss = totalAmount * SSS_RATE;
const philhealth = totalAmount * PHILHEALTH_RATE;
const pagibig = totalAmount * PAGIBIG_RATE;
const lateDeductions = lateDays * LATE_DEDUCTION;
const loans = 0;
const penalty = 0;
const ca = 0;

const totalDeductions = sss + philhealth + pagibig + lateDeductions + loans + penalty + ca;
const netPay = totalAmount - totalDeductions;

payrollRecords.push({
employeeId: emp.id,
employeeName: emp.name,
employeePosition: emp.position || 'N/A',
profilePic: getProfilePicture(emp),
period: month,
daysWorked,
restDays: 0,
rate: DAILY_RATE,
basicPay,
overtimeHours: totalOvertimeHours,
overtimePay,
holidayPay,
nightDiff,
incentives,
adjustment,
totalAmount,
sss,
philhealth,
pagibig,
late: lateDeductions,
lateDays,
loans,
penalty,
ca,
totalDeductions,
netPay
});
}

setGeneratedPayroll(payrollRecords);
setShowPayrollPreview(true);
} catch (error) {
console.error('Error generating payroll:', error);
alert('Failed to generate payroll');
}
};

const handleSavePayroll = async () => {
try {
const payrollEntry = {
id: Date.now().toString(),
month: selectedMonth,
data: generatedPayroll,
createdAt: new Date().toISOString()
};

if (!localDB.payroll) {
localDB.payroll = [];
}

localDB.payroll = localDB.payroll.filter(p => p.month !== selectedMonth);
localDB.payroll.push(payrollEntry);
await saveToLocalStorage();

alert('Payroll saved successfully!');
setShowPayrollPreview(false);
setGeneratedPayroll([]);
loadData();
} catch (error) {
console.error('Error saving payroll:', error);
alert('Failed to save payroll');
}
};

const handlePrintPayroll = () => {
setShowFormalReport(true);
setTimeout(() => {
window.print();
}, 100);
};

const formatCurrency = (amount) => {
return amount.toFixed(2);
};

const formatDate = (dateStr) => {
const date = new Date(dateStr);
return date.toLocaleDateString('en-US', {
year: 'numeric',
month: 'long',
day: 'numeric'
});
};

const renderContent = () => {
if (loading) {
return (
<div style={{ textAlign: 'center', padding: '3rem' }}>
<div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
<h2>Loading...</h2>
</div>
);
}

switch (activeSection) {
case 'dashboard':
return renderDashboard();
case 'employees':
return renderEmployees();
case 'reports':
return renderReports();
case 'payroll':
return renderPayroll();
case 'settings':
return renderSettings();
default:
return renderDashboard();
}
};

const renderDashboard = () => (
<>
<div className="stats-grid">
<div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
<h3>Total Employees</h3>
<p className="stat-number">{stats.totalEmployees}</p>
</div>
<div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
<h3>Active Today</h3>
<p className="stat-number">{stats.activeToday}</p>
</div>
<div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
<h3>Total Payroll</h3>
<p className="stat-number">₱{stats.totalPayroll.toFixed(2)}</p>
</div>
<div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
<h3>Notifications</h3>
<p className="stat-number">{unreadCount}</p>
</div>
</div>

{notifications.length > 0 && (
<div className="dashboard-section" style={{ marginBottom: '2rem' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
<h2>📬 Recent Activity</h2>
<button
className="btn-secondary"
onClick={() => setShowNotifications(true)}
style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
>
View All ({notifications.length})
</button>
</div>
<div style={{ display: 'grid', gap: '0.8rem' }}>
{notifications.slice(0, 5).map(notif => (
<div
key={notif.id}
style={{
padding: '1rem',
background: notif.read ? 'white' : '#e7f3ff',
borderRadius: '8px',
borderLeft: `4px solid ${notif.type === 'clock-in' ? '#28a745' : '#dc3545'}`,
display: 'flex',
alignItems: 'center',
gap: '1rem',
boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
}}
>
<span style={{ fontSize: '1.5rem' }}>
{notif.type === 'clock-in' ? '🟢' : '🔴'}
</span>
<div style={{ flex: 1 }}>
<p style={{ margin: '0 0 0.3rem 0', fontWeight: '600', color: '#333' }}>
{notif.employeeName} - {notif.employeePosition}
</p>
<p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
{notif.message}
</p>
<div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem' }}>
<span style={{ fontSize: '0.75rem', color: '#999' }}>🕐 {notif.time}</span>
<span style={{ fontSize: '0.75rem', color: '#999' }}>📅 {notif.date}</span>
</div>
</div>
{!notif.read && (
<span style={{
padding: '0.3rem 0.8rem',
background: '#667eea',
color: 'white',
borderRadius: '12px',
fontSize: '0.75rem',
fontWeight: '600'
}}>
NEW
</span>
)}
</div>
))}
</div>
</div>
)}

<div className="dashboard-section">
<h2>📋 Recent Attendance</h2>
<table className="data-table">
<thead>
<tr>
<th>Employee</th>
<th>Date</th>
<th>Time In</th>
<th>Time Out</th>
<th>Status</th>
</tr>
</thead>
<tbody>
{attendance.slice(-10).reverse().map((record, index) => {
const user = users.find(u => u.id === record.userId);
return (
<tr key={index}>
<td>
<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
{getProfilePicture(user) ? (
<img
src={getProfilePicture(user)}
alt={user?.name}
style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
/>
) : (
<div style={{
width: '32px', height: '32px', borderRadius: '50%',
background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
display: 'flex', alignItems: 'center', justifyContent: 'center',
color: 'white', fontSize: '0.75rem', fontWeight: 'bold'
}}>
{getInitials(user?.name)}
</div>
)}
{user?.name || 'Unknown'}
</div>
</td>
<td>{record.date}</td>
<td>{record.timeIn}</td>
<td>{record.timeOut || 'Not yet'}</td>
<td>
<span style={{
padding: '0.3rem 0.8rem', borderRadius: '12px',
background: record.status === 'Present' ? '#d4edda' : '#f8d7da',
color: record.status === 'Present' ? '#155724' : '#721c24',
fontSize: '0.85rem', fontWeight: '600'
}}>
{record.status}
</span>
</td>
</tr>
);
})}
</tbody>
</table>
</div>
</>
);

const renderEmployees = () => (
<div className="dashboard-section">
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
<h2>👥 Employee Management</h2>
</div>

<table className="data-table">
<thead>
<tr>
<th>Profile</th>
<th>Name</th>
<th>Email</th>
<th>Position</th>
<th>Daily Salary</th>
</tr>
</thead>
<tbody>
{users.filter(u => u.role === 'employee').map(user => (
<tr key={user.id}>
<td>
{getProfilePicture(user) ? (
<img src={getProfilePicture(user)} alt={user.name}
style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
/>
) : (
<div style={{
width: '40px', height: '40px', borderRadius: '50%',
background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
color: 'white', fontSize: '0.9rem', fontWeight: 'bold'
}}>
{getInitials(user.name)}
</div>
)}
</td>
<td>{user.name}</td>
<td>{user.email}</td>
<td>{user.position || 'N/A'}</td>
<td>₱{user.salary || '0'}</td>
</tr>
))}
</tbody>
</table>
</div>
);

const renderReports = () => {
const today = new Date().toISOString().split('T')[0];
const currentMonth = new Date().toISOString().slice(0, 7);

const attendanceByEmployee = users.filter(u => u.role === 'employee').map(emp => {
const empAttendance = attendance.filter(a => a.userId === emp.id);
const thisMonth = empAttendance.filter(a => a.date.startsWith(currentMonth));
const todayRecord = empAttendance.find(a => a.date === today);

return {
name: emp.name,
profilePic: emp.profilePic || emp.profilePicture,
totalDays: empAttendance.length,
thisMonth: thisMonth.length,
status: todayRecord ? (todayRecord.timeOut ? 'Clocked Out' : 'Clocked In') : 'Absent'
};
});

return (
<div className="dashboard-section">
<h2>📊 Attendance Reports</h2>

<div style={{ marginBottom: '2rem' }}>
<h3>Summary Statistics</h3>
<div className="stats-grid">
<div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
<h3>Total Records</h3>
<p className="stat-number">{attendance.length}</p>
</div>
<div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
<h3>This Month</h3>
<p className="stat-number">{attendance.filter(a =>a.date.startsWith(currentMonth)).length}</p>
</div>
<div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
<h3>Active Today</h3>
<p className="stat-number">{stats.activeToday}</p>
</div>
<div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
<h3>Average Daily</h3>
<p className="stat-number">{(attendance.length / Math.max(stats.totalEmployees, 1)).toFixed(1)}</p>
</div>
</div>
</div>

<h3>Employee Attendance Summary</h3>
<table className="data-table">
<thead>
<tr>
<th>Employee</th>
<th>Total Days</th>
<th>This Month</th>
<th>Today's Status</th>
</tr>
</thead>
<tbody>
{attendanceByEmployee.map((emp, index) => (
<tr key={index}>
<td>
<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
{emp.profilePic ? (
<img src={emp.profilePic} alt={emp.name}
style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
/>
) : (
<div style={{
width: '32px', height: '32px', borderRadius: '50%',
background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
display: 'flex', alignItems: 'center', justifyContent: 'center',
color: 'white', fontSize: '0.75rem', fontWeight: 'bold'
}}>
{getInitials(emp.name)}
</div>
)}
{emp.name}
</div>
</td>
<td>{emp.totalDays}</td>
<td>{emp.thisMonth}</td>
<td>
<span style={{
padding: '0.3rem 0.8rem', borderRadius: '12px',
background: emp.status === 'Clocked In' ? '#d4edda' : emp.status === 'Clocked Out' ? '#d1ecf1' : '#f8d7da',
color: emp.status === 'Clocked In' ? '#155724' : emp.status === 'Clocked Out' ? '#0c5460' : '#721c24',
fontSize: '0.85rem', fontWeight: '600'
}}>
{emp.status}
</span>
</td>
</tr>
))}
</tbody>
</table>
</div>
);
};

const renderPayroll = () => {
const currentPayroll = payrollData.find(p => p.month === selectedMonth);
const filteredPayroll = showPayrollPreview
? generatedPayroll.filter(p => p.employeeName.toLowerCase().includes(searchPayrollEmployee.toLowerCase()))
: [];

const totals = filteredPayroll.length > 0 ? filteredPayroll.reduce((acc, emp) => ({
daysWorked: acc.daysWorked + emp.daysWorked,
basicPay: acc.basicPay + emp.basicPay,
overtimeHours: acc.overtimeHours + emp.overtimeHours,
overtimePay: acc.overtimePay + emp.overtimePay,
            nightDiff: acc.nightDiff + emp.nightDiff,
            incentives: acc.incentives + emp.incentives,
            adjustment: acc.adjustment + emp.adjustment,
            totalAmount: acc.totalAmount + emp.totalAmount,
            sss: acc.sss + emp.sss,
            philhealth: acc.philhealth + emp.philhealth,
            pagibig: acc.pagibig + emp.pagibig,
            late: acc.late + emp.late,
            loans: acc.loans + emp.loans,
            penalty: acc.penalty + emp.penalty,
            ca: acc.ca + emp.ca,
            totalDeductions: acc.totalDeductions + emp.totalDeductions,
            netPay: acc.netPay + emp.netPay
        }), {
            daysWorked: 0, basicPay: 0, overtimeHours: 0, overtimePay: 0, nightDiff: 0,
            incentives: 0, adjustment: 0, totalAmount: 0, sss: 0, philhealth: 0,
            pagibig: 0, late: 0, loans: 0, penalty: 0, ca: 0, totalDeductions: 0, netPay: 0
        }) : null;

        if (showFormalReport && showPayrollPreview && filteredPayroll.length > 0) {
            const monthYear = new Date(selectedMonth + '-01');
            const periodStart = new Date(monthYear.getFullYear(), monthYear.getMonth(), 1);
            const periodEnd = new Date(monthYear.getFullYear(), monthYear.getMonth() + 1, 0);

            return (
                <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', maxWidth: '1400px', margin: '0 auto', backgroundColor: '#fff' }}>
                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 10px 0', letterSpacing: '2px' }}>PAYROLL</h1>
                        <p style={{ margin: '5px 0', fontSize: '14px' }}>For the period</p>
                        <p style={{ margin: '5px 0', fontSize: '16px', fontWeight: 'bold' }}>
                            {formatDate(periodStart)} - {formatDate(periodEnd)}
                        </p>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: '30px', fontSize: '12px', lineHeight: '1.6' }}>
                        <p style={{ margin: '5px 0' }}>
                            WE HEREBY ACKNOWLEDGE to have received from ISHAYA'S GARDEN BISTRO located at ZONE 5, ZIGA AVENUE, SAN CARLOS TABASCO CITY.
                        </p>
                        <p style={{ margin: '15px 0 5px 0' }}>
                            The sum specified opposite our respective names, as full compensation for the services rendered.
                        </p>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '2px solid #000' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#b8cce4' }}>
                                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', minWidth: '150px' }}>NAMES</th>
                                    <th colSpan="2" style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>NO. OF<br/>DAYS</th>
                                    <th colSpan="3" style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', backgroundColor: '#dce6f1' }}>REGULAR</th>
                                    <th colSpan="3" style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', backgroundColor: '#e4dfec' }}>OVERTIME</th>
                                    <th colSpan="3" style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>&nbsp;</th>
                                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', backgroundColor: '#fde9d9' }}>TOTAL<br/>AMOUNT</th>
                                    <th colSpan="8" style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', backgroundColor: '#f2dcdb' }}>DEDUCTIONS</th>
                                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', backgroundColor: '#d8e4bc' }}>TOTAL<br/>SALARY</th>
                                </tr>
                                <tr style={{ backgroundColor: '#b8cce4' }}>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px' }}>WORKED</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px' }}>REST</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', backgroundColor: '#dce6f1' }}>RATE</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', backgroundColor: '#dce6f1' }}>WAGE</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', backgroundColor: '#dce6f1' }}>&nbsp;</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', backgroundColor: '#e4dfec' }}>HRS</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', backgroundColor: '#e4dfec' }}>AMT</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', backgroundColor: '#e4dfec' }}>&nbsp;</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px' }}>NIGHT<br/>DIFFERENTIAL</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px' }}>INCENTIVES<br/>BONUS ADJ</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px' }}>ADJUSTMENT</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', backgroundColor: '#f2dcdb' }}>SSS</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', backgroundColor: '#f2dcdb' }}>PHILHEALTH</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', backgroundColor: '#f2dcdb' }}>PAGIBIG</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', backgroundColor: '#f2dcdb' }}>LATE</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', backgroundColor: '#f2dcdb' }}>LOANS</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', backgroundColor: '#f2dcdb' }}>penalty</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', backgroundColor: '#f2dcdb' }}>ca</th>
                                    <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', backgroundColor: '#f2dcdb' }}>TOTAL<br/>DEDUCTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPayroll.map((emp, index) => (
                                    <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                                        <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>{emp.employeeName}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{emp.daysWorked}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>-</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(emp.rate)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(emp.basicPay)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>-</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{formatCurrency(emp.overtimeHours)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(emp.overtimePay)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>-</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(emp.nightDiff)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(emp.incentives)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(emp.adjustment)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#fef2e7' }}>{formatCurrency(emp.totalAmount)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(emp.sss)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(emp.philhealth)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(emp.pagibig)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(emp.late)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(emp.loans)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(emp.penalty)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(emp.ca)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#fadbd8' }}>{formatCurrency(emp.totalDeductions)}</td>
                                        <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#eaf2d3' }}>{formatCurrency(emp.netPay)}</td>
                                    </tr>
                                ))}
                                <tr style={{ backgroundColor: '#d9d9d9', fontWeight: 'bold' }}>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>TOTAL</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{totals.daysWorked}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>&nbsp;</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>&nbsp;</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(totals.basicPay)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>&nbsp;</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{formatCurrency(totals.overtimeHours)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(totals.overtimePay)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>&nbsp;</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(totals.nightDiff)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(totals.incentives)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(totals.adjustment)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', backgroundColor: '#fef2e7' }}>{formatCurrency(totals.totalAmount)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(totals.sss)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(totals.philhealth)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(totals.pagibig)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(totals.late)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(totals.loans)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(totals.penalty)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{formatCurrency(totals.ca)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', backgroundColor: '#fadbd8' }}>{formatCurrency(totals.totalDeductions)}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', backgroundColor: '#eaf2d3' }}>{formatCurrency(totals.netPay)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: '60px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '40px', fontSize: '12px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ borderBottom: '1px solid #000', marginBottom: '5px', paddingBottom: '20px' }}>&nbsp;</div>
                            <p style={{ margin: '0', fontWeight: 'bold' }}>Prepared by</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ borderBottom: '1px solid #000', marginBottom: '5px', paddingBottom: '20px' }}>&nbsp;</div>
                            <p style={{ margin: '0', fontWeight: 'bold' }}>Checked by</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ borderBottom: '1px solid #000', marginBottom: '5px', paddingBottom: '20px' }}>&nbsp;</div>
                            <p style={{ margin: '0', fontWeight: 'bold' }}>Approved by</p>
                        </div>
                    </div>

                    <div style={{ marginTop: '40px', textAlign: 'center' }} className="no-print">
                        <button 
                            onClick={() => setShowFormalReport(false)}
                            style={{ padding: '12px 30px', fontSize: '14px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginRight: '10px' }}
                        >
                            ← Back to Dashboard
                        </button>
                        <button 
                            onClick={() => window.print()}
                            style={{ padding: '12px 30px', fontSize: '14px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            🖨️ Print Payroll
                        </button>
                    </div>

                    <style>{`
                        @media print {
                            .no-print { display: none !important; }
                            body { margin: 0; padding: 20px; }
                        }
                    `}</style>
                </div>
            );
        }

        return (
             <div className="dashboard-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2>💰 Payroll Management</h2>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <input 
                            type="month" 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(e.target.value)} 
                            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }} 
                        />
                        <button className="btn-primary" onClick={generatePayroll}>
                            📊 Generate Payroll
                        </button>
                    </div>
                </div>

                {showPayrollPreview && filteredPayroll.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3>Payroll Preview for {selectedMonth}</h3>
                            <input
                                type="text"
                                placeholder="🔍 Search employee..."
                                value={searchPayrollEmployee}
                                onChange={(e) => setSearchPayrollEmployee(e.target.value)}
                                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '2px solid #e2e8f0', width: '250px' }}
                            />
                        </div>

                       <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                            <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FDFDFDFF 0%, #FFFFFFFF 100%)', color: '#333' }}>
                                <h4 style={{ color: '#333' }}>Total Employees</h4>
                                <p className="stat-number" style={{ color: '#333' }}>{filteredPayroll.length}</p>
                            </div>
                            <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: '#333' }}>
                                <h4 style={{ color: '#333' }}>Total Basic Pay</h4>
                                <p className="stat-number" style={{ color: '#333' }}>₱{formatCurrency(totals.basicPay)}</p>
                            </div>
                            <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: '#333' }}>
                                <h4 style={{ color: '#333' }}>Total Deductions</h4>
                                <p className="stat-number" style={{ color: '#333' }}>₱{formatCurrency(totals.totalDeductions)}</p>
                            </div>
                            <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: '#333' }}>
                                <h4 style={{ color: '#333' }}>Total Net Pay</h4>
                                <p className="stat-number" style={{ color: '#333' }}>₱{formatCurrency(totals.netPay)}</p>
                            </div>
                        </div>

                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Days</th>
                                    <th>OT Hours</th>
                                    <th>Basic Pay</th>
                                    <th>OT Pay</th>
                                    <th>Total Amount</th>
                                    <th>Deductions</th>
                                    <th>Net Pay</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPayroll.map((emp, index) => (
                                    <tr key={index}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {emp.profilePic ? (
                                                    <img src={emp.profilePic} alt={emp.employeeName}
                                                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: 'white', fontSize: '0.75rem', fontWeight: 'bold'
                                                    }}>
                                                        {getInitials(emp.employeeName)}
                                                    </div>
                                                )}
                                                <strong>{emp.employeeName}</strong>
                                            </div>
                                        </td>
                                        <td>{emp.daysWorked}</td>
                                        <td>{formatCurrency(emp.overtimeHours)}</td>
                                        <td>₱{formatCurrency(emp.basicPay)}</td>
                                        <td>₱{formatCurrency(emp.overtimePay)}</td>
                                        <td style={{ fontWeight: '600' }}>₱{formatCurrency(emp.totalAmount)}</td>
                                        <td style={{ color: '#ef4444' }}>₱{formatCurrency(emp.totalDeductions)}</td>
                                        <td style={{ color: '#10b981', fontWeight: '600' }}>₱{formatCurrency(emp.netPay)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'center' }}>
                            <button 
                                className="btn-primary" 
                                onClick={handleSavePayroll}
                                style={{ padding: '0.75rem 2rem' }}
                            >
                                💾 Save Payroll
                            </button>
                            <button 
                                className="btn-primary" 
                                onClick={handlePrintPayroll}
                                style={{ padding: '0.75rem 2rem', background: '#4CAF50' }}
                            >
                                🖨️ Print Formal Report
                            </button>
                            <button 
                                className="btn-secondary" 
                                onClick={() => {
                                    setShowPayrollPreview(false);
                                    setGeneratedPayroll([]);
                                }}
                                style={{ padding: '0.75rem 2rem' }}
                            >
                                ✖ Cancel
                            </button>
                        </div>
                    </div>
                )}

                {currentPayroll && !showPayrollPreview ? (
                    <>
                        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                            <h3>Saved Payroll for {selectedMonth}</h3>
                            <p>Total Employees: {currentPayroll.data.length}</p>
                            <p>Total Gross Pay: ₱{currentPayroll.data.reduce((sum, d) => sum + (d.basicPay || d.grossPay || 0), 0).toFixed(2)}</p>
                            <p>Total Deductions: ₱{currentPayroll.data.reduce((sum, d) => sum + (d.totalDeductions || d.deductions || 0), 0).toFixed(2)}</p>
                            <p>Total Net Pay: ₱{currentPayroll.data.reduce((sum, d) => sum + d.netPay, 0).toFixed(2)}</p>
                        </div>

                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Days Worked</th>
                                    <th>Daily Rate</th>
                                    <th>Gross Pay</th>
                                    <th>Deductions</th>
                                    <th>Net Pay</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentPayroll.data.map((record, index) => (
                                    <tr key={index}>
                                        <td>{record.employeeName}</td>
                                        <td>{record.daysWorked}</td>
                                        <td>₱{(record.rate || record.dailyRate || 0).toFixed(2)}</td>
                                        <td>₱{(record.basicPay || record.grossPay || 0).toFixed(2)}</td>
                                        <td>₱{(record.totalDeductions || record.deductions || 0).toFixed(2)}</td>
                                        <td>₱{record.netPay.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', background: '#f8f9fa', borderRadius: '8px' }}>
                        <p>No payroll generated for {selectedMonth}</p>
                        <p>Click "Generate Payroll" to create payroll for this month</p>
                    </div>
                )}
            </div>
        );
    };

    const renderSettings = () => (
        <div className="dashboard-section">
            <h2>⚙️ System Settings</h2>
            
            <div style={{ maxWidth: '600px' }}>
                <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px' }}>
                    <h3>Profile Picture</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
                        {getProfilePicture(currentUser) ? (
                            <img 
                                src={getProfilePicture(currentUser)} 
                                alt={currentUser?.name}
                                style={{ 
                                    width: '100px', 
                                    height: '100px', 
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '4px solid #667eea'
                                }}
                            />
                        ) : (
                            <div style={{
                                width: '100px',
                                height: '100px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '2.5rem',
                                fontWeight: 'bold',
                                border: '4px solid #667eea'
                            }}>
                                {getInitials(currentUser?.name)}
                            </div>
                        )}
                        <div>
                            <p style={{ marginBottom: '0.5rem' }}><strong>{currentUser?.name}</strong></p>
                            <button 
                                className="btn-primary" 
                                onClick={() => setShowProfilePicModal(true)}
                                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                            >
                                📷 Change Profile Picture
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px' }}>
                    <h3>Company Information</h3>
                    <p><strong>Company Name:</strong> Ishiaya's Garden</p>
                    <p><strong>System Version:</strong> 1.0.0</p>
                    <p><strong>Database:</strong> Local Storage</p>
                </div>

                <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px' }}>
                    <h3>Data Management</h3>
                    <p style={{ marginBottom: '1rem' }}>Manage your system data</p>
                    <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                        <button className="btn-primary" onClick={() => {
                            const data = JSON.stringify(localDB, null, 2);
                            const blob = new Blob([data], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `ishiaya-backup-${new Date().toISOString().split('T')[0]}.json`;
                            a.click();
                        }}>💾 Export Data (Backup)</button>
                        <button className="btn-secondary" onClick={() => {
                            if (window.confirm('This will clear all data. Are you sure?')) {
                                localStorage.clear();
                                sessionStorage.clear();
                                alert('Data cleared successfully!');
                                navigate('/');
                            }
                        }}>🗑️ Clear All Data</button>
                    </div>
                </div>

                <div style={{ padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px' }}>
                    <h3>Account Settings</h3>
                    <p><strong>Logged in as:</strong> {currentUser?.name}</p>
                    <p><strong>Role:</strong> {currentUser?.role}</p>
                    <p><strong>Email:</strong> {currentUser?.email}</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="dashboard-container">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <img 
                        src={logo} 
                        alt="Ishiaya's Garden Logo" 
                        style={{ 
                            width: '60px', 
                            height: '60px', 
                            marginBottom: '10px',
                            borderRadius: '12px',
                            objectFit: 'contain',
                            background: 'white',
                            padding: '5px'
                        }} 
                    />
                    <h2>Ishiaya's Garden</h2>
                    <p>Owner Dashboard</p>
                </div>
                <ul className="sidebar-menu">
                    <li><a href="#dashboard" className={activeSection === 'dashboard' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveSection('dashboard'); }}>📊 Dashboard</a></li>
                    <li><a href="#employees" className={activeSection === 'employees' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveSection('employees'); }}>👥 Employees</a></li>
                    <li><a href="#reports" className={activeSection === 'reports' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveSection('reports'); }}>📋 Reports</a></li>
                    <li><a href="#payroll" className={activeSection === 'payroll' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveSection('payroll'); }}>💰 Payroll</a></li>
                    <li><a href="#settings" className={activeSection === 'settings' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveSection('settings'); }}>⚙️ Settings</a></li>
                    <li><button onClick={handleLogout}>🚪 Logout</button></li>
                </ul>
            </aside>

            <div className="main-content">
                <header className="top-header">
                    <div className="page-title">
                        <h1>Welcome, {currentUser?.name}</h1>
                        <p>Owner Control Panel</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <button 
                                className="profile-btn" 
                                onClick={() => setShowNotifications(!showNotifications)} 
                                style={{ 
                                    position: 'relative', 
                                    fontSize: '1.5rem',
                                    background: unreadCount > 0 ? '#fff3cd' : 'transparent',
                                    animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none'
                                }}
                            >
                                🔔
                                {unreadCount > 0 && (
                                    <span style={{ 
                                        position: 'absolute', 
                                        top: '-5px', 
                                        right: '-5px', 
                                        background: '#dc3545', 
                                        color: 'white', 
                                        borderRadius: '50%', 
                                        minWidth: '22px', 
                                        height: '22px', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        fontSize: '0.7rem', 
                                        fontWeight: 'bold',
                                        padding: '0 4px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }}>
                                        {unreadCount}
                                    </span>
                                )}
                            </button>
                            {showNotifications && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    background: 'white',
                                    border: '1px solid #ddd',
                                    borderRadius: '12px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                    width: '400px',
                                    maxHeight: '500px',
                                    overflow: 'hidden',
                                    zIndex: 1000,
                                    marginTop: '0.5rem'
                                }}>
                                    <div style={{
                                        padding: '1rem 1.2rem',
                                        borderBottom: '2px solid #f0f0f0',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        position: 'sticky',
                                        top: 0,
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white'
                                    }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>🔔 Notifications</h3>
                                            {unreadCount > 0 && (
                                                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', opacity: 0.9 }}>
                                                    {unreadCount} unread
                                                </p>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {unreadCount > 0 && (
                                                <button 
                                                    onClick={markAllAsRead}
                                                    style={{
                                                        padding: '0.4rem 0.8rem',
                                                        fontSize: '0.75rem',
                                                        background: 'rgba(255,255,255,0.2)',
                                                        color: 'white',
                                                        border: '1px solid rgba(255,255,255,0.3)',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontWeight: '600'
                                                    }}
                                                >
                                                    ✓ Mark all
                                                </button>
                                            )}
                                            <button 
                                                onClick={clearNotifications}
                                                style={{
                                                    padding: '0.4rem 0.8rem',
                                                    fontSize: '0.75rem',
                                                    background: 'rgba(220, 53, 69, 0.9)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                🗑️ Clear
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ maxHeight: '430px', overflowY: 'auto' }}>
                                        {notifications.length === 0 ? (
                                            <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#999' }}>
                                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔕</div>
                                                <p style={{ margin: 0 }}>No notifications yet</p>
                                            </div>
                                        ) : (
                                            <div>
                                                {notifications.map(notif => (
                                                    <div 
                                                        key={notif.id}
                                                        onClick={() => markAsRead(notif.id)}
                                                        style={{
                                                            padding: '1rem 1.2rem',
                                                            borderBottom: '1px solid #f0f0f0',
                                                            background: notif.read ? 'white' : '#f0f7ff',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            position: 'relative'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = '#e6f2ff'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = notif.read ? 'white' : '#f0f7ff'}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem' }}>
                                                            <span style={{ 
                                                                fontSize: '1.8rem',
                                                                flexShrink: 0
                                                            }}>
                                                                {notif.type === 'clock-in' ? '🟢' : '🔴'}
                                                            </span>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                                                    <strong style={{ fontSize: '0.95rem', color: '#333' }}>
                                                                        {notif.type === 'clock-in' ? '✓ Clock In' : '✗ Clock Out'}
                                                                    </strong>
                                                                    {!notif.read && (
                                                                        <span style={{
                                                                            width: '8px',
                                                                            height: '8px',
                                                                            background: '#667eea',
                                                                            borderRadius: '50%',
                                                                            marginLeft: 'auto',
                                                                            animation: 'pulse 2s infinite'
                                                                        }}></span>
                                                                    )}
                                                                </div>
                                                                <p style={{ 
                                                                    margin: '0.3rem 0', 
                                                                    fontSize: '0.9rem',
                                                                    color: '#555',
                                                                    lineHeight: '1.4'
                                                                }}>
                                                                    {notif.message}
                                                                </p>
                                                                <div style={{ 
                                                                    display: 'flex',
                                                                    gap: '1rem',
                                                                    marginTop: '0.5rem'
                                                                }}>
                                                                    <p style={{ 
                                                                        margin: 0, 
                                                                        fontSize: '0.75rem', 
                                                                        color: '#999',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.3rem'
                                                                    }}>
                                                                        🕐 {notif.time}
                                                                    </p>
                                                                    <p style={{ 
                                                                        margin: 0, 
                                                                        fontSize: '0.75rem', 
                                                                        color: '#999',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.3rem'
                                                                    }}>
                                                                        📅 {notif.date}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="header-profile" style={{ position: 'relative' }}>
                            <button 
                                className="profile-btn" 
                                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                {getProfilePicture(currentUser) ? (
                                    <img 
                                        src={getProfilePicture(currentUser)} 
                                        alt={currentUser?.name}
                                        style={{ 
                                            width: '32px', 
                                            height: '32px', 
                                            borderRadius: '50%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold'
                                    }}>
                                        {getInitials(currentUser?.name)}
                                    </div>
                                )}
                                {currentUser?.name || 'Owner'}
                            </button>
                            {showProfileDropdown && (
                                <div className="profile-dropdown">
                                    <button onClick={() => setActiveSection('settings')}>Profile</button>
                                    <button onClick={handleLogout}>Logout</button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="dashboard-content">
                    {renderContent()}
                </div>
            </div>

            {showProfilePicModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '2rem',
                        maxWidth: '500px',
                        width: '90%'
                    }}>
                        <h2 style={{ marginTop: 0 }}>Change Profile Picture</h2>
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            {profilePicPreview ? (
                                <img 
                                    src={profilePicPreview} 
                                    alt="Preview"
                                    style={{ 
                                        width: '150px', 
                                        height: '150px', 
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '4px solid #667eea'
                                    }}
                                />
                            ) : getProfilePicture(currentUser) ? (
                                <img 
                                    src={getProfilePicture(currentUser)} 
                                    alt="Current"
                                    style={{ 
                                        width: '150px', 
                                        height: '150px', 
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '4px solid #ddd'
                                    }}
                                />
                            ) : (
                                <div style={{
                                    width: '150px',
                                    height: '150px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '3rem',
                                    fontWeight: 'bold',
                                    border: '4px solid #ddd'
                                }}>
                                    {getInitials(currentUser?.name)}
                                </div>
                            )}
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ 
                                display: 'block', 
                                marginBottom: '0.5rem',
                                fontWeight: '600'
                            }}>
                                Select New Profile Picture:
                            </label>
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleProfilePicChange}
                                style={{ 
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '2px dashed #ddd',
                                    borderRadius: '8px'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button 
                                className="btn-secondary"
                                onClick={() => {
                                    setShowProfilePicModal(false);
                                    setProfilePicPreview(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn-primary"
                                onClick={handleSaveProfilePic}
                            >
                                💾 Save Picture
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.7;
                        transform: scale(1.1);
                    }
                }
            `}</style>
        </div>
    );
}

export default OwnerDashboard;