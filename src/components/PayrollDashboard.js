import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAllUsers, getAllAttendance, localDB, saveToLocalStorage } from '../config/firebase-config';
import '../styles/Dashboard.css';

function PayrollDashboard() {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [activeTab, setActiveTab] = useState('generate');
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [generatedPayroll, setGeneratedPayroll] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [searchEmployee, setSearchEmployee] = useState('');
    const [showFormalReport, setShowFormalReport] = useState(false);
    
    const [payrollForm, setPayrollForm] = useState({
        periodStart: '',
        periodEnd: '',
        employeeId: ''
    });


    const DAILY_RATE = 415.00;
    const OVERTIME_RATE = 415.00 * 0.12; 
    const HOLIDAY_RATE = 124.50;
    const LATE_DEDUCTION = 50.00;
    const SSS_RATE = 0.045;
    const PHILHEALTH_RATE = 0.02;
    const PAGIBIG_RATE = 0.02; 

    const loadData = useCallback(async () => {
        try {
            const usersData = await getAllUsers();
            const attendanceData = await getAllAttendance();
            setUsers(usersData.filter(u => u.role === 'employee'));
            setAttendance(attendanceData);
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }, []);

    useEffect(() => {
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!user || user.role !== 'admin') {
            navigate('/');
            return;
        }
        setCurrentUser(user);
        loadData();
    }, [navigate, loadData]);

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

    const handleGeneratePayroll = () => {
        if (!payrollForm.periodStart || !payrollForm.periodEnd) {
            alert('Please select period start and end dates');
            return;
        }

        const employeesToProcess = payrollForm.employeeId 
            ? users.filter(u => u.id === payrollForm.employeeId)
            : users;

        const payrollData = employeesToProcess.map(employee => {
            const employeeAttendance = attendance.filter(a => 
                a.userId === employee.id &&
                new Date(a.date) >= new Date(payrollForm.periodStart) &&
                new Date(a.date) <= new Date(payrollForm.periodEnd)
            );

            const daysWorked = employeeAttendance.filter(a => 
                a.status === 'Present' || a.timeIn
            ).length;

            const basicPay = daysWorked * DAILY_RATE;

            const totalOvertimeHours = employeeAttendance.reduce((sum, a) => 
                sum + (a.overtimeHours || 0), 0
            );
            const overtimePay = totalOvertimeHours * OVERTIME_RATE;

            const holidaysWorked = employeeAttendance.filter(a => a.isHoliday).length;
            const holidayPay = holidaysWorked * HOLIDAY_RATE;

            const nightDiff = 0;
            const incentives = 0;
            const adjustment = 0;

            const totalAmount = basicPay + overtimePay + holidayPay + nightDiff + incentives + adjustment;

            const sss = totalAmount * SSS_RATE;
            const philhealth = totalAmount * PHILHEALTH_RATE;
            const pagibig = totalAmount * PAGIBIG_RATE;
            
            const lateDays = employeeAttendance.filter(a => a.isLate).length;
            const lateDeductions = lateDays * LATE_DEDUCTION;

            const loans = 0;
            const penalty = 0;
            const ca = 0;

            const totalDeductions = sss + philhealth + pagibig + lateDeductions + loans + penalty + ca;
            const netPay = totalAmount - totalDeductions;

            return {
                employeeId: employee.id,
                employeeName: employee.name,
                employeePosition: employee.position || 'N/A',
                profilePic: getProfilePicture(employee),
                period: `${payrollForm.periodStart} to ${payrollForm.periodEnd}`,
                daysWorked,
                restDays: 0,
                rate: DAILY_RATE,
                basicPay,
                overtimeHours: totalOvertimeHours,
                overtimePay,
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
            };
        });

        setGeneratedPayroll(payrollData);
        setShowPreview(true);
    };

    const handleSavePayroll = async () => {
        try {
            const payrollRecord = {
                id: Date.now().toString(),
                period: `${payrollForm.periodStart} to ${payrollForm.periodEnd}`,
                generatedDate: new Date().toISOString(),
                generatedBy: currentUser.id,
                data: generatedPayroll
            };

            if (!localDB.payroll) {
                localDB.payroll = [];
            }
            localDB.payroll.push(payrollRecord);
            await saveToLocalStorage();

            alert('Payroll saved successfully!');
            setShowPreview(false);
            setGeneratedPayroll([]);
            setPayrollForm({
                periodStart: '',
                periodEnd: '',
                employeeId: ''
            });
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

    const handleLogout = () => {
        sessionStorage.removeItem('currentUser');
        navigate('/');
    };

    const filteredPayroll = generatedPayroll.filter(p =>
        p.employeeName.toLowerCase().includes(searchEmployee.toLowerCase())
    );

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

    const totals = filteredPayroll.reduce((acc, emp) => ({
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
        daysWorked: 0,
        basicPay: 0,
        overtimeHours: 0,
        overtimePay: 0,
        nightDiff: 0,
        incentives: 0,
        adjustment: 0,
        totalAmount: 0,
        sss: 0,
        philhealth: 0,
        pagibig: 0,
        late: 0,
        loans: 0,
        penalty: 0,
        ca: 0,
        totalDeductions: 0,
        netPay: 0
    });

    if (showFormalReport && showPreview && filteredPayroll.length > 0) {
        return (
            <div style={{ 
                padding: '40px', 
                fontFamily: 'Arial, sans-serif',
                maxWidth: '1400px',
                margin: '0 auto',
                backgroundColor: '#fff'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <h1 style={{ 
                        fontSize: '28px', 
                        fontWeight: 'bold', 
                        margin: '0 0 10px 0',
                        letterSpacing: '2px'
                    }}>
                        PAYROLL
                    </h1>
                    <p style={{ margin: '5px 0', fontSize: '14px' }}>For the period</p>
                    <p style={{ margin: '5px 0', fontSize: '16px', fontWeight: 'bold' }}>
                        {formatDate(payrollForm.periodStart)} - {formatDate(payrollForm.periodEnd)}
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
                                <th rowSpan="2" style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', backgroundColor: '#b8cce4' }}>SIGNATURE</th>
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
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>&nbsp;</td>
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
                                <td style={{ border: '1px solid #000', padding: '8px' }}>&nbsp;</td>
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
        <div className="dashboard-container">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <h2>🌿 Ishiaya's Garden</h2>
                    <p>Payroll System</p>
                </div>
                <ul className="sidebar-menu">
                    <li><Link to="/admin-dashboard">📊 Dashboard</Link></li>
                    <li><Link to="/payroll-dashboard" className="active">💰 Payroll</Link></li>
                    <li><Link to="/admin-dashboard">📋 Attendance</Link></li>
                    <li><Link to="/admin-dashboard">⚙️ Settings</Link></li>
                    <li><button onClick={handleLogout}>🚪 Logout</button></li>
                </ul>
            </aside>

            <div className="main-content">
                <header className="top-header">
                    <div className="page-title">
                        <h1>Payroll Management</h1>
                        <p>Generate and manage employee payroll</p>
                    </div>
                    <div className="header-profile" style={{ position: 'relative' }}>
                        <button 
                            className="profile-btn"
                            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}
                        >
                            {getProfilePicture(currentUser) ? (
                                <img 
                                    src={getProfilePicture(currentUser)} 
                                    alt={currentUser?.name}
                                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                            ) : (
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                    {getInitials(currentUser?.name)}
                                </div>
                            )}
                            <span>{currentUser?.name || 'Admin'}</span>
                        </button>
                        {showProfileDropdown && (
                            <div className="profile-dropdown">
                                <button onClick={handleLogout}>Logout</button>
                            </div>
                        )}
                    </div>
                </header>

                <div className="dashboard-content">
                    <div className="tabs" style={{ marginBottom: '2rem' }}>
                        <button 
                            className={activeTab === 'generate' ? 'active' : ''}
                            onClick={() => setActiveTab('generate')}
                        >
                            Generate Payroll
                        </button>
                        <button 
                            className={activeTab === 'history' ? 'active' : ''}
                            onClick={() => setActiveTab('history')}
                        >
                            Payroll History
                        </button>
                    </div>

                    {activeTab === 'generate' && (
                        <div className="dashboard-section">
                            <h2>Generate New Payroll</h2>
                            
                            <div style={{ background: '#f8f9fa', padding: '2rem', borderRadius: '12px', maxWidth: '600px', marginBottom: '2rem' }}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#2d3748' }}>
                                        Period End Date:
                                    </label>
                                    <input
                                        type="date"
                                        value={payrollForm.periodEnd}
                                        onChange={(e) => setPayrollForm({...payrollForm, periodEnd: e.target.value})}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem', transition: 'border-color 0.3s' }}
                                    />
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#2d3748' }}>
                                        Employee (Optional - leave empty for all):
                                    </label>
                                    <select
                                        value={payrollForm.employeeId}
                                        onChange={(e) => setPayrollForm({...payrollForm, employeeId: e.target.value})}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem', backgroundColor: 'white', cursor: 'pointer' }}
                                    >
                                        <option value="">All Employees</option>
                                        {users.map(user => (
                                            <option key={user.id} value={user.id}>{user.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <button 
                                    className="btn-primary" 
                                    onClick={handleGeneratePayroll}
                                    style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: '600' }}
                                >
                                    📊 Generate Payroll
                                </button>
                            </div>

                            {showPreview && (
                                <div className="dashboard-section" style={{ marginTop: '2rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <h3>Payroll Preview</h3>
                                        <input
                                            type="text"
                                            placeholder="🔍 Search employee..."
                                            value={searchEmployee}
                                            onChange={(e) => setSearchEmployee(e.target.value)}
                                            style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '2px solid #e2e8f0', width: '250px' }}
                                        />
                                    </div>

                                    <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                                        <div className="stat-card">
                                            <h4>Total Employees</h4>
                                            <p className="stat-number">{filteredPayroll.length}</p>
                                        </div>
                                        <div className="stat-card">
                                            <h4>Total Gross Pay</h4>
                                            <p className="stat-number">
                                                ₱{filteredPayroll.reduce((sum, p) => sum + p.basicPay, 0).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="stat-card">
                                            <h4>Total Deductions</h4>
                                            <p className="stat-number">
                                                ₱{filteredPayroll.reduce((sum, p) => sum + p.totalDeductions, 0).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="stat-card">
                                            <h4>Total Net Pay</h4>
                                            <p className="stat-number" style={{ color: '#10b981' }}>
                                                ₱{filteredPayroll.reduce((sum, p) => sum + p.netPay, 0).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>

                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Employee</th>
                                                <th>Days Worked</th>
                                                <th>Overtime Hours</th>
                                                <th>Basic Pay</th>
                                                <th>Overtime Pay</th>
                                                <th>Deductions</th>
                                                <th>Net Pay</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredPayroll.map((payroll, index) => (
                                                <tr key={index}>
                                                    <td><strong>{payroll.employeeName}</strong></td>
                                                    <td>{payroll.daysWorked}</td>
                                                    <td>{payroll.overtimeHours}</td>
                                                    <td>₱{payroll.basicPay.toFixed(2)}</td>
                                                    <td>₱{payroll.overtimePay.toFixed(2)}</td>
                                                    <td style={{ color: '#ef4444' }}>₱{payroll.totalDeductions.toFixed(2)}</td>
                                                    <td style={{ color: '#10b981', fontWeight: '600' }}>₱{payroll.netPay.toFixed(2)}</td>
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
                                            onClick={() => setShowPreview(false)}
                                            style={{ padding: '0.75rem 2rem' }}
                                        >
                                            ✖ Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="dashboard-section">
                            <h2>Payroll History</h2>
                            {localDB.payroll && localDB.payroll.length > 0 ? (
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    {localDB.payroll.map(record => {
                                        const totalNetPay = record.data.reduce((sum, d) => sum + d.netPay, 0);
                                        return (
                                            <div 
                                                key={record.id} 
                                                style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '12px', border: '2px solid #e2e8f0', transition: 'all 0.3s' }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.borderColor = '#667eea';
                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                                    e.currentTarget.style.boxShadow = 'none';
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#2d3748' }}>
                                                            📅 Period: {record.period}
                                                        </h3>
                                                        <p style={{ margin: '0.25rem 0', color: '#718096' }}>
                                                            <strong>Generated:</strong> {new Date(record.generatedDate).toLocaleDateString()}
                                                        </p>
                                                        <p style={{ margin: '0.25rem 0', color: '#718096' }}>
                                                            <strong>Employees:</strong> {record.data.length}
                                                        </p>
                                                        <p style={{ margin: '0.25rem 0', color: '#10b981', fontSize: '1.2rem', fontWeight: '600' }}>
                                                            <strong>Total Net Pay:</strong> ₱{totalNetPay.toFixed(2)}
                                                        </p>
                                                    </div>
                                                    <button 
                                                        className="btn-secondary"
                                                        style={{ padding: '0.5rem 1.5rem' }}
                                                    >
                                                        👁️ View Details
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '4rem', background: '#f8f9fa', borderRadius: '12px', color: '#718096' }}>
                                    <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>📋</p>
                                    <h3>No Payroll History</h3>
                                    <p>Generate your first payroll to see it here</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PayrollDashboard;