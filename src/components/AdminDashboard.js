import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    getAllUsers, 
    getAllAttendance, 
    localDB, 
    saveToLocalStorage, 
    addUser,
    deleteUser,
    getAllEmployeeSchedules,
    getEmployeeSchedule,
    saveEmployeeSchedule,
    getDefaultSchedule,
    calculateDayHours,
    calculateWeeklyHours,
    getWorkingDaysCount
} from '../config/firebase-config';
import '../styles/Dashboard.css';
import logo from '../assets/ishiaya.jpg';

function AdminDashboard() {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('employees');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddEmployee, setShowAddEmployee] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profilePicPreview, setProfilePicPreview] = useState(null);
    
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    

    const [payrollData, setPayrollData] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [showPayrollPreview, setShowPayrollPreview] = useState(false);
    const [generatedPayroll, setGeneratedPayroll] = useState([]);
    const [showFormalReport, setShowFormalReport] = useState(false);
    const [searchPayrollEmployee, setSearchPayrollEmployee] = useState('');
    

    const [employeeSchedules, setEmployeeSchedules] = useState({});
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [editingSchedule, setEditingSchedule] = useState(false);
    const [tempSchedule, setTempSchedule] = useState(null);
    

    const DAILY_RATE = 415.00;
    const OVERTIME_RATE = 415.00 * 0.12; 
    const HOLIDAY_RATE = 124.50;
    const LATE_DEDUCTION = 50.00;
    const SSS_RATE = 0.045;
    const PHILHEALTH_RATE = 0.02;
    const PAGIBIG_RATE = 0.02;
    
    const [newEmployee, setNewEmployee] = useState({
        name: '',
        email: '',
        password: '',
        role: 'employee',
        position: '',
        salary: '',
        profilePic: null
    });

    const [stats, setStats] = useState({
        totalRecords: 0,
        thisMonth: 0,
        activeToday: 0,
        averageDaily: 0
    });

    const loadData = async () => {
        try {
            setLoading(true);
            
            const { loadFromLocalStorage } = await import('../config/firebase-config');
            loadFromLocalStorage();
            
            const usersData = await getAllUsers() || [];
            const attendanceData = await getAllAttendance() || [];
            const schedulesData = await getAllEmployeeSchedules() || {};
            
            setUsers(usersData);
            setAttendance(attendanceData);
            setEmployeeSchedules(schedulesData);

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
            
            const today = new Date().toISOString().split('T')[0];
            const currentMonth = new Date().toISOString().slice(0, 7);
            const totalEmployees = usersData.filter(u => u.role === 'employee').length;
            
            setStats({
                totalRecords: attendanceData.length,
                thisMonth: attendanceData.filter(a => a.date.startsWith(currentMonth)).length,
                activeToday: attendanceData.filter(a => a.date === today).length,
                averageDaily: totalEmployees > 0 ? (attendanceData.length / totalEmployees).toFixed(1) : 0
            });
            
            if (localDB.notifications) {
                const allNotifications = localDB.notifications
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                setNotifications(allNotifications);
                setUnreadCount(allNotifications.filter(n => !n.read).length);
            } else {
                setNotifications([]);
                setUnreadCount(0);
            }
            
            if (localDB && localDB.payroll) {
                setPayrollData(localDB.payroll);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            setUsers([]);
            setAttendance([]);
            setNotifications([]);
            setEmployeeSchedules({});
        } finally {
            setLoading(false);
        }
    };

useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user || user.role !== 'admin') {
        navigate('/');
        return;
    }
    setCurrentUser(user);
    loadData();

    const handleNotificationUpdate = (e) => {
        console.log('🔔 Admin: Notification update detected', e?.detail);
      
        const { loadFromLocalStorage } = require('../config/firebase-config');
        loadFromLocalStorage();
        loadData();
    };
    

    window.addEventListener('notificationUpdate', handleNotificationUpdate);
    
  
    const handleStorageChange = (e) => {
        if (e.key === 'ishiaya_notifications' || e.key === 'notification_trigger' || e.key === 'ishiayaDB') {
            console.log('🔔 Admin: Storage change detected:', e.key);
            loadData();
        }
    };
    window.addEventListener('storage', handleStorageChange);
    

    const pollInterval = setInterval(() => {
        const { loadFromLocalStorage, localDB } = require('../config/firebase-config');
        loadFromLocalStorage();
        
        const currentNotifCount = notifications.length;
        const newNotifCount = localDB.notifications?.length || 0;
        
        if (newNotifCount !== currentNotifCount) {
            console.log('🔔 Admin: New notifications detected via polling');
            loadData();
        }
    }, 3000);
    
    return () => {
        window.removeEventListener('notificationUpdate', handleNotificationUpdate);
        window.removeEventListener('storage', handleStorageChange);
        clearInterval(pollInterval);
    };
}, [navigate, notifications.length]);

    const getProfilePicture = (user) => {
        if (user?.profilePic) return user.profilePic;
        if (user?.profilePicture) return user.profilePicture;
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

    const handleProfilePicChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePicPreview(reader.result);
                setNewEmployee({...newEmployee, profilePic: reader.result});
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpdateProfilePic = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const { updateUserProfilePicture } = await import('../config/firebase-config');
                    await updateUserProfilePicture(currentUser.id, reader.result);
                    const updatedUser = { 
                        ...currentUser, 
                        profilePic: reader.result, 
                        profilePicture: reader.result 
                    };
                    setCurrentUser(updatedUser);
                    sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
                    alert('Profile picture updated successfully!');
                    setShowProfileModal(false);
                    await loadData();
                } catch (error) {
                    console.error('Error updating profile picture:', error);
                    alert('Failed to update profile picture: ' + error.message);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            const notifIndex = localDB.notifications.findIndex(n => n.id === notificationId);
            if (notifIndex !== -1) {
                localDB.notifications[notifIndex].read = true;
                await saveToLocalStorage();
                loadData();
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            if (localDB.notifications) {
                localDB.notifications.forEach(n => n.read = true);
                await saveToLocalStorage();
                loadData();
            }
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const clearNotifications = async () => {
        try {
            if (window.confirm('Clear all notifications?')) {
                localDB.notifications = [];
                await saveToLocalStorage();
                loadData();
            }
        } catch (error) {
            console.error('Error clearing notifications:', error);
        }
    };

    const handleAddEmployee = async (e) => {
        e.preventDefault();
        try {
            const allUsers = await getAllUsers();
            const emailExists = allUsers.some(u => u.email === newEmployee.email);
            if (emailExists) {
                alert('Email already exists!');
                return;
            }

            await addUser({
                name: newEmployee.name,
                email: newEmployee.email,
                password: newEmployee.password,
                role: 'employee',
                position: newEmployee.position,
                salary: newEmployee.salary,
                profilePic: newEmployee.profilePic,
                profilePicture: newEmployee.profilePic
            });

            alert('Employee added successfully!');
            setShowAddEmployee(false);
            setNewEmployee({
                name: '',
                email: '',
                password: '',
                role: 'employee',
                position: '',
                salary: '',
                profilePic: null
            });
            setProfilePicPreview(null);
            await loadData();
        } catch (error) {
            console.error('Error adding employee:', error);
            alert('Failed to add employee: ' + error.message);
        }
    };

    const handleDeleteEmployee = async (employeeId, employeeName) => {
        if (window.confirm(`⚠️ Are you sure you want to delete ${employeeName}?\n\nThis will permanently delete:\n• Employee profile\n• All attendance records\n• Work schedule\n\n⚠️ This action CANNOT be undone!`)) {
            try {
                await deleteUser(employeeId);
                alert('✅ Employee deleted successfully!');
                await loadData();
            } catch (error) {
                console.error('Error deleting employee:', error);
                alert('❌ Failed to delete employee: ' + error.message);
            }
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('currentUser');
        navigate('/');
    };

    const handleScheduleChange = (day, field, value) => {
        if (!tempSchedule) return;
        
        setTempSchedule(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                [field]: value
            }
        }));
    };

    const handleSaveSchedule = async () => {
        if (!selectedEmployee || !tempSchedule) return;
        
        try {
            await saveEmployeeSchedule(selectedEmployee.id, tempSchedule);
            alert('✅ Schedule saved successfully!');
            setEditingSchedule(false);
            setEmployeeSchedules(prev => ({
                ...prev,
                [selectedEmployee.id]: tempSchedule
            }));
            await loadData();
        } catch (error) {
            console.error('Error saving schedule:', error);
            alert('❌ Failed to save schedule: ' + error.message);
        }
    };

    const handleEditSchedule = async (employee) => {
        setSelectedEmployee(employee);
        const schedule = await getEmployeeSchedule(employee.id);
        setTempSchedule(schedule);
        setEditingSchedule(true);
    };

    const handleCancelEdit = () => {
        setEditingSchedule(false);
        setTempSchedule(null);
        setSelectedEmployee(null);
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

    const filteredUsers = users
        .filter(u => u.role === 'employee')
        .filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const todayAttendance = attendance.filter(a => 
        a.date === new Date().toISOString().split('T')[0]
    );

    const renderScheduleTab = () => {
        const getDayColor = (enabled) => {
            return enabled ? '#e8f5e9' : '#f5f5f5';
        };

        return (
            <div className="dashboard-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2>📅 Employee Schedule Management</h2>
                    {editingSchedule && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                                className="btn-primary"
                                onClick={handleSaveSchedule}
                                style={{ background: '#4CAF50' }}
                            >
                                💾 Save Schedule
                            </button>
                            <button 
                                className="btn-secondary"
                                onClick={handleCancelEdit}
                            >
                                ✖ Cancel
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: editingSchedule ? '300px 1fr' : '1fr', gap: '1.5rem' }}>
                    <div style={{ 
                        background: 'white', 
                        padding: '1.5rem', 
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        maxHeight: editingSchedule ? '600px' : 'none',
                        overflowY: editingSchedule ? 'auto' : 'visible'
                    }}>
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            👥 Employees
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {filteredUsers.map(emp => {
                                const schedule = employeeSchedules[emp.id] || getDefaultSchedule();
                                const weeklyHours = calculateWeeklyHours(schedule);
                                const workingDays = getWorkingDaysCount(schedule);
                                
                                return (
                                    <button
                                        key={emp.id}
                                        onClick={() => {
                                            if (!editingSchedule) {
                                                handleEditSchedule(emp);
                                            }
                                        }}
                                        style={{
                                            padding: '1rem',
                                            border: selectedEmployee?.id === emp.id ? '2px solid #667eea' : '1px solid #e0e0e0',
                                            borderRadius: '8px',
                                            background: selectedEmployee?.id === emp.id ? '#f0f4ff' : 'white',
                                            cursor: editingSchedule ? 'default' : 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!editingSchedule && selectedEmployee?.id !== emp.id) {
                                                e.currentTarget.style.borderColor = '#667eea';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!editingSchedule && selectedEmployee?.id !== emp.id) {
                                                e.currentTarget.style.borderColor = '#e0e0e0';
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                            {getProfilePicture(emp) ? (
                                                <img 
                                                    src={getProfilePicture(emp)} 
                                                    alt={emp.name}
                                                    style={{ 
                                                        width: '40px', 
                                                        height: '40px', 
                                                        borderRadius: '50%',
                                                        objectFit: 'cover',
                                                        border: '2px solid #667eea'
                                                    }}
                                                />
                                            ) : (
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'white',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 'bold',
                                                    border: '2px solid #667eea'
                                                }}>
                                                    {getInitials(emp.name)}
                                                </div>
                                            )}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 'bold', color: '#333' }}>{emp.name}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#666' }}>{emp.position || 'Employee'}</div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e0e0e0' }}>
                                            <div>📅 {workingDays} days/week</div>
                                            <div>⏰ {weeklyHours.toFixed(1)} hrs/week</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {editingSchedule && selectedEmployee && tempSchedule && (
                        <div style={{ 
                            background: 'white', 
                            padding: '1.5rem', 
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: '0 0 0.5rem 0' }}>{selectedEmployee.name}'s Schedule</h3>
                                <p style={{ margin: 0, color: '#666' }}>{selectedEmployee.position || 'Employee'}</p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {Object.entries(tempSchedule).map(([day, schedule]) => (
                                    <div
                                        key={day}
                                        style={{
                                            border: '2px solid',
                                            borderColor: schedule.enabled ? '#4CAF50' : '#e0e0e0',
                                            borderRadius: '8px',
                                            padding: '1rem',
                                            background: getDayColor(schedule.enabled),
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={schedule.enabled}
                                                onChange={(e) => handleScheduleChange(day, 'enabled', e.target.checked)}
                                                style={{ 
                                                    width: '20px', 
                                                    height: '20px',
                                                    cursor: 'pointer',
                                                    marginTop: '0.2rem'
                                                }}
                                            />

                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ 
                                                    margin: '0 0 0.75rem 0', 
                                                    textTransform: 'capitalize',
                                                    color: schedule.enabled ? '#333' : '#999'
                                                }}>
                                                    {day}
                                                </h4>

                                                {schedule.enabled ? (
                                                    <div style={{ 
                                                        display: 'grid', 
                                                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                                                        gap: '1rem' 
                                                    }}>
                                                        <div>
                                                            <label style={{ 
                                                                display: 'block', 
                                                                fontSize: '0.85rem', 
                                                                fontWeight: '600',
                                                                marginBottom: '0.3rem',
                                                                color: '#555'
                                                            }}>
                                                                Start Time
                                                            </label>
                                                            <input
                                                                type="time"
                                                                value={schedule.start}
                                                                onChange={(e) => handleScheduleChange(day, 'start', e.target.value)}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '0.5rem',
                                                                    border: '1px solid #ddd',
                                                                    borderRadius: '4px',
                                                                    fontSize: '0.95rem'
                                                                }}
                                                            />
                                                        </div>

                                                        <div>
                                                            <label style={{ 
                                                                display: 'block', 
                                                                fontSize: '0.85rem', 
                                                                fontWeight: '600',
                                                                marginBottom: '0.3rem',
                                                                color: '#555'
                                                            }}>
                                                                End Time
                                                            </label>
                                                            <input
                                                                type="time"
                                                                value={schedule.end}
                                                                onChange={(e) => handleScheduleChange(day, 'end', e.target.value)}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '0.5rem',
                                                                    border: '1px solid #ddd',
                                                                    borderRadius: '4px',
                                                                    fontSize: '0.95rem'
                                                                }}
                                                            />
                                                        </div>

                                                        <div>
                                                            <label style={{ 
                                                                display: 'block', 
                                                                fontSize: '0.85rem', 
                                                                fontWeight: '600',
                                                                marginBottom: '0.3rem',
                                                                color: '#555'
                                                            }}>
                                                                Break (optional)
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={schedule.break}
                                                                placeholder="12:00-13:00"
                                                                onChange={(e) => handleScheduleChange(day, 'break', e.target.value)}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '0.5rem',
                                                                    border: '1px solid #ddd',
                                                                    borderRadius: '4px',
                                                                    fontSize: '0.95rem'
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p style={{ margin: 0, color: '#999', fontStyle: 'italic' }}>Rest Day</p>
                                                )}

                                                {schedule.enabled && schedule.start && schedule.end && (
                                                    <div style={{ 
                                                        marginTop: '0.5rem', 
                                                        fontSize: '0.85rem', 
                                                        color: '#666',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem'
                                                    }}>
                                                        ⏱️ Total: {formatCurrency(calculateDayHours(schedule.start, schedule.end))} hours
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ 
                                marginTop: '1.5rem', 
                                padding: '1rem', 
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                borderRadius: '8px',
                                color: 'white'
                            }}>
                                <h4 style={{ margin: '0 0 0.75rem 0' }}>📊 Weekly Summary</h4>
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                                    gap: '1rem' 
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Working Days</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                            {getWorkingDaysCount(tempSchedule)}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Total Hours</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                            {calculateWeeklyHours(tempSchedule).toFixed(1)} hrs
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Avg Hours/Day</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                            {getWorkingDaysCount(tempSchedule) > 0 
                                                ? (calculateWeeklyHours(tempSchedule) / getWorkingDaysCount(tempSchedule)).toFixed(1)
                                                : '0'} hrs
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!editingSchedule && (
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            minHeight: '400px',
                            background: 'white',
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ textAlign: 'center', color: '#999' }}>
                                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📅</div>
                                <h3>Select an employee to manage their schedule</h3>
                                <p>Click on any employee from the list to view and edit their work schedule</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderPayrollTab = () => {
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
                            <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FDFDFDFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
                                <h4>Total Employees</h4>
                                <p className="stat-number">{filteredPayroll.length}</p>
                            </div>
                            <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
                                <h4>Total Basic Pay</h4>
                                <p className="stat-number">₱{formatCurrency(totals.basicPay)}</p>
                            </div>
                            <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
                                <h4>Total Deductions</h4>
                                <p className="stat-number">₱{formatCurrency(totals.totalDeductions)}</p>
                            </div>
                            <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
                                <h4>Total Net Pay</h4>
                                <p className="stat-number">₱{formatCurrency(totals.netPay)}</p>
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
                                                        background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)',
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
                                        <td style={{ color: '#FFFFFFFF' }}>₱{formatCurrency(emp.totalDeductions)}</td>
                                        <td style={{ color: '#FFFFFFFF', fontWeight: '600' }}>₱{formatCurrency(emp.netPay)}</td>
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
                ) : !showPayrollPreview && (
                    <div style={{ textAlign: 'center', padding: '3rem', background: '#f8f9fa', borderRadius: '8px' }}>
                        <p>No payroll generated for {selectedMonth}</p>
                        <p>Click "Generate Payroll" to create payroll for this month</p>
                    </div>
                )}
            </div>
        );
    };

    const renderReportsTab = () => {
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
                            <p className="stat-number">{stats.totalRecords}</p>
                        </div>
                        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
                            <h3>This Month</h3>
                            <p className="stat-number">{stats.thisMonth}</p>
                        </div>
                        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
                            <h3>Active Today</h3>
                            <p className="stat-number">{stats.activeToday}</p>
                        </div>
                        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
                            <h3>Average Daily</h3>
                            <p className="stat-number">{stats.averageDaily}</p>
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
                                            <img 
                                                src={emp.profilePic} 
                                                alt={emp.name}
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
                                        padding: '0.3rem 0.8rem',
                                        borderRadius: '12px',
                                        background: emp.status === 'Clocked In' ? '#d4edda' : emp.status === 'Clocked Out' ? '#d1ecf1' : '#f8d7da',
                                        color: emp.status === 'Clocked In' ? '#155724' : emp.status === 'Clocked Out' ? '#0c5460' : '#721c24',
                                        fontSize: '0.85rem',
                                        fontWeight: '600'
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
    <p>Admin Dashboard</p>
</div>
                <ul className="sidebar-menu">
                    <li><a href="#employees" className={activeTab === 'employees' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('employees'); }}>👥 Employees</a></li>
                    <li><a href="#attendance" className={activeTab === 'attendance' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('attendance'); }}>📋 Attendance</a></li>
                    <li><a href="#reports" className={activeTab === 'reports' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('reports'); }}>📊 Reports</a></li>
                    <li><a href="#payroll" className={activeTab === 'payroll' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('payroll'); }}>💰 Payroll</a></li>
                    <li><a href="#schedules" className={activeTab === 'schedules' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('schedules'); }}>📅 Schedules</a></li>
                    <li><button onClick={handleLogout}>🚪 Logout</button></li>
                </ul>
            </aside>

            <div className="main-content">
                <header className="top-header">
                    <div className="page-title">
                        <h1>Welcome, {currentUser?.name}</h1>
                        <p>Admin Control Panel</p>
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
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.5rem'
                                }}
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
                                <span>{currentUser?.name || 'Admin'}</span>
                            </button>
                            {showProfileDropdown && (
                                <div className="profile-dropdown">
                                    <button onClick={() => setShowProfileModal(true)}>👤 Profile Settings</button>
                                    <button onClick={handleLogout}>🚪 Logout</button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {showProfileModal && (
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
                            <h2 style={{ marginBottom: '1.5rem' }}>Profile Settings</h2>
                            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                                {getProfilePicture(currentUser) ? (
                                    <img 
                                        src={getProfilePicture(currentUser)} 
                                        alt={currentUser?.name}
                                        style={{ 
                                            width: '150px', 
                                            height: '150px', 
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                            border: '4px solid #667eea',
                                            margin: '0 auto 1rem'
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '150px',
                                        height: '150px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontSize: '3rem',
                                        fontWeight: 'bold',
                                        border: '4px solid #667eea',
                                        margin: '0 auto 1rem'
                                    }}>
                                        {getInitials(currentUser?.name)}
                                    </div>
                                )}
                                <label style={{
                                    display: 'inline-block',
                                    padding: '0.5rem 1rem',
                                    background: '#667eea',
                                    color: 'white',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}>
                                    📷 Change Photo
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={handleUpdateProfilePic}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <p><strong>Name:</strong> {currentUser?.name}</p>
                                <p><strong>Email:</strong> {currentUser?.email}</p>
                                <p><strong>Role:</strong> Administrator</p>
                            </div>
                            <button 
                                onClick={() => setShowProfileModal(false)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    background: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}

                <div className="dashboard-content">
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                            <h2>Loading...</h2>
                        </div>
                    ) : (
                        <>
                            <div className="stats-grid">
                                <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%#FFFFFFFFa2 100%)', color: 'white' }}>
                                    <h3>Total Employees</h3>
                                    <p className="stat-number">{users.filter(u => u.role === 'employee').length}</p>
                                </div>
                                <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
                                    <h3>Present Today</h3>
                                    <p className="stat-number">{todayAttendance.length}</p>
                                </div>
                                <div className="stat-card" style={{ background: 'linear-gradient(135deg, #FFFFFFFF 0%, #FFFFFFFF 100%)', color: 'white' }}>
                                    <h3>Total Records</h3>
                                    <p className="stat-number">{attendance.length}</p>
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
                                                    <div style={{ 
                                                        display: 'flex',
                                                        gap: '1rem',
                                                        marginTop: '0.4rem'
                                                    }}>
                                                        <span style={{ fontSize: '0.75rem', color: '#999' }}>
                                                            🕐 {notif.time}
                                                        </span>
                                                        <span style={{ fontSize: '0.75rem', color: '#999' }}>
                                                            📅 {notif.date}
                                                        </span>
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

                            <div className="tabs">
                                <button 
                                    className={activeTab === 'employees' ? 'active' : ''}
                                    onClick={() => setActiveTab('employees')}
                                >
                                    👥 Employees
                                </button>
                                <button 
                                    className={activeTab === 'attendance' ? 'active' : ''}
                                    onClick={() => setActiveTab('attendance')}
                                >
                                    📋 Attendance
                                </button>
                                <button 
                                    className={activeTab === 'reports' ? 'active' : ''}
                                    onClick={() => setActiveTab('reports')}
                                >
                                    📊 Reports
                                </button>
                                <button 
                                    className={activeTab === 'payroll' ? 'active' : ''}
                                    onClick={() => setActiveTab('payroll')}
                                >
                                    💰 Payroll
                                </button>
                                <button 
                                    className={activeTab === 'schedules' ? 'active' : ''}
                                    onClick={() => setActiveTab('schedules')}
                                >
                                    📅 Schedules
                                </button>
                            </div>

                            {activeTab === 'employees' && (
                                <div className="dashboard-section">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <h2>Employee Management</h2>
                                        <button 
                                            className="btn-primary"
                                            onClick={() => setShowAddEmployee(!showAddEmployee)}
                                        >
                                            {showAddEmployee ? '✖ Cancel' : '➕ Add Employee'}
                                        </button>
                                    </div>

                                    {showAddEmployee && (
                                        <form onSubmit={handleAddEmployee} style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px' }}>
                                            <h3>Add New Employee</h3>
                                            
                                            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                                {profilePicPreview ? (
                                                    <img 
                                                        src={profilePicPreview} 
                                                        alt="Preview"
                                                        style={{ 
                                                            width: '120px', 
                                                            height: '120px', 
                                                            borderRadius: '50%',
                                                            objectFit: 'cover',
                                                            border: '3px solid #667eea',
                                                            margin: '0 auto 1rem'
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        width: '120px',
                                                        height: '120px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        fontSize: '3rem',
                                                        fontWeight: 'bold',
                                                        border: '3px solid #667eea',
                                                        margin: '0 auto 1rem'
                                                    }}>
                                                        📷
                                                    </div>
                                                )}
                                                <br />
                                                <label style={{
                                                    display: 'inline-block',
                                                    padding: '0.5rem 1rem',
                                                    background: '#667eea',
                                                    color: 'white',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.9rem'
                                                }}>
                                                    📷 Upload Photo
                                                    <input 
                                                        type="file" 
                                                        accept="image/*"
                                                        onChange={handleProfilePicChange}
                                                        style={{ display: 'none' }}
                                                    />
                                                </label>
                                            </div>

                                            <div className="form-group">
                                                <label>Name:</label>
                                                <input
                                                    type="text"
                                                    value={newEmployee.name}
                                                    onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Email:</label>
                                                <input
                                                    type="email"
                                                    value={newEmployee.email}
                                                    onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Password:</label>
                                                <input
                                                    type="password"
                                                    value={newEmployee.password}
                                                    onChange={(e) => setNewEmployee({...newEmployee, password: e.target.value})}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Position:</label>
                                                <input
                                                    type="text"
                                                    value={newEmployee.position}
                                                    onChange={(e) => setNewEmployee({...newEmployee, position: e.target.value})}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Salary:</label>
                                                <input
                                                    type="number"
                                                    value={newEmployee.salary}
                                                    onChange={(e) => setNewEmployee({...newEmployee, salary: e.target.value})}
                                                    required
                                                />
                                            </div>
                                            <button type="submit" className="btn-primary">💾 Save Employee</button>
                                        </form>
                                    )}

                                    <div className="search-bar">
                                        <input
                                            type="text"
                                            placeholder="🔍 Search employees..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>

                                   <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Photo</th>
                                                <th>Name</th>
                                                <th>Email</th>
                                                <th>Position</th>
                                                <th>Salary</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                                                        No employees found
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredUsers.map(user => (
                                                    <tr key={user.id}>
                                                        <td>
                                                            {getProfilePicture(user) ? (
                                                                <img 
                                                                    src={getProfilePicture(user)} 
                                                                    alt={user.name}
                                                                    style={{ 
                                                                        width: '45px', 
                                                                        height: '45px', 
                                                                        borderRadius: '50%',
                                                                        objectFit: 'cover',
                                                                        border: '2px solid #667eea',
                                                                        display: 'block',
                                                                        margin: '0 auto'
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div style={{
                                                                    width: '45px',
                                                                    height: '45px',
                                                                    borderRadius: '50%',
                                                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    color: 'white',
                                                                    fontSize: '1rem',
                                                                    fontWeight: 'bold',
                                                                    border: '2px solid #667eea',
                                                                    margin: '0 auto'
                                                                }}>
                                                                    {getInitials(user.name)}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>{user.name}</td>
                                                        <td>{user.email}</td>
                                                        <td>{user.position || 'N/A'}</td>
                                                        <td>₱{user.salary || '0'}</td>
                                                        <td>
                                                            <span style={{
                                                                padding: '0.3rem 0.8rem',
                                                                borderRadius: '12px',
                                                                background: '#d4edda',
                                                                color: '#155724',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600'
                                                            }}>
                                                                ✓ Active
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <button
                                                                onClick={() => handleDeleteEmployee(user.id, user.name)}
                                                                style={{
                                                                    padding: '0.4rem 0.8rem',
                                                                    background: '#dc3545',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: '600'
                                                                }}
                                                                onMouseEnter={(e) => e.target.style.background = '#c82333'}
                                                                onMouseLeave={(e) => e.target.style.background = '#dc3545'}
                                                            >
                                                                🗑️ Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {activeTab === 'attendance' && (
                                <div className="dashboard-section">
                                    <h2>📋 Attendance Records</h2>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Photo</th>
                                                <th>Employee</th>
                                                <th>Date</th>
                                                <th>Time In</th>
                                                <th>Time Out</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {attendance.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                                                        No attendance records yet
                                                    </td>
                                                </tr>
                                            ) : (
                                                attendance.slice(-20).reverse().map((record, index) => {
                                                    const user = users.find(u => u.id === record.userId);
                                                    return (
                                                        <tr key={index}>
                                                            <td>
                                                                {getProfilePicture(user) ? (
                                                                    <img 
                                                                        src={getProfilePicture(user)} 
                                                                        alt={user?.name}
                                                                        style={{ 
                                                                            width: '40px', 
                                                                            height: '40px', 
                                                                            borderRadius: '50%',
                                                                            objectFit: 'cover',
                                                                            border: '2px solid #667eea',
                                                                            display: 'block',
                                                                            margin: '0 auto'
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div style={{
                                                                        width: '40px',
                                                                        height: '40px',
                                                                        borderRadius: '50%',
                                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        color: 'white',
                                                                        fontSize: '0.85rem',
                                                                        fontWeight: 'bold',
                                                                        border: '2px solid #667eea',
                                                                        margin: '0 auto'
                                                                    }}>
                                                                        {getInitials(user?.name)}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td>{user?.name || 'Unknown'}</td>
                                                            <td>{record.date}</td>
                                                            <td>{record.timeIn}</td>
                                                            <td>{record.timeOut || 'Not yet'}</td>
                                                            <td>
                                                                <span style={{
                                                                    padding: '0.3rem 0.8rem',
                                                                    borderRadius: '12px',
                                                                    background: record.status === 'Present' ? '#d4edda' : '#f8d7da',
                                                                    color: record.status === 'Present' ? '#155724' : '#721c24',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: '600'
                                                                }}>
                                                                    {record.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {activeTab === 'reports' && renderReportsTab()}
                            {activeTab === 'payroll' && renderPayrollTab()}
                            {activeTab === 'schedules' && renderScheduleTab()}
                        </>
                    )}   
                </div>
            </div>

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

                .stat-card h3 {
                    margin: 0 0 0.5rem 0;
                    font-size: 0.9rem;
                    font-weight: 600;
                    opacity: 0.95;
                }

                .stat-card .stat-number {
                    margin: 0;
                    font-size: 2.5rem;
                    font-weight: bold;
                }
            `}</style>
        </div>
    );
}

export default AdminDashboard;