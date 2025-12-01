class PayrollCalculator {
    constructor() {
        this.DAILY_RATE = 415.00;
        this.OVERTIME_RATE = 415.00 * 0.12;
        this.HOLIDAY_RATE = 124.50;
        this.LATE_DEDUCTION = 50.00;
    }

    calculatePayroll(user, attendance, holidays, periodStart, periodEnd) {
        const periodAttendance = attendance.filter(a => 
            a.userId === user.id && 
            a.date >= periodStart && 
            a.date <= periodEnd
        );

        const daysWorked = periodAttendance.filter(a => 
            a.status === 'present' || a.status === 'late'
        ).length;

        const basicPay = daysWorked * this.DAILY_RATE;

        const totalOvertimeHours = periodAttendance.reduce((sum, a) => 
            sum + (a.overtimeHours || 0), 0
        );
        const overtimePay = totalOvertimeHours * this.OVERTIME_RATE;

        const holidaysWorked = periodAttendance.filter(a => a.isHoliday).length;
        const holidayPay = holidaysWorked * this.HOLIDAY_RATE;

        const grossPay = basicPay + overtimePay + holidayPay;

        const lateDays = periodAttendance.filter(a => a.isLate).length;
        const lateDeductions = lateDays * this.LATE_DEDUCTION;

        const totalDeductions = lateDeductions;
        const netPay = grossPay - totalDeductions;

        return {
            userId: user.id,
            employeeName: user.name,
            position: user.position,
            department: user.department,
            payPeriod: `${this.formatDate(periodStart)} to ${this.formatDate(periodEnd)}`,
            periodStart,
            periodEnd,
            daysWorked,
            basicPay: this.roundToTwo(basicPay),
            overtimeHours: this.roundToTwo(totalOvertimeHours),
            overtimePay: this.roundToTwo(overtimePay),
            holidaysWorked,
            holidayPay: this.roundToTwo(holidayPay),
            grossPay: this.roundToTwo(grossPay),
            lateDays,
            lateDeductions: this.roundToTwo(lateDeductions),
            totalDeductions: this.roundToTwo(totalDeductions),
            netPay: this.roundToTwo(netPay),
            status: 'processed',
            generatedDate: new Date().toISOString().split('T')[0],
            generatedBy: null
        };
    }

    calculateBatchPayroll(users, attendance, holidays, periodStart, periodEnd) {
        return users
            .filter(u => u.role === 'employee')
            .map(user => this.calculatePayroll(user, attendance, holidays, periodStart, periodEnd));
    }

    calculateOvertimeHours(timeIn, timeOut, scheduledTimeOut) {
        const actualOut = this.timeToMinutes(timeOut);
        const scheduledOut = this.timeToMinutes(scheduledTimeOut);
        const overtimeMinutes = Math.max(0, actualOut - scheduledOut);
        return overtimeMinutes / 60;
    }

    isLate(timeIn, scheduledTimeIn, graceMinutes = 5) {
        const actual = this.timeToMinutes(timeIn);
        const scheduled = this.timeToMinutes(scheduledTimeIn);
        return actual > (scheduled + graceMinutes);
    }

    calculateLateMinutes(timeIn, scheduledTimeIn) {
        const actual = this.timeToMinutes(timeIn);
        const scheduled = this.timeToMinutes(scheduledTimeIn);
        return Math.max(0, actual - scheduled);
    }

    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    roundToTwo(num) {
        return Math.round(num * 100) / 100;
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    getPayrollPeriod(date = new Date()) {
        const day = date.getDate();
        const year = date.getFullYear();
        const month = date.getMonth();

        if (day <= 15) {
            return {
                start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
                end: `${year}-${String(month + 1).padStart(2, '0')}-15`
            };
        } else {
            const lastDay = new Date(year, month + 1, 0).getDate();
            return {
                start: `${year}-${String(month + 1).padStart(2, '0')}-16`,
                end: `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`
            };
        }
    }
}

export const payrollCalculator = new PayrollCalculator();