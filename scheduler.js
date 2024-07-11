let staffList = [];
function initializeStaffData() {
    checkAndLogStaffList('initializeStaffData');
    ensureStaffListIsArray();
    staffList.forEach(staff => {
        staff.shiftCounts = { dayShift: 0, eveningShift: 0, nightShift: 0, total: 0 };
        staff.consecutiveWorkDays = calculateConsecutiveWorkDays(safeGet(staff, 'previousMonthSchedules', []));
        staff.lastWorkDay = safeArrayIncludes(safeGet(staff, 'previousMonthSchedules', []), true) ? 0 : null;
        staff.lastShift = safeGet(staff, 'lastMonthLastDayShift', null);
        staff.scheduledDates = [];
    });
}
// 在每個使用 staffList 的函數開始時調用這個函數
function checkAndLogStaffList(functionName) {
    console.log(`${functionName}: staffList type:`, typeof staffList);
    console.log(`${functionName}: staffList is array:`, Array.isArray(staffList));
    console.log(`${functionName}: staffList length:`, staffList.length);
    console.log(`${functionName}: staffList content:`, JSON.stringify(staffList));
}
function addStaffToShift(schedule, date, shift, staffName) {
    if (!schedule[date][shift].includes(staffName)) {
        schedule[date][shift].push(staffName);
    }
}
function getLastMonthLastDayShift() {
    const lastMonthLastDayShift = {};
    staffList.forEach(staff => {
        lastMonthLastDayShift[staff.name] = staff.lastMonthLastDayShift;
    });
    return lastMonthLastDayShift;
}
function initializeSchedule(year, month, daysInMonth) {
    const schedule = {};
    for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        schedule[date] = {
            dayShift: [],
            eveningShift: [],
            nightShift: []
        };
    }
    return schedule;
}
function randomlyAdjustSchedule(schedule, targetShifts) {
    const staffStats = calculateStaffStats(schedule);
    const underworkedStaff = staffStats.filter(staff => staff.total < targetShifts);
    const overworkedStaff = staffStats.filter(staff => staff.total > targetShifts + 1);

    // 隨機選擇一個過度工作的員工和一個工作不足的員工
    if (overworkedStaff.length > 0 && underworkedStaff.length > 0) {
        const randomOverworked = overworkedStaff[Math.floor(Math.random() * overworkedStaff.length)];
        const randomUnderworked = underworkedStaff[Math.floor(Math.random() * underworkedStaff.length)];

        // 嘗試交換班次
        for (const date in schedule) {
            for (const shift of ['dayShift', 'eveningShift', 'nightShift']) {
                if (schedule[date][shift].includes(randomOverworked.name) &&
                    canWorkShift(randomUnderworked, shift, new Date(date).getDate(), date, getPreviousDate(date), schedule, new Date(date).getMonth() + 1)) {
                    removeStaffFromShift(schedule, date, shift, randomOverworked.name);
                    addStaffToShift(schedule, date, shift, randomUnderworked.name);
                    return; // 成功調整後退出
                }
            }
        }
    }
}
function initialScheduling(schedule, staffList, targetShifts) {
    const shifts = ['dayShift', 'eveningShift', 'nightShift'];
    
    for (const date in schedule) {
        for (const shift of shifts) {
            const requiredStaff = getShiftCount(shift);
            const availableStaff = staffList.filter(staff => 
                canWorkShift(staff, shift, new Date(date).getDate(), date, getPreviousDate(date), schedule, new Date(date).getMonth() + 1)
            );
            
            const selectedStaff = selectStaffForShift(availableStaff, requiredStaff, shift, date, schedule, targetShifts);
            
            selectedStaff.forEach(staff => {
                addStaffToShift(schedule, date, shift, staff.name);
                updateStaffStats(staff, shift, date);
            });
        }
    }
}
// 在文件開頭添加這個函數
function ensureStaffListIsArray() {
    if (!Array.isArray(staffList)) {
        console.warn('staffList is not an array. Resetting to an empty array.');
        staffList = [];
    }
}
function safeGet(obj, path, defaultValue = undefined) {
    const travel = regexp =>
        String.prototype.split
            .call(path, regexp)
            .filter(Boolean)
            .reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj);
    const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
    return result === undefined || result === obj ? defaultValue : result;
}

function safeArrayIncludes(arr, item) {
    return Array.isArray(arr) && arr.includes(item);
}

function calculateConsecutiveWorkDays(previousMonthSchedules) {
    let consecutiveDays = 0;
    if (Array.isArray(previousMonthSchedules)) {
        for (let i = previousMonthSchedules.length - 1; i >= 0; i--) {
            if (previousMonthSchedules[i]) {
                consecutiveDays++;
            } else {
                break;
            }
        }
    }
    return consecutiveDays;
}
function retryFillingShifts(schedule, unfilledShifts, year, month, daysInMonth, dayShiftCount, eveningShiftCount, nightShiftCount, targetShifts, lastMonthLastDayShift) {
    let retries = 3;
    while (retries > 0 && unfilledShifts.length > 0) {
        const overallStats = calculateOverallStats(schedule, targetShifts);
        if (overallStats.unfilled === 0) break;

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            ['dayShift', 'eveningShift', 'nightShift'].forEach(shift => {
                const required = (shift === 'dayShift' ? dayShiftCount : 
                                  shift === 'eveningShift' ? eveningShiftCount : 
                                  nightShiftCount) - schedule[currentDate][shift].length;
                if (required > 0) {
                    const availableStaff = staffList.filter(staff => 
                        !schedule[currentDate][shift].includes(staff.name) &&
                        canWorkShift(staff, shift, day, currentDate, getPreviousDate(currentDate, year, month), schedule, month, lastMonthLastDayShift)
                    );
                    const selectedStaff = selectStaffForShift(availableStaff, required, shift, currentDate, schedule, targetShifts);
                    selectedStaff.forEach(staff => addStaffToSchedule(staff, shift, currentDate, day, schedule));
                    
                    // 更新 unfilledShifts
                    const index = unfilledShifts.findIndex(s => s.startsWith(`${currentDate} ${shift}`));
                    if (index !== -1) {
                        unfilledShifts.splice(index, 1);
                    }
                }
            });
        }
        retries--;
    }
    return unfilledShifts;
}
function getShiftCount(shift) {
    switch (shift) {
        case 'dayShift':
            return parseInt(document.getElementById('dayShiftCount').value);
        case 'eveningShift':
            return parseInt(document.getElementById('eveningShiftCount').value);
        case 'nightShift':
            return parseInt(document.getElementById('nightShiftCount').value);
        default:
            console.error('Invalid shift type:', shift);
            return 0;
    }
}

function getPreviousDate(date, year, month) {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    
    // 如果是本月第一天，返回上個月最後一天
    if (d.getMonth() + 1 !== month) {
        return `${year}-${(month-1).toString().padStart(2, '0')}-${new Date(year, month-1, 0).getDate()}`;
    }
    
    return d.toISOString().split('T')[0];
}
function addStaffToSchedule(staff, shift, date, day, schedule) {
    if (!schedule[date]) {
        console.warn(`Warning: 日期 ${date} 不在排班表中`);
        return;
    }
    
    if (!schedule[date][shift]) {
        console.warn(`Warning: 日期 ${date} 沒有 ${shift} 班次`);
        return;
    }
    
    if (schedule[date][shift].includes(staff.name)) {
        console.warn(`Warning: ${staff.name} 已經在 ${date} 的 ${shift} 班次中`);
        return;
    }
    
    schedule[date][shift].push(staff.name);
    staff.shiftCounts[shift]++;
    staff.shiftCounts.total++;
    staff.consecutiveWorkDays++;
    staff.lastWorkDay = day;
    staff.lastShift = shift;
    staff.scheduledDates.push(date);
}

async function generateSchedule() {
    checkAndLogStaffList('generateSchedule');
    ensureStaffListIsArray();

    const year = parseInt(document.getElementById("year").value);
    const month = parseInt(document.getElementById("month").value);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const dayShiftCount = parseInt(document.getElementById("dayShiftCount").value);
    const eveningShiftCount = parseInt(document.getElementById("eveningShiftCount").value);
    const nightShiftCount = parseInt(document.getElementById("nightShiftCount").value);

    // 錯誤檢查
    if (staffList.length === 0) {
        showError("錯誤：沒有可用的員工列表");
        return;
    }

    if (isNaN(dayShiftCount) || isNaN(eveningShiftCount) || isNaN(nightShiftCount) ||
        dayShiftCount <= 0 || eveningShiftCount <= 0 || nightShiftCount <= 0) {
        showError("錯誤：班次人數設置無效");
        return;
    }

    const totalShiftsPerDay = dayShiftCount + eveningShiftCount + nightShiftCount;
    const targetShifts = Math.floor((daysInMonth * totalShiftsPerDay) / staffList.length);

    let schedule;
    let isBalanced = false;
    let attempts = 0;
    const maxAttempts = 10; // 設置最大嘗試次數

    updateProgressIndicator(0);

    while (!isBalanced && attempts < maxAttempts) {
        schedule = initializeSchedule(year, month, daysInMonth);
        initializeStaffData();
        const lastMonthLastDayShift = getLastMonthLastDayShift();

        let unfilledShifts = [];

        // 初始排班邏輯
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const previousDate = getPreviousDate(currentDate, year, month);
            
            let scheduledStaffForDay = new Set();

            function scheduleShift(shift, requiredStaff) {
                let availableStaff = staffList.filter(staff => 
                    !scheduledStaffForDay.has(staff.name) &&
                    !isPrescheduled(staff, day) &&  
                    canWorkShift(staff, shift, day, currentDate, previousDate, schedule, month, lastMonthLastDayShift)
                );

                const selectedStaff = selectStaffForShift(availableStaff, requiredStaff, shift, currentDate, schedule, targetShifts);

                selectedStaff.forEach(staff => {
                    addStaffToSchedule(staff, shift, currentDate, day, schedule);
                    scheduledStaffForDay.add(staff.name);
                });

                return selectedStaff.length;
            }

            let dayShiftScheduled = scheduleShift('dayShift', dayShiftCount);
            let eveningShiftScheduled = scheduleShift('eveningShift', eveningShiftCount);
            let nightShiftScheduled = scheduleShift('nightShift', nightShiftCount);

            // 檢查是否有未填滿的班次
            if (dayShiftScheduled < dayShiftCount) {
                unfilledShifts.push(`${currentDate} dayShift 缺少 ${dayShiftCount - dayShiftScheduled} 人`);
            }
            if (eveningShiftScheduled < eveningShiftCount) {
                unfilledShifts.push(`${currentDate} eveningShift 缺少 ${eveningShiftCount - eveningShiftScheduled} 人`);
            }
            if (nightShiftScheduled < nightShiftCount) {
                unfilledShifts.push(`${currentDate} nightShift 缺少 ${nightShiftCount - nightShiftScheduled} 人`);
            }

            // 更新未被選中的員工的連續工作天數
            staffList.forEach(staff => {
                if (!scheduledStaffForDay.has(staff.name)) {
                    staff.consecutiveWorkDays = 0;
                    staff.currentConsecutiveWorkDays = 0;
                }
            });
        }

        // 嘗試填補未填滿的班次
        unfilledShifts = retryFillingShifts(schedule, unfilledShifts, year, month, daysInMonth, dayShiftCount, eveningShiftCount, nightShiftCount, targetShifts, lastMonthLastDayShift);

        // 執行平衡步驟
        isBalanced = balanceSchedule(schedule, targetShifts);

        attempts++;
        updateProgressIndicator(attempts / maxAttempts * 100);
    }

    if (!isBalanced) {
        showWarning("警告：無法達到完全平衡的排班。請檢查設置或手動調整。");
    }

    // 更新員工的實際班次信息
    updateStaffShiftCounts(schedule);

    updateProgressIndicator(100);

    // 保存當月排班結果到 localStorage
    localStorage.setItem(`schedule-${year}-${month}`, JSON.stringify(schedule));

    // 顯示排班結果
    displaySchedule(schedule);
    displayStatistics(schedule, targetShifts);
    displayDetailedSchedule(schedule);

    return schedule;
}

function canWorkShift(staff, shift, day, currentDate, previousDate, schedule, currentMonth, lastMonthLastDayShift) {
    // 檢查該員工是否已經在當天被排班
    if (isStaffWorkingOnDate(schedule, currentDate, staff.name)) {
        return false;
    }

    // 檢查是否是員工選擇的兩種班次之一
    if (staff.shift1 !== shift && staff.shift2 !== shift) {
        return false;
    }

    // 檢查連續工作天數
    if (staff.consecutiveWorkDays >= 6) {
        return false;
    }

    // 檢查是否有足夠的休息時間
    if (staff.lastWorkDay !== null && staff.lastShift) {
        const lastShiftTimes = SHIFT_TIMES[staff.lastShift];
        const currentShiftTimes = SHIFT_TIMES[shift];
        
        if (lastShiftTimes && currentShiftTimes) {
            const lastShiftEndTime = lastShiftTimes.end;
            const currentShiftStartTime = currentShiftTimes.start;
            const hoursSinceLastShift = (day - staff.lastWorkDay) * 24 + 
                (currentShiftStartTime < lastShiftEndTime ? 24 : 0) + 
                currentShiftStartTime - lastShiftEndTime;
            
            if (hoursSinceLastShift < 12) {
                return false;
            }
        }
    }

    // 检查前一天的班次,包括跨月情况 
    let previousShift = null;
    if (day === 1) {
        previousShift = lastMonthLastDayShift[staff.name];
    } else if (schedule[previousDate]) {
        if (schedule[previousDate].nightShift.includes(staff.name)) previousShift = 'nightShift';
        else if (schedule[previousDate].eveningShift.includes(staff.name)) previousShift = 'eveningShift';
        else if (schedule[previousDate].dayShift.includes(staff.name)) previousShift = 'dayShift';
    }

    // 不允许大夜班或小夜班后接白班(包括跨月情况)
    if (shift === 'dayShift' && (previousShift === 'nightShift' || previousShift === 'eveningShift')) {
        return false;
    }

    // 小夜接白班需要休息一天(包括跨月情况)
    if (shift === 'dayShift' && day > 1) {
        const twoDaysAgo = new Date(currentDate);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoString = twoDaysAgo.toISOString().split('T')[0];
        if (schedule[twoDaysAgoString] && schedule[twoDaysAgoString].eveningShift.includes(staff.name)) {
            return false;
        }
    } else if (shift === 'dayShift' && day === 1) {
        // 检查上个月倒数第二天是否为小夜班
        const secondLastDayShift = staff.previousMonthSchedules ? staff.previousMonthSchedules[staff.previousMonthSchedules.length - 2] : null;
        if (secondLastDayShift === 'eveningShift') {
            return false;
        }
    }

    return true;
}
function getPreviousDayShift(schedule, date, staffName) {
    if (!schedule[date]) return null;
    if (schedule[date].nightShift.includes(staffName)) return 'nightShift';
    if (schedule[date].eveningShift.includes(staffName)) return 'eveningShift';
    if (schedule[date].dayShift.includes(staffName)) return 'dayShift';
    return null;
}
function findExchangeableShift(schedule, staff, targetShifts) {
    for (const date in schedule) {
        for (const shift in schedule[date]) {
            const staffInShift = schedule[date][shift];
            for (const otherStaff of staffInShift) {
                if (otherStaff !== staff.name) {
                    const otherStaffStats = calculateStaffStats(schedule).find(s => s.name === otherStaff);
                    if (otherStaffStats.total > targetShifts) {
                        return { date, shift, exchangedStaff: otherStaff };
                    }
                }
            }
        }
    }
    return {};
}

function findRemovableShift(schedule, staffName) {
    for (const date in schedule) {
        for (const shift in schedule[date]) {
            if (schedule[date][shift].includes(staffName)) {
                return { date, shift };
            }
        }
    }
    return {};
}

function removeShift(schedule, date, shift, staffName) {
    const index = schedule[date][shift].indexOf(staffName);
    if (index !== -1) {
        schedule[date][shift].splice(index, 1);
    }
}
function exchangeShift(schedule, date, shift, staffToAdd, staffToRemove) {
    const index = schedule[date][shift].indexOf(staffToRemove);
    if (index !== -1) {
        schedule[date][shift][index] = staffToAdd;
    }
}
function selectStaffForShift(availableStaff, requiredStaff, shift, currentDate, schedule, targetShifts) {
    const overallStats = calculateOverallStats(schedule, targetShifts);
    
    availableStaff.sort((a, b) => {
        const diffA = targetShifts - a.shiftCounts.total;
        const diffB = targetShifts - b.shiftCounts.total;

        // 優先選擇班次數較少的員工
        if (diffA !== diffB) return diffB - diffA;

        // 如果差異相同，考慮偏好權重
        const weightA = getShiftWeight(a, shift);
        const weightB = getShiftWeight(b, shift);
        if (weightA !== weightB) return weightB - weightA;

        // 如果以上條件都相同，隨機選擇
        return Math.random() - 0.5;
    });

    return availableStaff.slice(0, requiredStaff);
}

function getShiftWeight(staff, shift) {
    if (shift === 'nightShift') {
        if (staff.shift1 === shift) return 1.2;
        if (staff.shift2 === shift) return 1;
    } else if (shift === 'eveningShift') {
        if (staff.shift1 === shift) return 0.9;
        if (staff.shift2 === shift) return 0.7;
    } else {
        if (staff.shift1 === shift) return 0.5;
        if (staff.shift2 === shift) return 0.4;
    }
    return 0.5;
}

function calculateOverallStats(schedule, targetShifts) {
    const stats = {
        total: 0,
        filled: 0,
        unfilled: 0,
        staffStats: {}
    };

    for (const date in schedule) {
        for (const shift in schedule[date]) {
            stats.total += getShiftCount(shift);
            stats.filled += schedule[date][shift].length;
            stats.unfilled += getShiftCount(shift) - schedule[date][shift].length;

            schedule[date][shift].forEach(staffName => {
                if (!stats.staffStats[staffName]) {
                    stats.staffStats[staffName] = { total: 0, diff: 0 };
                }
                stats.staffStats[staffName].total++;
            });
        }
    }

    for (const staffName in stats.staffStats) {
        stats.staffStats[staffName].diff = stats.staffStats[staffName].total - targetShifts;
    }

    return stats;
}
function updateStaffStats(staff, shift, date) {
    if (shift) {
        staff.lastWorkDay = new Date(date).getDate();
        staff.lastShift = shift;
        staff.consecutiveWorkDays++;
        staff.shiftCounts[shift]++;
        staff.shiftCounts.total++;
    } else {
        staff.consecutiveWorkDays = 0;
        staff.shiftCounts.total--;
    }
}
function fillRemainingShifts(schedule, targetShifts) {
    const staffStats = calculateStaffStats(schedule);
    for (const date in schedule) {
        for (const shift of ['dayShift', 'eveningShift', 'nightShift']) {
            const requiredStaff = getShiftCount(shift);
            while (schedule[date][shift].length < requiredStaff) {
                const availableStaff = staffStats
                    .filter(staff => staff.total <= targetShifts)
                    .filter(staff => 
                        !schedule[date][shift].includes(staff.name) &&
                        canWorkShift(staff, shift, new Date(date).getDate(), date, getPreviousDate(date), schedule, new Date(date).getMonth() + 1)
                    );
                
                if (availableStaff.length > 0) {
                    const selectedStaff = selectStaffForShift(availableStaff, 1, shift, date, schedule, targetShifts)[0];
                    addStaffToShift(schedule, date, shift, selectedStaff.name);
                    updateStaffStats(selectedStaff, shift, date);
                    // 更新 staffStats
                    const staffIndex = staffStats.findIndex(s => s.name === selectedStaff.name);
                    if (staffIndex !== -1) {
                        staffStats[staffIndex] = {...selectedStaff};
                    }
                } else {
                    console.warn(`無法為 ${date} 的 ${shift} 找到合適的人員`);
                    break;
                }
            }
        }
    }
}
function removeStaffFromShift(schedule, date, shift, staffName) {
    const index = schedule[date][shift].indexOf(staffName);
    if (index !== -1) {
        schedule[date][shift].splice(index, 1);
    }
}
function balanceSchedule(schedule, targetShifts) {
    let isBalanced = false;
    let outerIterations = 0;
    const maxOuterIterations = 1000;

    while (!isBalanced && outerIterations < maxOuterIterations) {
        let changes;
        let iterations = 0;
        const maxIterations = 1000;

        do {
            changes = 0;
            const staffStats = calculateStaffStats(schedule);
            
            // 處理班次不足的情況
            staffStats.filter(staff => staff.total < targetShifts).forEach(underworkedStaff => {
                for (const date in schedule) {
                    for (const shift of ['dayShift', 'eveningShift', 'nightShift']) {
                        if (underworkedStaff.total >= targetShifts) break;
                        if (canWorkShift(underworkedStaff, shift, new Date(date).getDate(), date, getPreviousDate(date), schedule, new Date(date).getMonth() + 1)) {
                            const overworkedStaff = schedule[date][shift].find(name => 
                                staffStats.find(s => s.name === name && s.total > targetShifts + 1)
                            );
                            if (overworkedStaff) {
                                removeStaffFromShift(schedule, date, shift, overworkedStaff);
                                addStaffToShift(schedule, date, shift, underworkedStaff.name);
                                updateStaffStats(staffStats.find(s => s.name === overworkedStaff), null, date);
                                updateStaffStats(underworkedStaff, shift, date);
                                changes++;
                            } else if (schedule[date][shift].length < getShiftCount(shift)) {
                                addStaffToShift(schedule, date, shift, underworkedStaff.name);
                                updateStaffStats(underworkedStaff, shift, date);
                                changes++;
                            }
                        }
                    }
                    if (underworkedStaff.total >= targetShifts) break;
                }
            });

            // 處理班次過多的情況
            staffStats.filter(staff => staff.total > targetShifts + 1).forEach(overworkedStaff => {
                for (const date in schedule) {
                    for (const shift of ['dayShift', 'eveningShift', 'nightShift']) {
                        if (overworkedStaff.total <= targetShifts + 1) break;
                        if (schedule[date][shift].includes(overworkedStaff.name)) {
                            const underworkedStaff = staffStats.find(staff => 
                                staff.total < targetShifts && 
                                canWorkShift(staff, shift, new Date(date).getDate(), date, getPreviousDate(date), schedule, new Date(date).getMonth() + 1)
                            );
                            if (underworkedStaff) {
                                removeStaffFromShift(schedule, date, shift, overworkedStaff.name);
                                addStaffToShift(schedule, date, shift, underworkedStaff.name);
                                updateStaffStats(overworkedStaff, null, date);
                                updateStaffStats(underworkedStaff, shift, date);
                                changes++;
                            }
                        }
                    }
                    if (overworkedStaff.total <= targetShifts + 1) break;
                }
            });

            iterations++;
            if (iterations >= maxIterations) {
                console.warn("達到最大迭代次數，排班可能未完全優化");
                break;
            }
        } while (changes > 0);

        // 檢查是否所有員工的班次都在目標範圍內
        const finalStats = calculateStaffStats(schedule);
        isBalanced = finalStats.every(staff => staff.total >= targetShifts && staff.total <= targetShifts + 1);

        if (!isBalanced) {
            // 如果不平衡，隨機調整一些班次
            randomlyAdjustSchedule(schedule, targetShifts);
        }

        outerIterations++;
    }

    if (!isBalanced) {
        console.warn("無法達到完全平衡的排班，已達到最大嘗試次數");
    }

    return isBalanced;
}

function isStaffWorkingOnDate(schedule, date, staffName) {
    return ['dayShift', 'eveningShift', 'nightShift'].some(shift => 
        schedule[date][shift].includes(staffName)
    );
}

const SHIFT_TIMES = {
    nightShift: { start: 0, end: 8 },
    dayShift: { start: 8, end: 16 },
    eveningShift: { start: 16, end: 24 }
};
function balanceNightShifts(schedule, staffStats, targetShifts) {
    const nightShiftTarget = Math.floor(targetShifts / 3);
    const nightShiftImbalance = staffStats.filter(s => s.nightShift > nightShiftTarget);
    const needNightShifts = staffStats.filter(s => s.nightShift < nightShiftTarget);

    for (const date in schedule) {
        const nightShift = schedule[date].nightShift;
        for (let i = 0; i < nightShift.length; i++) {
            const staff = nightShift[i];
            const staffStat = staffStats.find(s => s.name === staff.name);
            if (staffStat && staffStat.nightShift > nightShiftTarget) {
                const replacementStaff = needNightShifts.find(s => 
                    !schedule[date].dayShift.some(ds => ds.name === s.name) &&
                    !schedule[date].eveningShift.some(es => es.name === s.name) &&
                    canWorkShift(s, 'nightShift', new Date(date).getDate(), date, getPreviousDate(date), schedule, new Date(date).getMonth() + 1)
                );
                if (replacementStaff) {
                    nightShift[i] = { name: replacementStaff.name, order: staff.order };
                    staffStat.nightShift--;
                    replacementStaff.nightShift++;
                    if (staffStat.nightShift <= nightShiftTarget) {
                        nightShiftImbalance.splice(nightShiftImbalance.indexOf(staffStat), 1);
                    }
                    if (replacementStaff.nightShift >= nightShiftTarget) {
                        needNightShifts.splice(needNightShifts.indexOf(replacementStaff), 1);
                    }
                }
            }
        }
    }
}

function balanceOtherShifts(schedule, overworkedStaff, underworkedStaff, targetShifts) {
    const shifts = ['dayShift', 'eveningShift'];
    for (const date in schedule) {
        for (const shift of shifts) {
            const shiftStaff = schedule[date][shift];
            for (let i = 0; i < shiftStaff.length; i++) {
                const staff = shiftStaff[i];
                const staffStat = overworkedStaff.find(s => s.name === staff.name);
                if (staffStat && staffStat.total > targetShifts) {
                    const replacementStaff = underworkedStaff.find(s => 
                        s.total < targetShifts &&
                        !schedule[date].nightShift.some(ns => ns.name === s.name) &&
                        canWorkShift(s, shift, new Date(date).getDate(), date, getPreviousDate(date), schedule, new Date(date).getMonth() + 1)
                    );
                    if (replacementStaff) {
                        shiftStaff[i] = { name: replacementStaff.name, order: staff.order };
                        staffStat.total--;
                        staffStat[shift]--;
                        replacementStaff.total++;
                        replacementStaff[shift]++;
                        if (staffStat.total <= targetShifts) {
                            overworkedStaff.splice(overworkedStaff.indexOf(staffStat), 1);
                        }
                        if (replacementStaff.total >= targetShifts) {
                            underworkedStaff.splice(underworkedStaff.indexOf(replacementStaff), 1);
                        }
                    }
                }
            }
        }
    }
}


function calculateStaffStats(schedule) {
    const stats = {};
    const daysInMonth = Object.keys(schedule).length;

    staffList.forEach(staff => {
        stats[staff.name] = {
            name: staff.name,
            total: 0,
            dayShift: 0,
            eveningShift: 0,
            nightShift: 0,
            workDays: 0,
            maxConsecutiveWorkDays: 0,
            currentConsecutiveWorkDays: 0,
            order: staff.order
        };
    });

    let prevDate = null;
    const sortedDates = Object.keys(schedule).sort();

    sortedDates.forEach(date => {
        const dayStats = new Set();

        ['dayShift', 'eveningShift', 'nightShift'].forEach(shift => {
            schedule[date][shift].forEach(staffName => {
                if (stats[staffName]) {
                    stats[staffName].total++;
                    stats[staffName][shift]++;
                    dayStats.add(staffName);
                }
            });
        });

        dayStats.forEach(staffName => {
            stats[staffName].workDays++;
            stats[staffName].currentConsecutiveWorkDays++;

            if (stats[staffName].currentConsecutiveWorkDays > stats[staffName].maxConsecutiveWorkDays) {
                stats[staffName].maxConsecutiveWorkDays = stats[staffName].currentConsecutiveWorkDays;
            }
        });

        // 重置未工作的員工的連續工作天數
        Object.keys(stats).forEach(staffName => {
            if (!dayStats.has(staffName)) {
                stats[staffName].currentConsecutiveWorkDays = 0;
            }
        });

        prevDate = date;
    });

    // 計算休假日數
    Object.values(stats).forEach(stat => {
        stat.daysOff = daysInMonth - stat.workDays;
    });

    return Object.values(stats).sort((a, b) => {
        const staffA = staffList.find(s => s.name === a.name);
        const staffB = staffList.find(s => s.name === b.name);
        return staffA.order - staffB.order;
    });
}
function updateStaffShiftCounts(schedule) {
    // 重置所有員工的班次計數
    staffList.forEach(staff => {
        staff.shiftCounts = { dayShift: 0, eveningShift: 0, nightShift: 0, total: 0 };
    });

    // 遍歷排班表，更新每個員工的班次計數
    for (const date in schedule) {
        for (const shift in schedule[date]) {
            schedule[date][shift].forEach(staffName => {
                const staff = staffList.find(s => s.name === staffName);
                if (staff) {
                    staff.shiftCounts[shift]++;
                    staff.shiftCounts.total++;
                }
            });
        }
    }
}
function displayDetailedSchedule(schedule) {
    const detailedScheduleDiv = document.getElementById("detailedScheduleResult");
    detailedScheduleDiv.innerHTML = "";

    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";

    // 創建表頭
    const headerRow1 = document.createElement("tr");
    const headerRow2 = document.createElement("tr");

    // 添加左上角對角線分割的單元格
    headerRow1.innerHTML = `
        <th rowspan="2" style='border: 1px solid black; padding: 5px; position: relative; width: 60px; height: 60px;'>
            <div style='position: absolute; top: 0; left: 0; right: 0; bottom: 0;'>
                <div style='position: absolute; top: 5px; right: 5px;'>日期</div>
                <div style='position: absolute; bottom: 5px; left: 5px;'>姓名</div>
                <div style='position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100px; border-top: 1px solid black; transform: rotate(45deg); transform-origin: top left;'></div>
            </div>
        </th>
    `;

    const dates = Object.keys(schedule).sort();
    dates.forEach(date => {
        const day = new Date(date).getDate();
        const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date(date).getDay()];
        headerRow1.innerHTML += `<th style='border: 1px solid black; padding: 2px; text-align: center;'>${day}</th>`;
        headerRow2.innerHTML += `<th style='border: 1px solid black; padding: 2px; text-align: center;'>${weekday}</th>`;
    });
    table.appendChild(headerRow1);
    table.appendChild(headerRow2);

    // 為每個員工創建一行
    staffList.forEach(staff => {
        const row = document.createElement("tr");
        row.innerHTML = `<td style='border: 1px solid black; padding: 2px; text-align: center'>${staff.name}</td>`;

        dates.forEach(date => {
            let cellContent = "";
            if (schedule[date].dayShift.includes(staff.name)) {
                cellContent = "白";
            } else if (schedule[date].eveningShift.includes(staff.name)) {
                cellContent = "小";
            } else if (schedule[date].nightShift.includes(staff.name)) {
                cellContent = "大";
            }
            row.innerHTML += `<td style='border: 1px solid black; padding: 2px; text-align: center;'>${cellContent}</td>`;
        });

        table.appendChild(row);
    });

    detailedScheduleDiv.appendChild(table);
}
function displaySchedule(schedule) {
    const scheduleResultDiv = document.getElementById("scheduleResult");
    scheduleResultDiv.innerHTML = "";

    const table = document.createElement("table");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = "<th>日期</th><th>白班</th><th>小夜</th><th>大夜</th>";
    table.appendChild(headerRow);

    const sortedDates = Object.keys(schedule).sort();
    for (const date of sortedDates) {
        const row = document.createElement("tr");
        const dayCell = document.createElement("td");
        dayCell.textContent = date;
        row.appendChild(dayCell);

        ['dayShift', 'eveningShift', 'nightShift'].forEach(shift => {
            const cell = document.createElement("td");
            const sortedStaff = schedule[date][shift].sort((a, b) => {
                const staffA = staffList.find(s => s.name === a);
                const staffB = staffList.find(s => s.name === b);
                return staffA.order - staffB.order;
            });
            cell.textContent = sortedStaff.join(", ");
            row.appendChild(cell);
        });

        table.appendChild(row);
    }

    scheduleResultDiv.appendChild(table);
}


function displayStatistics(schedule, targetShifts) {
    const statisticsResultDiv = document.getElementById("statisticsResult");
    statisticsResultDiv.innerHTML = "";

    let stats = calculateStaffStats(schedule);

    const table = document.createElement("table");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `
        <th>人員</th>
        <th>目標班次</th>
        <th>實際總班次</th>
        <th>白班</th>
        <th>小夜</th>
        <th>大夜</th>
        <th>上班天數</th>
        <th>休假日數</th>
        <th>最多連續上班天數</th>
        <th>差異</th>
    `;
    table.appendChild(headerRow);

    stats.forEach(stat => {
        const row = document.createElement("tr");
        const difference = stat.total - targetShifts;
        row.innerHTML = `
            <td>${stat.name}</td>
            <td>${targetShifts}</td>
            <td>${stat.total}</td>
            <td>${stat.dayShift}</td>
            <td>${stat.eveningShift}</td>
            <td>${stat.nightShift}</td>
            <td>${stat.workDays}</td>
            <td>${stat.daysOff}</td>
            <td>${stat.maxConsecutiveWorkDays}</td>
            <td>${difference > 0 ? '+' : ''}${difference}</td>
        `;
        table.appendChild(row);
    });

    statisticsResultDiv.appendChild(table);
}

function getSortedStaff(schedule) {
    const allStaff = new Set();
    Object.values(schedule).forEach(day => {
        ['dayShift', 'eveningShift', 'nightShift'].forEach(shift => {
            day[shift].forEach(staffObj => {
                if (staffObj && staffObj.name) {
                    allStaff.add(staffObj);
                }
            });
        });
    });

    return Array.from(allStaff).sort((a, b) => a.order - b.order);
}