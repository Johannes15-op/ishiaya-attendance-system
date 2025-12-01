import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Edit2, Save, X } from 'lucide-react';

// Schedule Management Component
const ScheduleManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Default schedule template
  const defaultSchedule = {
    monday: { enabled: true, start: '08:00', end: '17:00', break: '12:00-13:00' },
    tuesday: { enabled: true, start: '08:00', end: '17:00', break: '12:00-13:00' },
    wednesday: { enabled: true, start: '08:00', end: '17:00', break: '12:00-13:00' },
    thursday: { enabled: true, start: '08:00', end: '17:00', break: '12:00-13:00' },
    friday: { enabled: true, start: '08:00', end: '17:00', break: '12:00-13:00' },
    saturday: { enabled: true, start: '08:00', end: '12:00', break: '' },
    sunday: { enabled: false, start: '', end: '', break: '' }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Simulated data - replace with actual firebase calls
      const mockEmployees = [
        { id: '1', name: 'John Doe', position: 'Server', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', position: 'Cook', email: 'jane@example.com' },
        { id: '3', name: 'Mike Johnson', position: 'Cashier', email: 'mike@example.com' }
      ];
      
      const mockSchedules = {
        '1': { ...defaultSchedule },
        '2': { ...defaultSchedule, saturday: { enabled: false, start: '', end: '', break: '' } },
        '3': { ...defaultSchedule }
      };

      setEmployees(mockEmployees);
      setSchedules(mockSchedules);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const handleScheduleChange = (day, field, value) => {
    if (!selectedEmployee) return;
    
    setSchedules(prev => ({
      ...prev,
      [selectedEmployee.id]: {
        ...prev[selectedEmployee.id],
        [day]: {
          ...prev[selectedEmployee.id][day],
          [field]: value
        }
      }
    }));
  };

  const handleSaveSchedule = async () => {
    try {
      // Save to localStorage (replace with firebase save)
      localStorage.setItem('employee_schedules', JSON.stringify(schedules));
      alert('✅ Schedule saved successfully!');
      setEditMode(false);
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('❌ Failed to save schedule');
    }
  };

  const calculateHours = (start, end) => {
    if (!start || !end) return '0';
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const hours = (endH * 60 + endM - startH * 60 - startM) / 60;
    return hours.toFixed(1);
  };

  const getDayColor = (enabled) => {
    return enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading schedules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Schedule Management</h1>
              <p className="text-gray-600">Manage employee work schedules and shifts</p>
            </div>
          </div>
          {selectedEmployee && editMode && (
            <div className="flex gap-2">
              <button
                onClick={handleSaveSchedule}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
              <button
                onClick={() => {
                  setEditMode(false);
                  loadData();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">Employees</h2>
          </div>
          
          <div className="space-y-2">
            {employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => {
                  setSelectedEmployee(emp);
                  setEditMode(false);
                }}
                className={`w-full text-left p-4 rounded-lg border-2 transition ${
                  selectedEmployee?.id === emp.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-semibold text-gray-800">{emp.name}</div>
                <div className="text-sm text-gray-600">{emp.position}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Schedule Details */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          {selectedEmployee ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{selectedEmployee.name}'s Schedule</h2>
                  <p className="text-gray-600">{selectedEmployee.position}</p>
                </div>
                {!editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Schedule
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {Object.entries(schedules[selectedEmployee.id] || defaultSchedule).map(([day, schedule]) => (
                  <div
                    key={day}
                    className={`border-2 rounded-lg p-4 transition ${getDayColor(schedule.enabled)}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Day Enable Toggle */}
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={schedule.enabled}
                          disabled={!editMode}
                          onChange={(e) => handleScheduleChange(day, 'enabled', e.target.checked)}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Day Name */}
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800 capitalize mb-3">
                          {day}
                        </h3>

                        {schedule.enabled ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Start Time */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Start Time
                              </label>
                              <input
                                type="time"
                                value={schedule.start}
                                disabled={!editMode}
                                onChange={(e) => handleScheduleChange(day, 'start', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                              />
                            </div>

                            {/* End Time */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                End Time
                              </label>
                              <input
                                type="time"
                                value={schedule.end}
                                disabled={!editMode}
                                onChange={(e) => handleScheduleChange(day, 'end', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                              />
                            </div>

                            {/* Break Time */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Break (optional)
                              </label>
                              <input
                                type="text"
                                value={schedule.break}
                                disabled={!editMode}
                                placeholder="12:00-13:00"
                                onChange={(e) => handleScheduleChange(day, 'break', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500 italic">Rest Day</p>
                        )}

                        {/* Hours Display */}
                        {schedule.enabled && schedule.start && schedule.end && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            <span>Total: {calculateHours(schedule.start, schedule.end)} hours</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Weekly Summary */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <h3 className="font-semibold text-gray-800 mb-2">Weekly Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Working Days:</span>
                    <span className="ml-2 font-semibold">
                      {Object.values(schedules[selectedEmployee.id] || {}).filter(s => s.enabled).length}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Hours:</span>
                    <span className="ml-2 font-semibold">
                      {Object.values(schedules[selectedEmployee.id] || {})
                        .filter(s => s.enabled)
                        .reduce((total, s) => total + parseFloat(calculateHours(s.start, s.end)), 0)
                        .toFixed(1)} hrs
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Select an employee to view their schedule</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleManagement;