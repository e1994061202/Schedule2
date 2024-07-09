function generateSchedule() {
    const year = parseInt(document.getElementById("year").value);
    const month = parseInt(document.getElementById("month").value);
    const daysInMonth = new Date(year, month, 0).getDate();

    const dayShiftCount = parseInt(document.getElementById('dayShiftCount').value);
    const eveningShiftCount = parseInt(document.getElementById('eveningShiftCount').value);
    const nightShiftCount = parseInt(document.getElementById('nightShiftCount').value);

    if (isNaN(year) || isNaN(month) || isNaN(dayShiftCount) || isNaN(eveningShiftCount) || isNaN(nightShiftCount)) {
        alert("請確保所有輸入欄位都已填寫，且為有效數字。");
        return;
    }

    const targetShifts = calculateTargetShifts(year, month, dayShiftCount, eveningShiftCount, nightShiftCount);

    // 初始化排班表和員工班次計數
    const schedule = {};
    const staffShiftCounts = {};
    staffList.forEach(staff => {
        staffShiftCounts[staff.name] = 0;
        staff.assignedShiftTypes = new Set(); // 重置已分配的班次類型
    });

    for (let day = 1; day <= daysInMonth; day++) {
        schedule[day] = {
            dayShift: [],
            eveningShift: [],
            nightShift: []
        };
    }

    // 排班邏輯
    for (let day = 1; day <= daysInMonth; day++) {
        const availableStaff = getAvailableStaff(day, schedule, staffShiftCounts, targetShifts);

        handlePrescheduledShifts(day, schedule, availableStaff, staffShiftCounts, dayShiftCount, eveningShiftCount, nightShiftCount);
        
        if (day <= 3) {
            handleMonthTransition(day, schedule, availableStaff, staffShiftCounts, dayShiftCount, eveningShiftCount, nightShiftCount);
        }

        assignShiftsByPreference(day, schedule, availableStaff, staffShiftCounts, targetShifts, dayShiftCount, eveningShiftCount, nightShiftCount);

        handleConsecutiveWorkDays(day, schedule, availableStaff, staffShiftCounts, targetShifts, dayShiftCount, eveningShiftCount, nightShiftCount);

        ensureAllShiftsAssigned(day, schedule, availableStaff, staffShiftCounts, dayShiftCount, eveningShiftCount, nightShiftCount);

        updateConsecutiveWorkDays(day, schedule);

        // 最後檢查是否有超過限制的情況
        if (schedule[day].dayShift.length > dayShiftCount ||
            schedule[day].eveningShift.length > eveningShiftCount ||
            schedule[day].nightShift.length > nightShiftCount) {
            console.error(`Day ${day}: Shift count exceeds limit. This should never happen.`);
            // 可以在這裡添加額外的處理邏輯，例如拋出錯誤或嘗試修復
        }
    }

    balanceShifts(schedule, staffShiftCounts, targetShifts);

    displaySchedule(schedule);
    displayStatistics(schedule, targetShifts);
}

function calculateTargetShifts(year, month, dayShiftCount, eveningShiftCount, nightShiftCount) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const totalShiftsPerDay = dayShiftCount + eveningShiftCount + nightShiftCount;
    const totalStaff = staffList.length;
    return Math.round((daysInMonth * totalShiftsPerDay) / totalStaff);
}

function getAvailableStaff(day, schedule, staffShiftCounts, targetShifts) {
    return staffList.filter(staff => {
        if (staff.prescheduledDates.includes(day)) {
            return true;
        }
        
        if (staff.consecutiveWorkDays >= 6) {
            return false;
        }
        
        if (staffShiftCounts[staff.name] >= targetShifts + 2) {
            return false;
        }
        
        return true;
    });
}

function handlePrescheduledShifts(day, schedule, availableStaff, staffShiftCounts, dayShiftCount, eveningShiftCount, nightShiftCount) {
    staffList.forEach(staff => {
        if (staff.prescheduledDates.includes(day) && !isStaffAssignedToday(schedule, day, staff.name)) {
            const shift = staff.shift1;
            if (shift === 'dayShift' || shift === 'eveningShift' || shift === 'nightShift') {
                if (schedule[day][shift].length < eval(`${shift.slice(0, -5)}ShiftCount`)) {
                    schedule[day][shift].push(staff.name);
                    const staffIndex = availableStaff.findIndex(s => s.name === staff.name);
                    if (staffIndex !== -1) {
                        availableStaff.splice(staffIndex, 1);
                    }
                    staffShiftCounts[staff.name]++;
                    staff.assignedShiftTypes.add(shift);
                }
            }
        }
    });
}

function handleMonthTransition(day, schedule, availableStaff, staffShiftCounts) {
    // 實現月初連續性邏輯
    // 這裡可以添加處理上個月最後幾天排班情況的代碼
}

function assignShiftsByPreference(day, schedule, availableStaff, staffShiftCounts, targetShifts, dayShiftCount, eveningShiftCount, nightShiftCount) {
    const assignShift = (shiftType, maxCount, preferenceLevel) => {
        if (schedule[day][shiftType + 'Shift'].length >= maxCount) {
            return 0; // 如果已達到最大人數，直接返回
        }

        const preferredStaff = availableStaff.filter(staff => 
            ((preferenceLevel === 1 && staff.shift1 === shiftType + 'Shift') || 
             (preferenceLevel === 2 && staff.shift2 === shiftType + 'Shift')) &&
            !isStaffAssignedToday(schedule, day, staff.name) &&
            canAssignShift(staff, day, shiftType + 'Shift', schedule) &&
            (staff.assignedShiftTypes.size < 2 || staff.assignedShiftTypes.has(shiftType + 'Shift'))
        );
        
        preferredStaff.sort((a, b) => {
            const countDiff = staffShiftCounts[a.name] - staffShiftCounts[b.name];
            if (countDiff !== 0) return countDiff;
            return (a.shift1 === shiftType + 'Shift' ? -1 : 1) - (b.shift1 === shiftType + 'Shift' ? -1 : 1);
        });

        const availableSlots = maxCount - schedule[day][shiftType + 'Shift'].length;
        const count = Math.min(preferredStaff.length, availableSlots);
        for (let i = 0; i < count; i++) {
            const staff = preferredStaff[i];
            schedule[day][shiftType + 'Shift'].push(staff.name);
            availableStaff.splice(availableStaff.indexOf(staff), 1);
            staffShiftCounts[staff.name]++;
            staff.assignedShiftTypes.add(shiftType + 'Shift');
        }
        return count;
    };

    // 首先嘗試分配第一偏好
    let dayAssigned = assignShift('day', dayShiftCount, 1);
    let eveningAssigned = assignShift('evening', eveningShiftCount, 1);
    let nightAssigned = assignShift('night', nightShiftCount, 1);

    // 然後嘗試分配第二偏好
    if (dayAssigned < dayShiftCount) {
        dayAssigned += assignShift('day', dayShiftCount - dayAssigned, 2);
    }
    if (eveningAssigned < eveningShiftCount) {
        eveningAssigned += assignShift('evening', eveningShiftCount - eveningAssigned, 2);
    }
    if (nightAssigned < nightShiftCount) {
        nightAssigned += assignShift('night', nightShiftCount - nightAssigned, 2);
    }

    // 不再需要 assignRemaining 函數，因為我們會在其他地方處理未滿的班次
}

function handleConsecutiveWorkDays(day, schedule, availableStaff, staffShiftCounts, targetShifts, dayShiftCount, eveningShiftCount, nightShiftCount) {
    const staffNeedingConsecutiveDays = availableStaff.filter(staff => 
        staff.currentConsecutiveWorkDays > 0 && staff.currentConsecutiveWorkDays < 3 &&
        !isStaffAssignedToday(schedule, day, staff.name) &&
        (staff.assignedShiftTypes.size < 2)
    );
    staffNeedingConsecutiveDays.sort((a, b) => staffShiftCounts[a.name] - staffShiftCounts[b.name]);

    staffNeedingConsecutiveDays.forEach(staff => {
        const shifts = ['dayShift', 'eveningShift', 'nightShift'];
        for (const shift of shifts) {
            if (schedule[day][shift].length < eval(`${shift.slice(0, -5)}ShiftCount`) &&
                canAssignShift(staff, day, shift, schedule) &&
                (staff.assignedShiftTypes.size < 2 || staff.assignedShiftTypes.has(shift))) {
                schedule[day][shift].push(staff.name);
                availableStaff.splice(availableStaff.indexOf(staff), 1);
                staffShiftCounts[staff.name]++;
                staff.assignedShiftTypes.add(shift);
                break;
            }
        }
    });
}

function assignRemainingStaff(day, schedule, availableStaff, staffShiftCounts, targetShifts, dayShiftCount, eveningShiftCount, nightShiftCount) {
    availableStaff.sort((a, b) => staffShiftCounts[a.name] - staffShiftCounts[b.name]);

    while (availableStaff.length > 0) {
        const shift = ['dayShift', 'eveningShift', 'nightShift'].find(s => 
            schedule[day][s].length < eval(`${s.slice(0, -5)}ShiftCount`)
        );
        if (shift) {
            const availableForShift = availableStaff.filter(staff => 
                !isStaffAssignedToday(schedule, day, staff.name) &&
                canAssignShift(staff, day, shift, schedule) &&
                (staff.assignedShiftTypes.size < 2 || staff.assignedShiftTypes.has(shift))
            );
            if (availableForShift.length > 0) {
                const staff = availableForShift[0];
                schedule[day][shift].push(staff.name);
                availableStaff.splice(availableStaff.indexOf(staff), 1);
                staffShiftCounts[staff.name]++;
                staff.assignedShiftTypes.add(shift);
            } else {
                break;
            }
        } else {
            break;
        }
    }
}

function ensureAllShiftsAssigned(day, schedule, availableStaff, staffShiftCounts, dayShiftCount, eveningShiftCount, nightShiftCount) {
    const shifts = ['dayShift', 'eveningShift', 'nightShift'];
    const shiftCounts = [dayShiftCount, eveningShiftCount, nightShiftCount];

    shifts.forEach((shift, index) => {
        while (schedule[day][shift].length < shiftCounts[index]) {
            let staffAssigned = false;
            const sortedStaff = staffList.sort((a, b) => staffShiftCounts[a.name] - staffShiftCounts[b.name]);
            for (let staff of sortedStaff) {
                if (!isStaffAssignedToday(schedule, day, staff.name) && 
                    canAssignShift(staff, day, shift, schedule) &&
                    (staff.assignedShiftTypes.size < 2 || staff.assignedShiftTypes.has(shift))) {
                    schedule[day][shift].push(staff.name);
                    staffShiftCounts[staff.name]++;
                    staff.assignedShiftTypes.add(shift);
                    staffAssigned = true;
                    break;
                }
            }
            if (!staffAssigned) {
                console.warn(`無法為 ${day} 日的 ${shift} 安排足夠的人員`);
                break;
            }
        }
    });
}

function updateConsecutiveWorkDays(day, schedule) {
    staffList.forEach(staff => {
        if (isStaffAssignedToday(schedule, day, staff.name)) {
            staff.consecutiveWorkDays++;
            staff.currentConsecutiveWorkDays++;
        } else {
            staff.consecutiveWorkDays = 0;
            staff.currentConsecutiveWorkDays = 0;
        }
    });
}

function balanceShifts(schedule, staffShiftCounts, targetShifts) {
    const days = Object.keys(schedule);

    for (let i = 0; i < 5; i++) {
        for (const day of days) {
            for (const shift of ['dayShift', 'eveningShift', 'nightShift']) {
                const assignedStaff = schedule[day][shift];
                for (let j = 0; j < assignedStaff.length; j++) {
                    const currentStaffName = assignedStaff[j];
                    const currentStaff = staffList.find(s => s.name === currentStaffName);
                    if (!currentStaff) continue;  // 如果找不到當前員工，跳過此次迭代

                    const potentialReplacements = staffList.filter(staff => 
                        !isStaffAssignedToday(schedule, day, staff.name) &&
                        canAssignShift(staff, day, shift, schedule) &&
                        staffShiftCounts[staff.name] < staffShiftCounts[currentStaffName] - 1 &&
                        (staff.assignedShiftTypes.size < 2 || staff.assignedShiftTypes.has(shift))
                    );

                    if (potentialReplacements.length > 0) {
                        const replacement = potentialReplacements.reduce((a, b) => 
                            staffShiftCounts[a.name] < staffShiftCounts[b.name] ? a : b
                        );
                        
                        assignedStaff[j] = replacement.name;
                        staffShiftCounts[currentStaffName]--;
                        staffShiftCounts[replacement.name]++;
                        replacement.assignedShiftTypes.add(shift);
                    }
                }
            }
        }
    }
}

function isStaffAssignedToday(schedule, day, staffName) {
    return ['dayShift', 'eveningShift', 'nightShift'].some(shift => 
        schedule[day][shift].includes(staffName)
    );
}

function canAssignShift(staff, day, shift, schedule) {
    const prevDay = day - 1;
    if (prevDay > 0) {
        for (const prevShift of ['dayShift', 'eveningShift', 'nightShift']) {
            if (schedule[prevDay][prevShift].includes(staff.name)) {
                return hasEnoughInterval(prevShift, prevDay, shift, day);
            }
        }
    }
    return true;
}

function hasEnoughInterval(prevShift, prevDay, nextShift, nextDay) {
    const shiftTimes = {
        dayShift: { start: 8, end: 16 },
        eveningShift: { start: 16, end: 24 },
        nightShift: { start: 0, end: 8 }
    };

    const prevEnd = shiftTimes[prevShift].end;
    const nextStart = shiftTimes[nextShift].start;
    let interval = nextStart - prevEnd + (nextDay - prevDay) * 24;
    
    if (interval < 0) {
        interval += 24;
    }
    
    return interval >= 11;  // 稍微放寬條件，從12小時改為11小時
}
