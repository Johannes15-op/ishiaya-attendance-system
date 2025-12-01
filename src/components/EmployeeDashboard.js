import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    getAllAttendance,
    getEmployeeSchedule,
    calculateDayHours,
    calculateWeeklyHours,
    getWorkingDaysCount,
    listenToScheduleChanges,
    requestNotificationPermission
} from '../config/firebase-config';
import '../styles/Dashboard.css';

function EmployeeDashboard() {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [myAttendance, setMyAttendance] = useState([]);
    const [mySchedule, setMySchedule] = useState(null);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isClockedIn, setIsClockedIn] = useState(false);
    const [todayRecord, setTodayRecord] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [activeSection, setActiveSection] = useState('dashboard');
    const [showScheduleUpdateAlert, setShowScheduleUpdateAlert] = useState(false);

    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({
        name: '',
        email: '',
        position: '',
        phone: '',
        address: ''
    });


    const loadMySchedule = async (userId) => {
        try {
            console.log('📅 Loading schedule for employee:', userId);
            const schedule = await getEmployeeSchedule(userId);
            setMySchedule(schedule);
            console.log('✅ Schedule loaded:', schedule);
        } catch (error) {
            console.error('❌ Error loading schedule:', error);
        }
    };

    const loadData = useCallback(async (user) => {
        try {
            setLoading(true);
            const attendanceData = await getAllAttendance() || [];

            const myRecords = attendanceData.filter(a => a.userId === user.id);
            setMyAttendance(myRecords);

            const today = new Date().toISOString().split('T')[0];
            const todayRec = myRecords.find(a => a.date === today);
            
            if (todayRec) {
                setTodayRecord(todayRec);
                const clockedIn = !todayRec.timeOut;
                setIsClockedIn(clockedIn);
            } else {
                setTodayRecord(null);
                setIsClockedIn(false);
            }

          
            await loadMySchedule(user.id);
        } catch (error) {
            console.error('Error loading data:', error);
            setMyAttendance([]);
            setTodayRecord(null);
            setIsClockedIn(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!user || user.role !== 'employee') {
            navigate('/');
            return;
        }
        
        setCurrentUser(user);
        setProfileForm({
            name: user.name || '',
            email: user.email || '',
            position: user.position || '',
            phone: user.phone || '',
            address: user.address || ''
        });
        loadData(user);

       
        requestNotificationPermission();

       
        const unsubscribe = listenToScheduleChanges(user.id, (newSchedule) => {
            console.log('🔔 Your schedule was updated!');
            setMySchedule(newSchedule);
            setShowScheduleUpdateAlert(true);
            
            
            setTimeout(() => {
                setShowScheduleUpdateAlert(false);
            }, 5000);
        });
        
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        
        return () => {
            clearInterval(timer);
            if (unsubscribe) unsubscribe();
        };
    }, [navigate, loadData]);

    const handleClockIn = async () => {
        try {
            console.log('⏰ Starting clock in process...');
            
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const time = now.toTimeString().split(' ')[0];

            const { addAttendance, addNotification, saveToLocalStorage } = await import('../config/firebase-config');

            console.log('📍 Clock in details:', { userId: currentUser.id, date: today, time });

           
            const attendanceId = await addAttendance({
                userId: currentUser.id,
                date: today,
                timeIn: time,
                timeOut: null,
                status: 'Present'
            });

            console.log('✅ Attendance record created:', attendanceId);

            
            const notification = await addNotification({
                type: 'clock-in',
                employeeId: currentUser.id,
                employeeName: currentUser.name,
                employeePosition: currentUser.position || 'Employee',
                message: `${currentUser.name} clocked in at ${time}`,
                time: time,
                date: today,
                read: false
            });

            console.log('✅ Notification created:', notification);
            
            
            saveToLocalStorage('notifications', notification);
            
            
            window.dispatchEvent(new CustomEvent('notificationUpdate', { 
                detail: { 
                    type: 'clock-in',
                    employeeName: currentUser.name,
                    time: time,
                    timestamp: Date.now()
                } 
            }));
            
           
            localStorage.setItem('notification_trigger', JSON.stringify({
                timestamp: Date.now(),
                type: 'clock-in',
                employeeName: currentUser.name,
                time: time
            }));
            
           
            const newRecord = {
                id: attendanceId,
                userId: currentUser.id,
                date: today,
                timeIn: time,
                timeOut: null,
                status: 'Present'
            };
            
          
            setTodayRecord(newRecord);
            setIsClockedIn(true);
            
            console.log('✅ State updated - isClockedIn:', true);
            console.log('📊 Notification saved, admins should see it now');

            alert('✅ Clocked in successfully!\n\n📢 Admin and Owner have been notified.');
            
         
            await loadData(currentUser);
        } catch (error) {
            console.error('❌ Error clocking in:', error);
            alert('Failed to clock in: ' + error.message);
        }
    };

    const handleClockOut = async () => {
        if (!todayRecord || !todayRecord.id) {
            alert('❌ Error: No clock-in record found. Please contact your administrator.');
            return;
        }

        try {
            console.log('⏰ Starting clock out process...');
            console.log('📍 Today record:', todayRecord);
            
            const now = new Date();
            const time = now.toTimeString().split(' ')[0];
            const today = now.toISOString().split('T')[0];

            const { updateAttendance, addNotification, saveToLocalStorage } = await import('../config/firebase-config');

            console.log('📍 Clock out details:', { attendanceId: todayRecord.id, time });

           
            await updateAttendance(todayRecord.id, {
                timeOut: time
            });

            console.log('✅ Attendance record updated');

         
            const notification = await addNotification({
                type: 'clock-out',
                employeeId: currentUser.id,
                employeeName: currentUser.name,
                employeePosition: currentUser.position || 'Employee',
                message: `${currentUser.name} clocked out at ${time}`,
                time: time,
                date: today,
                read: false
            });

            console.log('✅ Notification created:', notification);
            
            
            saveToLocalStorage('notifications', notification);
            
          
            window.dispatchEvent(new CustomEvent('notificationUpdate', { 
                detail: { 
                    type: 'clock-out',
                    employeeName: currentUser.name,
                    time: time,
                    timestamp: Date.now()
                } 
            }));
            
           
            localStorage.setItem('notification_trigger', JSON.stringify({
                timestamp: Date.now(),
                type: 'clock-out',
                employeeName: currentUser.name,
                time: time
            }));

          
            const updatedRecord = { ...todayRecord, timeOut: time };
            setTodayRecord(updatedRecord);
            setIsClockedIn(false);

            console.log('✅ State updated - isClockedIn:', false);

            alert('✅ Clocked out successfully!\n\n📢 Admin and Owner have been notified.');
            
            
            await loadData(currentUser);
        } catch (error) {
            console.error('❌ Error clocking out:', error);
            console.error('❌ Error details:', error.code, error.message);
            
            
            if (error.code === 'permission-denied') {
                alert('❌ Permission denied. Please contact your administrator to check Firebase security rules.');
            } else if (error.message.includes('Missing or insufficient permissions')) {
                alert('❌ Permission error. Your account may not have proper access rights. Please contact your administrator.');
            } else {
                alert('❌ Failed to clock out: ' + error.message);
            }
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            const { updateUser } = await import('../config/firebase-config');

            await updateUser(currentUser.id, profileForm);

            const updatedUser = {
                ...currentUser,
                ...profileForm
            };
            sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
            setCurrentUser(updatedUser);

            console.log('✅ Profile updated successfully');
            alert('Profile updated successfully!');
            setIsEditingProfile(false);
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile: ' + error.message);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('currentUser');
        navigate('/');
    };

    const calculateHours = (timeIn, timeOut) => {
        if (!timeOut) return 'N/A';
        const [inH, inM] = timeIn.split(':').map(Number);
        const [outH, outM] = timeOut.split(':').map(Number);
        const hours = outH - inH + (outM - inM) / 60;
        return hours.toFixed(2) + ' hrs';
    };

    const formatTime = (time) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const getThisWeekSchedule = () => {
        if (!mySchedule) return [];
        
        const today = new Date();
        const currentDay = today.getDay();
        const weekSchedule = [];
        
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - currentDay);
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            
            const dayName = dayNames[i];
            const daySchedule = mySchedule[dayName];
            
            const dateStr = date.toISOString().split('T')[0];
            const isPast = date < today && date.toDateString() !== today.toDateString();
            const isToday = date.toDateString() === today.toDateString();
            
            weekSchedule.push({
                day: dayLabels[i],
                date: dateStr,
                shift: daySchedule.enabled 
                    ? `${formatTime(daySchedule.start)} - ${formatTime(daySchedule.end)}`
                    : 'Rest Day',
                hours: daySchedule.enabled 
                    ? calculateDayHours(daySchedule.start, daySchedule.end).toFixed(1) + ' hours'
                    : '-',
                status: isPast ? 'Attended' : isToday ? 'Today' : 'Scheduled',
                enabled: daySchedule.enabled,
                break: daySchedule.break || '-'
            });
        }
        
        return weekSchedule;
    };

    const getRegularHours = () => {
        if (!mySchedule) return [];
        
        const workingDays = [];
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        dayNames.forEach(day => {
            if (mySchedule[day]?.enabled) {
                workingDays.push({
                    day: day.charAt(0).toUpperCase() + day.slice(1),
                    start: mySchedule[day].start,
                    end: mySchedule[day].end
                });
            }
        });

        const groups = [];
        let currentGroup = null;

        workingDays.forEach((day) => {
            if (!currentGroup || 
                currentGroup.start !== day.start || 
                currentGroup.end !== day.end) {
                if (currentGroup) groups.push(currentGroup);
                currentGroup = {
                    days: [day.day],
                    start: day.start,
                    end: day.end
                };
            } else {
                currentGroup.days.push(day.day);
            }
        });
        if (currentGroup) groups.push(currentGroup);

        return groups;
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
            case 'attendance':
                return renderAttendance();
            case 'schedule':
                return renderSchedule();
            case 'profile':
                return renderProfile();
            default:
                return renderDashboard();
        }
    };

    const renderDashboard = () => (
        <>
            <div className="stats-grid">
                <div className="stat-card">
                    <h3>Total Days Worked</h3>
                    <p className="stat-number">{myAttendance.length}</p>
                </div>
                <div className="stat-card">
                    <h3>This Month</h3>
                    <p className="stat-number">
                        {myAttendance.filter(a => 
                            a.date.startsWith(new Date().toISOString().slice(0, 7))
                        ).length}
                    </p>
                </div>
                <div className="stat-card">
                    <h3>Status Today</h3>
                    <p className="stat-number" style={{ fontSize: '1.5rem' }}>
                        {isClockedIn ? '✓ Clocked In' : '✗ Not Clocked In'}
                    </p>
                </div>
                <div className="stat-card">
                    <h3>Position</h3>
                    <p className="stat-number" style={{ fontSize: '1.5rem' }}>
                        {currentUser?.position || 'Employee'}
                    </p>
                </div>
            </div>

            <div className="dashboard-section">
                <h2>Time Clock</h2>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#667eea', fontWeight: 'bold' }}>
                        {currentTime.toLocaleTimeString()}
                    </div>
                    <div style={{ fontSize: '1.5rem', marginBottom: '2rem', color: '#7f8c8d' }}>
                        {currentTime.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        })}
                    </div>
                    {!isClockedIn ? (
                        <button 
                            className="btn-primary" 
                            onClick={handleClockIn}
                            style={{ fontSize: '1.2rem', padding: '1rem 3rem' }}
                        >
                            🕐 Clock In
                        </button>
                    ) : (
                        <div>
                            <p style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>
                                Clocked in at: <strong>{todayRecord?.timeIn}</strong>
                            </p>
                            <button 
                                className="btn-secondary" 
                                onClick={handleClockOut}
                                style={{ fontSize: '1.2rem', padding: '1rem 3rem' }}
                            >
                                🕐 Clock Out
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="dashboard-section">
                <h2>Recent Attendance (Last 5)</h2>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time In</th>
                            <th>Time Out</th>
                            <th>Hours Worked</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {myAttendance.slice(-5).reverse().map((record, index) => (
                            <tr key={index}>
                                <td>{record.date}</td>
                                <td>{record.timeIn}</td>
                                <td>{record.timeOut || 'Not yet'}</td>
                                <td>{calculateHours(record.timeIn, record.timeOut)}</td>
                                <td>{record.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );

    const renderAttendance = () => {
        const thisMonth = myAttendance.filter(a => 
            a.date.startsWith(new Date().toISOString().slice(0, 7))
        );
        const totalHours = myAttendance.reduce((total, record) => {
            if (record.timeOut) {
                const [inH, inM] = record.timeIn.split(':').map(Number);
                const [outH, outM] = record.timeOut.split(':').map(Number);
                const hours = outH - inH + (outM - inM) / 60;
                return total + hours;
            }
            return total;
        }, 0);

        return (
            <div className="dashboard-section">
                <h2>My Attendance History</h2>
                
                <div className="stats-grid" style={{ marginBottom: '2rem' }}>
                    <div className="stat-card">
                        <h3>Total Days</h3>
                        <p className="stat-number">{myAttendance.length}</p>
                    </div>
                    <div className="stat-card">
                        <h3>This Month</h3>
                        <p className="stat-number">{thisMonth.length}</p>
                    </div>
                    <div className="stat-card">
                        <h3>Total Hours</h3>
                        <p className="stat-number">{totalHours.toFixed(1)}h</p>
                    </div>
                    <div className="stat-card">
                        <h3>Average Hours/Day</h3>
                        <p className="stat-number">
                            {myAttendance.length > 0 ? (totalHours / myAttendance.length).toFixed(1) : '0'}h
                        </p>
                    </div>
                </div>

                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Day</th>
                            <th>Time In</th>
                            <th>Time Out</th>
                            <th>Hours Worked</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {myAttendance.slice().reverse().map((record, index) => {
                            const date = new Date(record.date);
                            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                            return (
                                <tr key={index}>
                                    <td>{record.date}</td>
                                    <td>{dayName}</td>
                                    <td>{record.timeIn}</td>
                                    <td>{record.timeOut || 'Not yet'}</td>
                                    <td>{calculateHours(record.timeIn, record.timeOut)}</td>
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
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderSchedule = () => {
        const weekSchedule = getThisWeekSchedule();
        const regularHours = getRegularHours();
        const weeklyHours = mySchedule ? calculateWeeklyHours(mySchedule) : 0;
        const workingDays = mySchedule ? getWorkingDaysCount(mySchedule) : 0;

        return (
            <div style={{ padding: '2rem' }}>
               {}
                {showScheduleUpdateAlert && (
                    <div style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        padding: '1.5rem',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        zIndex: 9999,
                        minWidth: '300px',
                        animation: 'slideIn 0.3s ease-out'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ fontSize: '2rem' }}>📅</span>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem 0' }}>Schedule Updated!</h3>
                                <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>
                                    Your work schedule has been updated by the administrator.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowScheduleUpdateAlert(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.3)',
                                    border: 'none',
                                    color: 'white',
                                    width: '30px',
                                    height: '30px',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    fontSize: '1.2rem'
                                }}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}

                <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '2rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    marginBottom: '2rem'
                }}>
                    <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📅 Work Schedule
                    </h2>

                    {}
                    <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        color: 'white',
                        marginBottom: '2rem'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0' }}>📊 Weekly Summary</h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1rem'
                        }}>
                            <div>
                                <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Working Days</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{workingDays} days</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Hours</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{weeklyHours.toFixed(1)} hrs</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Avg Hours/Day</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                    {workingDays > 0 ? (weeklyHours / workingDays).toFixed(1) : '0'} hrs
                                </div>
                            </div>
                        </div>
                    </div>

                   {}
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ marginBottom: '1rem' }}>Regular Working Hours</h3>
                        {regularHours.length > 0 ? (
                            regularHours.map((group, index) => (
                                <div key={index} style={{
                                    padding: '1rem',
                                    background: '#f8f9fa',
                                    borderRadius: '8px',
                                    marginBottom: '0.5rem',
                                    borderLeft: '4px solid #667eea'
                                }}>
                                    <strong>{group.days.length > 1 
                                        ? `${group.days[0]} - ${group.days[group.days.length - 1]}`
                                        : group.days[0]
                                    }:</strong>{' '}
                                    {formatTime(group.start)} - {formatTime(group.end)}
                                </div>
                            ))
                        ) : (
                            <p style={{ color: '#999' }}>No regular schedule set</p>
                        )}
                    </div>

                    {}
                    <h3 style={{ marginBottom: '1rem' }}>This Week Schedule</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            background: 'white',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                            <thead>
                                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>DAY</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>DATE</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>SHIFT</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>HOURS</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {weekSchedule.map((day, index) => (
                                    <tr key={index} style={{
                                        borderBottom: '1px solid #dee2e6',
                                        background: day.status === 'Today' ? '#fff3cd' : 'white'
                                    }}>
                                        <td style={{ padding: '1rem', fontWeight: day.status === 'Today' ? 'bold' : 'normal' }}>
                                            {day.day}
                                        </td>
                                        <td style={{ padding: '1rem' }}>{day.date}</td>
                                        <td style={{ padding: '1rem' }}>{day.shift}</td>
                                        <td style={{ padding: '1rem' }}>{day.hours}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                padding: '0.3rem 0.8rem',
                                                borderRadius: '12px',
                                                fontSize: '0.85rem',
                                                fontWeight: '600',
                                                background: day.status === 'Attended' ? '#d4edda' :
                                                           day.status === 'Today' ? '#fff3cd' : '#e7f3ff',
                                                color: day.status === 'Attended' ? '#155724' :
                                                       day.status === 'Today' ? '#856404' : '#004085'
                                            }}>
                                                {day.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Info Box */}
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1rem',
                        background: '#e7f3ff',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        color: '#004085',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
                        <div>
                            Your schedule updates automatically in real-time when changes are made by the administrator.
                            You'll receive a notification when your schedule is updated.
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderProfile = () => (
        <div className="dashboard-section">
            <h2>My Profile</h2>
            
            {!isEditingProfile ? (
                <div style={{ maxWidth: '600px' }}>
                    <div style={{ background: '#f8f9fa', padding: '2rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                background: '#667eea',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '2rem',
                                fontWeight: 'bold',
                                marginRight: '1.5rem'
                            }}>
                                {currentUser?.name?.charAt(0) || 'E'}
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem 0' }}>{currentUser?.name}</h3>
                                <p style={{ margin: 0, color: '#666' }}>{currentUser?.position || 'Employee'}</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div>
                                <strong>Email:</strong>
                                <p style={{ margin: '0.3rem 0 0 0', color: '#666' }}>{currentUser?.email}</p>
                            </div>
                            <div>
                                <strong>Position:</strong>
                                <p style={{ margin: '0.3rem 0 0 0', color: '#666' }}>{currentUser?.position || 'Not set'}</p>
                            </div>
                            <div>
                                <strong>Phone:</strong>
                                <p style={{ margin: '0.3rem 0 0 0', color: '#666' }}>{currentUser?.phone || 'Not set'}</p>
                            </div>
                            <div>
                                <strong>Address:</strong>
                                <p style={{ margin: '0.3rem 0 0 0', color: '#666' }}>{currentUser?.address || 'Not set'}</p>
                            </div>
                            <div>
                                <strong>Employee ID:</strong>
                                <p style={{ margin: '0.3rem 0 0 0', color: '#666' }}>{currentUser?.id}</p>
                            </div>
                        </div>
                    </div>

                    <button 
                        className="btn-primary" 
                        onClick={() => setIsEditingProfile(true)}
                    >
                        ✏️ Edit Profile
                    </button>
                </div>
            ) : (
                <div style={{ maxWidth: '600px' }}>
                    <form onSubmit={handleUpdateProfile}>
                        <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div className="form-group">
                                <label><strong>Full Name:</strong></label>
                                <input
                                    type="text"
                                    value={profileForm.name}
                                    onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                                    required
                                    style={{ width: '100%', padding: '0.7rem', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                            </div>
                            <div className="form-group">
                                <label><strong>Email:</strong></label>
                                <input
                                    type="email"
                                    value={profileForm.email}
                                    onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                                    required
                                    style={{ width: '100%', padding: '0.7rem', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                            </div>
                            <div className="form-group">
                                <label><strong>Position:</strong></label>
                                <input
                                    type="text"
                                    value={profileForm.position}
                                    onChange={(e) => setProfileForm({...profileForm, position: e.target.value})}
                                    style={{ width: '100%', padding: '0.7rem', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                            </div>
                            <div className="form-group">
                                <label><strong>Phone:</strong></label>
                                <input
                                    type="tel"
                                    value={profileForm.phone}
                                    onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                                    style={{ width: '100%', padding: '0.7rem', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                            </div>
                            <div className="form-group">
                                <label><strong>Address:</strong></label>
                                <textarea
                                    value={profileForm.address}
                                    onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
                                    rows="3"
                                    style={{ width: '100%', padding: '0.7rem', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button type="submit" className="btn-primary">
                                💾 Save Changes
                            </button>
                            <button 
                                type="button" 
                                className="btn-secondary" 
                                onClick={() => setIsEditingProfile(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );

    return (
        <div className="dashboard-container">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <h2>🌿 Ishiaya's Garden</h2>
                    <p>Employee Portal</p>
                </div>
                <ul className="sidebar-menu">
                    <li>
                        <a 
                            href="#dashboard" 
                            className={activeSection === 'dashboard' ? 'active' : ''}
                            onClick={(e) => { e.preventDefault(); setActiveSection('dashboard'); }}
                        >
                            📊 Dashboard
                        </a>
                    </li>
                    <li>
                        <a 
                            href="#attendance" 
                            className={activeSection === 'attendance' ? 'active' : ''}
                            onClick={(e) => { e.preventDefault(); setActiveSection('attendance'); }}
                        >
                            📋 My Attendance
                        </a>
                    </li>
                    <li>
                        <a 
                            href="#schedule" 
                            className={activeSection === 'schedule' ? 'active' : ''}
                            onClick={(e) => { e.preventDefault(); setActiveSection('schedule'); }}
                        >
                            📅 Schedule
                        </a>
                    </li>
                    <li>
                        <a 
                            href="#profile" 
                            className={activeSection === 'profile' ? 'active' : ''}
                            onClick={(e) => { e.preventDefault(); setActiveSection('profile'); }}
                        >
                            👤 Profile
                        </a>
                    </li>
                    <li><button onClick={handleLogout}>🚪 Logout</button></li>
                </ul>
            </aside>

            <div className="main-content">
                <header className="top-header">
                    <div className="page-title">
                        <h1>Welcome, {currentUser?.name}</h1>
                        <p>Employee Portal</p>
                    </div>
                    <div className="header-profile" style={{ position: 'relative' }}>
                        <button 
                            className="profile-btn"
                            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                        >
                            {currentUser?.name || 'Employee'}
                        </button>
                        {showProfileDropdown && (
                            <div className="profile-dropdown">
                                <button onClick={() => { setActiveSection('profile'); setShowProfileDropdown(false); }}>
                                    Profile
                                </button>
                                <button onClick={handleLogout}>Logout</button>
                            </div>
                        )}
                    </div>
                </header>

                <div className="dashboard-content">
                    {renderContent()}
                </div>
            </div>

            <style>{`
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
}

export default EmployeeDashboard;