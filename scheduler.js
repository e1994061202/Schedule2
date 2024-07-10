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

function getPreviousDate(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}

function generateSchedule() {
    const year = parseInt(document.getElementById("year").value);
    const month = parseInt(document.getElementById("month").value);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const dayShiftCount = parseInt(document.getElementById("dayShiftCount").value);
    const eveningShiftCount = parseInt(document.getElementById("eveningShiftCount").value);
    const nightShiftCount = parseInt(document.getElementById("nightShiftCount").value);

    // 錯誤檢查
    if (!Array.isArray(staffList) || staffList.length === 0) {
        alert("錯誤：沒有可用的員工列表");
        return;
    }

    if (isNaN(dayShiftCount) || isNaN(eveningShiftCount) || isNaN(nightShiftCount) ||
        dayShiftCount <= 0 || eveningShiftCount <= 0 || nightShiftCount <= 0) {
        alert("錯誤：班次人數設置無效");
        return;
    }

    const totalShiftsPerDay = dayShiftCount + eveningShiftCount + nightShiftCount;
    const targetShifts = Math.floor((daysInMonth * totalShiftsPerDay) / staffList.length);

    const schedule = {};
    for (let day = 1; day <= daysInMonth; day++) {
        schedule[`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`] = {
            dayShift: [],
            eveningShift: [],
            nightShift: []
        };
    }

    // 初始化每個員工的排班計數和連續工作天數
    staffList.forEach(staff => {
        staff.shiftCounts = { dayShift: 0, eveningShift: 0, nightShift: 0, total: 0 };
        staff.consecutiveWorkDays = calculateConsecutiveWorkDays(safeGet(staff, 'previousMonthSchedules', []));
        staff.lastWorkDay = safeArrayIncludes(safeGet(staff, 'previousMonthSchedules', []), true) ? 0 : null;
        staff.lastShift = safeGet(staff, 'lastMonthLastDayShift', null);
        staff.scheduledDates = [];
    });

    // 獲取上個月最後一天的班次信息
    const lastMonthLastDayShift = {};
    staffList.forEach(staff => {
        lastMonthLastDayShift[staff.name] = staff.lastMonthLastDayShift;
    });

    let unfilledShifts = [];

    // 處理每一天的排班
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const previousDate = day > 1 ? 
            `${year}-${month.toString().padStart(2, '0')}-${(day-1).toString().padStart(2, '0')}` : 
            `${year}-${(month-1).toString().padStart(2, '0')}-${new Date(year, month-1, 0).getDate()}`;
        
        let scheduledStaffForDay = new Set();

        function scheduleShift(shift, requiredStaff) {
            let availableStaff = staffList.filter(staff => 
                !scheduledStaffForDay.has(staff.name) &&
                !safeArrayIncludes(safeGet(staff, 'prescheduledDates', []), day) &&
                canWorkShift(staff, shift, day, currentDate, previousDate, schedule, month, lastMonthLastDayShift) &&
                staff.shiftCounts.total < targetShifts
            );

            const selectedStaff = selectStaffForShift(availableStaff, requiredStaff, shift, day === 1, targetShifts);

            selectedStaff.forEach(staff => addStaffToSchedule(staff, shift, currentDate, day));

            return selectedStaff.length;
        }

        function addStaffToSchedule(staff, shift, date, day) {
            if (scheduledStaffForDay.has(staff.name)) {
                console.warn(`Warning: ${staff.name} is already scheduled for ${date}`);
                return;
            }
            
            schedule[date][shift].push(staff.name);
            staff.shiftCounts[shift]++;
            staff.shiftCounts.total++;
            staff.consecutiveWorkDays++;
            staff.lastWorkDay = day;
            staff.lastShift = shift;
            staff.scheduledDates.push(date);
            scheduledStaffForDay.add(staff.name);
        }

        // 按照白班 -> 小夜班 -> 大夜班的順序排班
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
            }
        });
    }

    // 如果有未填滿的班次,顯示警告
    if (unfilledShifts.length > 0) {
        alert("警告：以下班次人數不足：\n" + unfilledShifts.join("\n"));
        console.warn("未填滿的班次：", unfilledShifts);
    }

    // 執行平衡步驟
    balanceSchedule(schedule, targetShifts);

    // 更新員工的實際班次信息
    updateStaffShiftCounts(schedule);

    // 顯示排班結果
    displaySchedule(schedule);
    displayStatistics(schedule, targetShifts);
}
function canWorkShift(staff, shift, day, currentDate, previousDate, schedule, currentMonth, lastMonthLastDayShift) {
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
        } else {
            console.warn(`Invalid shift type for staff ${staff.name}: last shift = ${staff.lastShift}, current shift = ${shift}`);
            return false;
        }
    }

    // 檢查前一天的班次，包括跨月情況
    let previousShift = null;
    if (day === 1) {
        previousShift = lastMonthLastDayShift[staff.name];
    } else if (schedule[previousDate]) {
        if (schedule[previousDate].nightShift.some(s => s.name === staff.name)) previousShift = 'nightShift';
        else if (schedule[previousDate].eveningShift.some(s => s.name === staff.name)) previousShift = 'eveningShift';
        else if (schedule[previousDate].dayShift.some(s => s.name === staff.name)) previousShift = 'dayShift';
    }

    // 不允許大夜班或小夜班後接白班（包括跨月情況）
    if (shift === 'dayShift' && (previousShift === 'nightShift' || previousShift === 'eveningShift')) {
        return false;
    }

    // 小夜接白班需要休息一天（包括跨月情況）
    if (shift === 'dayShift' && day > 1) {
        const twoDaysAgo = new Date(currentDate);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoString = twoDaysAgo.toISOString().split('T')[0];
        if (schedule[twoDaysAgoString] && schedule[twoDaysAgoString].eveningShift.some(s => s.name === staff.name)) {
            return false;
        }
    } else if (shift === 'dayShift' && day === 1) {
        // 檢查上個月倒數第二天是否為小夜班
        const secondLastDayShift = staff.previousMonthSchedules ? staff.previousMonthSchedules[staff.previousMonthSchedules.length - 2] : null;
        if (secondLastDayShift === 'eveningShift') {
            return false;
        }
    }

    return true;
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

function exchangeShift(schedule, date, shift, staffToAdd, staffToRemove) {
    const shiftIndex = schedule[date][shift].indexOf(staffToRemove);
    if (shiftIndex !== -1) {
        schedule[date][shift][shiftIndex] = staffToAdd;
    }
}
function selectStaffForShift(availableStaff, requiredStaff, shift, isFirstDay, targetShifts) {
    const minShifts = targetShifts;

    availableStaff.sort((a, b) => {
        const remainingA = targetShifts - a.shiftCounts.total;
        const remainingB = targetShifts - b.shiftCounts.total;

        const weightA = getShiftWeight(a, shift);
        const weightB = getShiftWeight(b, shift);

        // 如果a的偏好權重高於b,優先選擇a
        if (weightA > weightB) return -1;
        if (weightB > weightA) return 1;

        // 如果偏好權重相同,比較總班次數與目標值之間的差異
        if (remainingA > 0 && remainingB <= 0) return -1;
        if (remainingB > 0 && remainingA <= 0) return 1;

        // 如果差異都為負數,選擇差異絕對值更大的人員
        if (remainingA > 0 && remainingB > 0) return remainingB - remainingA;

        // 如果差異都為正數或零,選擇總班次數更少的人員
        if (remainingA <= 0 && remainingB <= 0) return a.shiftCounts.total - b.shiftCounts.total;

        // 如果上述條件都相同,選擇總班次數更少的人員
        return a.shiftCounts.total - b.shiftCounts.total;
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


function balanceSchedule(schedule, targetShifts) {
    const staffStats = calculateStaffStats(schedule);

    staffStats.forEach(staff => {
        if (staff.total < targetShifts) {
            const missingShifts = targetShifts - staff.total;
            for (let i = 0; i < missingShifts; i++) {
                const { date, shift, exchangedStaff } = findExchangeableShift(schedule, staff, targetShifts);
                if (date && shift && exchangedStaff) {
                    exchangeShift(schedule, date, shift, staff.name, exchangedStaff);
                } else {
                    break;
                }
            }
        }
    });
}
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
    staffList.forEach(staff => {
        if (!stats[staff.name]) {
            stats[staff.name] = { name: staff.name, dayShift: 0, eveningShift: 0, nightShift: 0, total: 0 };
        }
    });

    for (const date in schedule) {
        for (const shift in schedule[date]) {
            schedule[date][shift].forEach(staffName => {
                if (stats[staffName]) {
                    stats[staffName][shift]++;
                    stats[staffName].total++;
                }
            });
        }
    }

    return Object.values(stats);
}

function updateStaffShiftCounts(schedule) {
    staffList.forEach(staff => {
        staff.shiftCounts = { dayShift: 0, eveningShift: 0, nightShift: 0, total: 0 };
    });

    for (const date in schedule) {
        for (const shift in schedule[date]) {
            schedule[date][shift].forEach(staffObj => {
                const staff = staffList.find(s => s.name === staffObj.name);
                if (staff) {
                    staff.shiftCounts[shift]++;
                    staff.shiftCounts.total++;
                }
            });
        }
    }
}

function displaySchedule(schedule) {
    const scheduleResultDiv = document.getElementById("scheduleResult");
    scheduleResultDiv.innerHTML = "";

    const table = document.createElement("table");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = "<th>日期</th><th>白班</th><th>小夜</th><th>大夜</th>";
    table.appendChild(headerRow);

    for (const date in schedule) {
        const row = document.createElement("tr");
        const dayCell = document.createElement("td");
        dayCell.textContent = date;
        row.appendChild(dayCell);

        ['dayShift', 'eveningShift', 'nightShift'].forEach(shift => {
            const cell = document.createElement("td");
            cell.textContent = schedule[date][shift].join(", ");
            row.appendChild(cell);
        });

        table.appendChild(row);
    }

    scheduleResultDiv.appendChild(table);
}

function displayStatistics(schedule, targetShifts) {
    const statisticsResultDiv = document.getElementById("statisticsResult");
    statisticsResultDiv.innerHTML = "";

    const stats = calculateStaffStats(schedule);

    const table = document.createElement("table");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = "<th>人員</th><th>目標班次</th><th>實際總班次</th><th>白班</th><th>小夜</th><th>大夜</th><th>差異</th>";
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