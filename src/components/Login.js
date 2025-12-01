import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../config/firebase-config';
import '../styles/Login.css';
import logo from '../assets/ishiaya.jpg';

function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState('owner');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showRoleSelector, setShowRoleSelector] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            console.log('🔐 Attempting login...');
            const user = await loginUser(email, password);

            if (user) {
             
                if (user.role !== selectedRole) {
                    setError(`This account is not a ${selectedRole}. Please select the correct role.`);
                    setLoading(false);
                    return;
                }

                console.log('✅ Login successful:', user.name);
                sessionStorage.setItem('currentUser', JSON.stringify(user));

                switch (user.role) {
                    case 'owner':
                        navigate('/owner-dashboard');
                        break;
                    case 'admin':
                        navigate('/admin-dashboard');
                        break;
                    case 'employee':
                        navigate('/employee-dashboard');
                        break;
                    default:
                        setError('Invalid user role');
                }
            } else {
                console.log('❌ Login failed: Invalid credentials');
                setError('Invalid email or password');
            }
        } catch (error) {
            console.error('❌ Login error:', error);
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <img 
                        src={logo} 
                        alt="Ishiaya's Garden Logo" 
                        style={{
                            width: '150px',
                            height: '150px',
                            objectFit: 'contain',
                            marginBottom: '1rem',
                            borderRadius: '50%',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                    />
                    <h1>🌿 Ishiaya's Garden</h1>
                    <p>Attendance & Payroll System</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            disabled={loading}
                        />
                    </div>

                    {error && (
                        <div className="error-message">
                            ❌ {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        className="login-button"
                        disabled={loading}
                    >
                        {loading ? '⏳ Logging in...' : '🔐 Login'}
                    </button>
                </form>

                <div className="role-selector-section">
                    <button 
                        type="button"
                        className="role-toggle-btn"
                        onClick={() => setShowRoleSelector(!showRoleSelector)}
                        disabled={loading}
                    >
                        {showRoleSelector ? '▼' : '▶'} Select Role: {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
                    </button>
                    
                    {showRoleSelector && (
                        <div className="role-selector">
                            <label className={`role-option ${selectedRole === 'owner' ? 'active' : ''}`}>
                                <input
                                    type="radio"
                                    name="role"
                                    value="owner"
                                    checked={selectedRole === 'owner'}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    disabled={loading}
                                />
                               
                                <span className="role-name">Owner</span>
                            </label>
                            
                            <label className={`role-option ${selectedRole === 'admin' ? 'active' : ''}`}>
                                <input
                                    type="radio"
                                    name="role"
                                    value="admin"
                                    checked={selectedRole === 'admin'}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    disabled={loading}
                                />
                             
                                <span className="role-name">Admin</span>
                            </label>
                            
                            <label className={`role-option ${selectedRole === 'employee' ? 'active' : ''}`}>
                                <input
                                    type="radio"
                                    name="role"
                                    value="employee"
                                    checked={selectedRole === 'employee'}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    disabled={loading}
                                />
                               
                                <span className="role-name">Employee</span>
                            </label>
                        </div>
                    )}
                </div>

                <div className="login-footer">
                    <p>☁️ Powered by Firebase Cloud</p>
                    <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
                        Make sure Firestore is enabled in Firebase Console
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Login;