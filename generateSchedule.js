// 全局變量
let dayShiftCount, eveningShiftCount, nightShiftCount;

if (typeof SHIFTS === 'undefined') {
    // 定義班次常量
    const SHIFTS = {
        DAY: 'DAY',
        EVENING: 'EVENING',
        NIGHT: 'NIGHT'
    };
}

if (typeof SHIFT_DISPLAY === 'undefined') {
    // 定義班次顯示名稱
    const SHIFT_DISPLAY = {
        [SHIFTS.DAY]: '白班',
        [SHIFTS.EVENING]: '小夜',
        [SHIFTS.NIGHT]: '大夜'
    };
}
// 全局變量
let iteration = 0;
let maxIterations = 5000000; // 假設最大迭代次數為 5,000,000
let lastProgress = 0;

function updateProgress() {
    const progress = (iteration / maxIterations) * 100;
    if (progress - lastProgress >= 1 || progress === 100) {
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('progressText').textContent = `${Math.round(progress)}%`;
        lastProgress = progress;
    }
    if (iteration < maxIterations) {
        requestAnimationFrame(updateProgress);
    }
}
function generateSchedule() {
    console.log("Generating schedule...");
    
    // 重置迭代計數器
    iteration = 0;
    
    // 顯示進度條並重置
    document.getElementById('progressDiv').style.display = 'block';
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressText').textContent = '0%';
    
    // 開始更新進度
    requestAnimationFrame(updateProgress);
    
    // 添加提示
    alert("排班過程已開始，請稍候。您可以在進度條中查看進度。");

    const year = parseInt(document.getElementById("year").value);
    const month = parseInt(document.getElementById("month").value);
    const daysInMonth = new Date(year, month, 0).getDate();

    console.log("staffList:", staffList);
    console.log("Year:", year);
    console.log("Month:", month);
    console.log("Days in month:", daysInMonth);
    console.log("Day shift count:", dayShiftCount);
    console.log("Evening shift count:", eveningShiftCount);
    console.log("Night shift count:", nightShiftCount);

    if (dayShiftCount === 0 && eveningShiftCount === 0 && nightShiftCount === 0) {
        alert("請設置至少一個班次的人數！");
        return;
    }

    // 更新每個員工的連續工作天數
    staffList.forEach(staff => {
        staff.consecutiveWorkDays = calculateLastMonthConsecutiveWorkDays(staff);
        console.log(`${staff.name} consecutive work days from last month: ${staff.consecutiveWorkDays}`);
    });

    // 初始化排班表
    let schedule = initializeSchedule(daysInMonth, year, month);
    console.log("Initial schedule:", schedule);

    // 執行模擬退火算法
    schedule = simulatedAnnealing(schedule, year, month);
    console.log("Final schedule after simulated annealing:", schedule);

    // 更新每個員工的實際排班天數
    staffList.forEach(staff => {
        staff.actualShiftDays = calculateActualShiftDays(staff, schedule);
        console.log(`${staff.name} actual shift days: ${staff.actualShiftDays}`);
    });

    // 顯示最終排班表
    displaySchedule(schedule, year, month);
    displayStatistics(schedule);
    displayScheduleMatrix(schedule, year, month);

    // 輸出最終的排班統計
    console.log("Final scheduling statistics:");
    staffList.forEach(staff => {
        console.log(`${staff.name}:`);
        console.log(`  Expected shifts: ${staff.personalExpectedDays}`);
        console.log(`  Actual shifts: ${staff.actualShiftDays}`);
        console.log(`  Preferred shifts: ${SHIFT_DISPLAY[staff.shift1]}, ${SHIFT_DISPLAY[staff.shift2]}`);
    });

    // 執行最終檢查
    const violations = finalScheduleCheck(schedule);
    console.log("Final schedule check results:", violations);

    if (violations.length > 0) {
        console.warn("Warning: The generated schedule has some violations. Please review and adjust manually if necessary.");
        alert("排班表生成完成，但存在一些違規情況。請查看控制台日誌以獲取詳細信息，並考慮手動調整。");
        violations.forEach(v => console.error(v));
    } else {
        console.log("The generated schedule meets all constraints.");
        alert("排班表生成成功，並滿足所有約束條件！");
    }

    // 最終檢查每個人的實際班次數
    let shiftCountMismatch = false;
    staffList.forEach(staff => {
        const actualShifts = Object.values(schedule).reduce((count, daySchedule) => {
            return count + Object.values(daySchedule).filter(staffList => staffList.includes(staff.name)).length;
        }, 0);
        if (actualShifts !== staff.personalExpectedDays) {
            console.error(`Error: ${staff.name}'s actual shifts (${actualShifts}) do not match expected shifts (${staff.personalExpectedDays})`);
            shiftCountMismatch = true;
        }
    });

    if (shiftCountMismatch) {
        console.error("The schedule does not meet the requirement of matching each person's expected shift count.");
        alert("警告：某些員工的實際排班數量與預期不符。請查看控制台日誌以獲取詳細信息。");
    }

    // 隱藏進度條
    document.getElementById('progressDiv').style.display = 'none';
}
function calculateActualShiftDays(staff, schedule) {
    return Object.values(schedule).reduce((count, daySchedule) => {
        return count + Object.values(daySchedule).filter(staffList => staffList.includes(staff.name)).length;
    }, 0);
}
function checkAllViolations(schedule, year, month) {
    const violations = {
        shiftCoverage: checkShiftCoverage(schedule),
        consecutiveWorkDays: checkConsecutiveWorkDays(schedule, year, month),
        preferredShifts: checkPreferredShiftsStrict(schedule),
        isolatedWorkDays: checkIsolatedWorkDays(schedule),
        restBetweenShifts: checkRestBetweenShifts(schedule),
        actualVsExpected: checkActualVsExpectedShifts(schedule),
        monthEndVacation: checkMonthEndVacationPriority(schedule, year, month),
        multipleShiftsPerDay: checkOnlyOneShiftPerDay(schedule)
    };

    violations.totalViolations = Object.values(violations).reduce((sum, value) => sum + value, 0);

    return violations;
}

// 初始化排班表
function initializeSchedule(daysInMonth, year, month) {
    let schedule = {};
    for (let day = 1; day <= daysInMonth; day++) {
        schedule[day] = {
            [SHIFTS.DAY]: [],
            [SHIFTS.EVENING]: [],
            [SHIFTS.NIGHT]: []
        };
    }

    // 為每個員工創建一個剩餘班次計數器
    let remainingShifts = staffList.map(staff => ({
        name: staff.name,
        remaining: staff.personalExpectedDays,
        shift1: staff.shift1,
        shift2: staff.shift2
    }));

    // 先填充預排班
    staffList.forEach(staff => {
        staff.prescheduledDates.forEach(preSchedule => {
            if (preSchedule.date <= daysInMonth && 
                (preSchedule.shift === staff.shift1 || preSchedule.shift === staff.shift2) &&
                !isPreVacationDay(staff, preSchedule.date)) {
                schedule[preSchedule.date][preSchedule.shift].push(staff.name);
                remainingShifts.find(s => s.name === staff.name).remaining--;
            }
        });
    });

    // 分配剩餘的班次
    for (let day = 1; day <= daysInMonth; day++) {
        for (let shift in SHIFTS) {
            const requiredStaff = getRequiredStaffForShift(SHIFTS[shift]);
            while (schedule[day][SHIFTS[shift]].length < requiredStaff) {
                // 優先選擇剩餘班次最多的員工
                const availableStaff = remainingShifts.filter(staff => 
                    staff.remaining > 0 &&
                    !isStaffWorkingOnDay({name: staff.name}, day, schedule) &&
                    !wouldCauseConsecutiveViolation(staffList.find(s => s.name === staff.name), day, schedule, year, month) &&
                    (SHIFTS[shift] === staff.shift1 || SHIFTS[shift] === staff.shift2) &&
                    !isPreVacationDay(staffList.find(s => s.name === staff.name), day) // 確保不在預休日排班
                ).sort((a, b) => b.remaining - a.remaining);

                if (availableStaff.length > 0) {
                    const staffToAssign = availableStaff[0];
                    schedule[day][SHIFTS[shift]].push(staffToAssign.name);
                    staffToAssign.remaining--;
                } else {
                    break; // 如果沒有可用的員工，跳出循環
                }
            }
        }
    }

    console.log("Initial schedule after initialization:", schedule);
    console.log("Remaining shifts after initialization:", remainingShifts);
    return schedule;
}
// 模擬退火算法
function simulatedAnnealing(initialSchedule, year, month) {
    let currentSchedule = JSON.parse(JSON.stringify(initialSchedule));
    let bestSchedule = JSON.parse(JSON.stringify(currentSchedule));
    let currentEnergy = calculateEnergy(currentSchedule, year, month);
    let bestEnergy = currentEnergy;

    const initialTemperature = 2000;
    const coolingRate = 0.99995;
    let temperature = initialTemperature;

    console.log("Starting simulated annealing...");
    console.log("Initial energy:", currentEnergy);

    while (temperature > 1 && iteration < maxIterations) {
        let newSchedule = generateNeighbor(currentSchedule, year, month);
        let newEnergy = calculateEnergy(newSchedule, year, month);

        if (acceptanceProbability(currentEnergy, newEnergy, temperature) > Math.random()) {
            currentSchedule = newSchedule;
            currentEnergy = newEnergy;

            if (currentEnergy < bestEnergy) {
                bestSchedule = JSON.parse(JSON.stringify(currentSchedule));
                bestEnergy = currentEnergy;
                console.log(`New best energy found: ${bestEnergy} at iteration ${iteration}`);
            }
        }

        temperature *= coolingRate;
        iteration++;

        if (iteration % 10000 === 0) {
            console.log(`Iteration: ${iteration}, Temperature: ${temperature}, Current Energy: ${currentEnergy}, Best Energy: ${bestEnergy}`);
        }

        // 如果找到一個完美的解決方案，提前結束
        if (bestEnergy === 0) {
            console.log("Perfect solution found. Ending simulated annealing early.");
            break;
        }
    }

    console.log("Simulated annealing completed.");
    console.log(`Final best energy: ${bestEnergy}`);
    console.log(`Total iterations: ${iteration}`);

    return bestSchedule;
}

function acceptanceProbability(currentEnergy, newEnergy, temperature) {
    if (newEnergy < currentEnergy) {
        return 1.0;
    }
    return Math.exp((currentEnergy - newEnergy) / temperature);
}

function acceptanceProbability(currentEnergy, newEnergy, temperature) {
    if (newEnergy < currentEnergy) {
        return 1.0;
    }
    return Math.exp((currentEnergy - newEnergy) / temperature);
}


function checkOnlyOneShiftPerDay(schedule) {
    let violations = 0;
    for (let day in schedule) {
        const staffWorking = new Set();
        for (let shift in schedule[day]) {
            schedule[day][shift].forEach(staffName => {
                if (staffWorking.has(staffName)) {
                    violations++;
                } else {
                    staffWorking.add(staffName);
                }
            });
        }
    }
    return violations;
}
// 生成鄰近解
function generateNeighbor(schedule, year, month) {
    let newSchedule = JSON.parse(JSON.stringify(schedule));
    const day1 = Math.floor(Math.random() * Object.keys(schedule).length) + 1;
    const day2 = Math.floor(Math.random() * Object.keys(schedule).length) + 1;
    const shift1 = Object.values(SHIFTS)[Math.floor(Math.random() * Object.values(SHIFTS).length)];
    const shift2 = Object.values(SHIFTS)[Math.floor(Math.random() * Object.values(SHIFTS).length)];
    
    if (newSchedule[day1][shift1].length > 0 && newSchedule[day2][shift2].length > 0) {
        const staff1Index = Math.floor(Math.random() * newSchedule[day1][shift1].length);
        const staff2Index = Math.floor(Math.random() * newSchedule[day2][shift2].length);
        const staff1 = staffList.find(s => s.name === newSchedule[day1][shift1][staff1Index]);
        const staff2 = staffList.find(s => s.name === newSchedule[day2][shift2][staff2Index]);

        // 检查交换是否符合所有条件，包括不超过连续6天工作
        if ((shift1 === staff2.shift1 || shift1 === staff2.shift2) &&
            (shift2 === staff1.shift1 || shift2 === staff1.shift2) &&
            !isStaffWorkingOnDay(staff1, day2, newSchedule) &&
            !isStaffWorkingOnDay(staff2, day1, newSchedule) &&
            !isPreVacationDay(staff1, day2) &&
            !isPreVacationDay(staff2, day1) &&
            (isPrescheduledShift(staff2, day1, shift1) || !isPrescheduledDay(staff2, day1)) &&
            (isPrescheduledShift(staff1, day2, shift2) || !isPrescheduledDay(staff1, day2)) &&
            !wouldCreateForbiddenShiftConnection(staff1, day2, shift2, newSchedule) &&
            !wouldCreateForbiddenShiftConnection(staff2, day1, shift1, newSchedule) &&
            !wouldExceedConsecutiveWorkDays(staff1, day2, newSchedule) &&
            !wouldExceedConsecutiveWorkDays(staff2, day1, newSchedule)) {
            // 交换班次
            newSchedule[day1][shift1][staff1Index] = staff2.name;
            newSchedule[day2][shift2][staff2Index] = staff1.name;
        }
    }

    return newSchedule;
}

// 檢查是否會超過連續6天工作
function wouldExceedConsecutiveWorkDays(staff, day, schedule) {
    let consecutiveDays = 0;
    // 檢查當前日期前的連續工作天數
    for (let i = day - 1; i > 0 && consecutiveDays < 6; i--) {
        if (isStaffWorkingOnDay(staff, i, schedule)) {
            consecutiveDays++;
        } else {
            break;
        }
    }
    // 檢查當前日期後的連續工作天數
    for (let i = day; i <= Object.keys(schedule).length && consecutiveDays < 6; i++) {
        if (i === day || isStaffWorkingOnDay(staff, i, schedule)) {
            consecutiveDays++;
        } else {
            break;
        }
    }
    return consecutiveDays > 6;
}
// 計算能量（評估排班表的好壞）
function calculateEnergy(schedule, year, month) {
    let energy = 0;
    
    energy += checkShiftCoverage(schedule) * 3000;
    energy += checkPreferredShiftsStrict(schedule) * 1000;
    energy += checkIsolatedWorkDays(schedule) * 200;
    energy += checkRestBetweenShifts(schedule) * 200;
    energy += checkActualVsExpectedShifts(schedule) * 10000;
    energy += checkMonthEndVacationPriority(schedule, year, month) * 50;
    energy += checkOnlyOneShiftPerDay(schedule) * 100000;
    energy += checkPrescheduledViolations(schedule) * 50000;
    energy += checkForbiddenShiftConnections(schedule) * 100000;
    
    // 預休違規和連續工作天數檢查移至最後進行，確保絕對不會發生
    const preVacationViolations = checkPreVacationViolations(schedule);
    const consecutiveWorkDaysViolations = checkConsecutiveWorkDays(schedule, year, month);
    if (preVacationViolations > 0 || consecutiveWorkDaysViolations > 0) {
        return Infinity; // 如果有預休違規或連續工作超過6天，直接返回無窮大的能量值
    }
    
    return energy;
}

// 在生成排班表後進行最終檢查
function finalScheduleCheck(schedule) {
    let violations = [];
    
    // 檢查預休日違規
    staffList.forEach(staff => {
        staff.preVacationDates.forEach(day => {
            if (isStaffWorkingOnDay(staff, day, schedule)) {
                violations.push(`${staff.name} 在預休日 ${day} 被排班`);
            }
        });
    });
    
    // 檢查禁止的班次連接
    for (let day = 1; day < Object.keys(schedule).length; day++) {
        Object.values(SHIFTS).forEach(shift => {
            schedule[day][shift].forEach(staffName => {
                const staff = staffList.find(s => s.name === staffName);
                const nextDayShift = getStaffShiftForDay(staff, day + 1, schedule);
                if (isForbiddenShiftConnection(shift, nextDayShift)) {
                    violations.push(`${staff.name} 在第 ${day} 天的 ${SHIFT_DISPLAY[shift]} 後接 ${SHIFT_DISPLAY[nextDayShift]}`);
                }
            });
        });
    }
    
    return violations;
}

// 檢查預休日排班違規
function checkPreVacationViolations(schedule) {
    let violations = 0;
    for (let day in schedule) {
        for (let shift in schedule[day]) {
            schedule[day][shift].forEach(staffName => {
                const staff = staffList.find(s => s.name === staffName);
                if (isPreVacationDay(staff, parseInt(day))) {
                    violations++;
                }
            });
        }
    }
    return violations;
}
// 檢查預班違規
function checkPrescheduledViolations(schedule) {
    let violations = 0;
    staffList.forEach(staff => {
        staff.prescheduledDates.forEach(prescheduled => {
            const day = prescheduled.date;
            const shift = prescheduled.shift;
            if (!schedule[day][shift].includes(staff.name)) {
                violations++;
            }
        });
    });
    return violations;
}
// 新增：檢查是否會造成禁止的班次連接
function wouldCreateForbiddenShiftConnection(staff, day, newShift, schedule) {
    const previousDay = day - 1;
    const nextDay = day + 1;
    
    // 檢查前一天的班次
    if (previousDay > 0) {
        const previousShift = getStaffShiftForDay(staff, previousDay, schedule);
        if (isForbiddenShiftConnection(previousShift, newShift)) {
            return true;
        }
    }
    
    // 檢查後一天的班次
    if (nextDay <= Object.keys(schedule).length) {
        const nextShift = getStaffShiftForDay(staff, nextDay, schedule);
        if (isForbiddenShiftConnection(newShift, nextShift)) {
            return true;
        }
    }
    
    return false;
}

// 新增：判斷兩個班次的連接是否被禁止
function isForbiddenShiftConnection(shift1, shift2) {
    if (!shift1 || !shift2) return false; // 如果其中一個班次不存在，則不算違規
    
    const forbiddenConnections = [
        [SHIFTS.EVENING, SHIFTS.DAY],    // 小夜接白班
        [SHIFTS.EVENING, SHIFTS.NIGHT],  // 小夜接大夜
        [SHIFTS.NIGHT, SHIFTS.DAY]       // 大夜接白班
    ];
    
    return forbiddenConnections.some(connection => 
        connection[0] === shift1 && connection[1] === shift2
    );
}
// 檢查預休日排班違規
function checkPreVacationViolations(schedule) {
    let violations = 0;
    for (let day in schedule) {
        for (let shift in schedule[day]) {
            schedule[day][shift].forEach(staffName => {
                const staff = staffList.find(s => s.name === staffName);
                if (isPreVacationDay(staff, parseInt(day))) {
                    violations++;
                }
            });
        }
    }
    return violations;
}
// 新增：檢查整個排班表中的禁止班次連接
function checkForbiddenShiftConnections(schedule) {
    let violations = 0;
    
    staffList.forEach(staff => {
        for (let day = 1; day < Object.keys(schedule).length; day++) {
            const todayShift = getStaffShiftForDay(staff, day, schedule);
            const tomorrowShift = getStaffShiftForDay(staff, day + 1, schedule);
            
            if (isForbiddenShiftConnection(todayShift, tomorrowShift)) {
                violations++;
            }
        }
    });
    
    return violations;
}
// 檢查是否為預休日
function isPreVacationDay(staff, day) {
    return staff.preVacationDates.includes(day);
}
// 在生成排班表後進行最終檢查
function finalScheduleCheck(schedule) {
    let violations = [];
    
    // 檢查預休日違規
    staffList.forEach(staff => {
        staff.preVacationDates.forEach(day => {
            if (isStaffWorkingOnDay(staff, day, schedule)) {
                violations.push(`${staff.name} 在預休日 ${day} 被排班`);
            }
        });
    });
    
    // 檢查禁止的班次連接
    for (let day = 1; day < Object.keys(schedule).length; day++) {
        Object.values(SHIFTS).forEach(shift => {
            schedule[day][shift].forEach(staffName => {
                const staff = staffList.find(s => s.name === staffName);
                const nextDayShift = getStaffShiftForDay(staff, day + 1, schedule);
                if (isForbiddenShiftConnection(shift, nextDayShift)) {
                    violations.push(`${staff.name} 在第 ${day} 天的 ${SHIFT_DISPLAY[shift]} 後接 ${SHIFT_DISPLAY[nextDayShift]}`);
                }
            });
        });
    }
    
    // 檢查連續工作天數
    staffList.forEach(staff => {
        let consecutiveDays = calculateLastMonthConsecutiveWorkDays(staff);
        let startDay = 1;
        for (let day = 1; day <= Object.keys(schedule).length; day++) {
            if (isStaffWorkingOnDay(staff, day, schedule)) {
                consecutiveDays++;
                if (consecutiveDays > 6) {
                    violations.push(`${staff.name} 從第 ${startDay} 天開始連續工作超過6天`);
                    break;
                }
            } else {
                consecutiveDays = 0;
                startDay = day + 1;
            }
        }
    });
    
    return violations;
}
// 檢查班次覆蓋情況
function checkShiftCoverage(schedule) {
    let violations = 0;
    for (let day in schedule) {
        for (let shift in SHIFTS) {
            const requiredStaff = getRequiredStaffForShift(shift);
            if (schedule[day][shift].length !== requiredStaff) {
                violations += Math.abs(schedule[day][shift].length - requiredStaff);
            }
        }
    }
    return violations;
}

// 檢查連續工作天數的函數
function checkConsecutiveWorkDays(schedule, year, month) {
    let violations = 0;

    staffList.forEach(staff => {
        let consecutiveDays = calculateLastMonthConsecutiveWorkDays(staff);
        
        for (let day = 1; day <= Object.keys(schedule).length; day++) {
            if (isStaffWorkingOnDay(staff, day, schedule)) {
                consecutiveDays++;
                if (consecutiveDays > 6) {
                    violations++;
                }
            } else {
                consecutiveDays = 0;
            }
        }
    });
    return violations;
}
function wouldCauseConsecutiveViolation(staff, day, schedule, year, month) {
    let consecutiveDays = calculateLastMonthConsecutiveWorkDays(staff);

    // 檢查當前月份直到指定的日期
    for (let i = 1; i < day; i++) {
        if (isStaffWorkingOnDay(staff, i, schedule)) {
            consecutiveDays++;
        } else {
            consecutiveDays = 0;
        }
    }

    // 檢查指定的日期和之後的5天
    for (let i = 0; i <= 5; i++) {
        const checkDay = day + i;
        if (checkDay > Object.keys(schedule).length) {
            break;
        }
        if (i === 0 || isStaffWorkingOnDay(staff, checkDay, schedule)) {
            consecutiveDays++;
            if (consecutiveDays > 5) {
                return true;
            }
        } else {
            break;
        }
    }

    return false;
}
// 檢查偏好班次
function checkPreferredShiftsStrict(schedule) {
    let violations = 0;
    staffList.forEach(staff => {
        for (let day in schedule) {
            for (let shift in schedule[day]) {
                if (schedule[day][shift].includes(staff.name) && 
                    shift !== staff.shift1 && 
                    shift !== staff.shift2) {
                    violations++;
                }
            }
        }
    });
    return violations;
}

// 檢查孤立工作日
function checkIsolatedWorkDays(schedule) {
    let violations = 0;
    staffList.forEach(staff => {
        for (let day = 2; day < Object.keys(schedule).length; day++) {
            if (isStaffWorkingOnDay(staff, day, schedule) &&
                !isStaffWorkingOnDay(staff, day - 1, schedule) &&
                !isStaffWorkingOnDay(staff, day + 1, schedule)) {
                violations++;
            }
        }
    });
    return violations;
}

// 檢查班次間的休息時間
function checkRestBetweenShifts(schedule) {
    let violations = 0;
    staffList.forEach(staff => {
        for (let day = 2; day <= Object.keys(schedule).length; day++) {
            const yesterdayShift = getStaffShiftForDay(staff, day - 1, schedule);
            const todayShift = getStaffShiftForDay(staff, day, schedule);
            if ((yesterdayShift === SHIFTS.NIGHT && todayShift === SHIFTS.DAY) ||
                (yesterdayShift === SHIFTS.EVENING && todayShift === SHIFTS.DAY) ||
                (yesterdayShift === SHIFTS.EVENING && todayShift === SHIFTS.NIGHT) ||
                (yesterdayShift === SHIFTS.NIGHT && todayShift === SHIFTS.EVENING)) {
                violations++;
            }
        }
    });
    return violations;
}

// 檢查實際排班數與預期排班數的差異
function checkActualVsExpectedShifts(schedule) {
    let violations = 0;
    staffList.forEach(staff => {
        const actualShifts = Object.values(schedule).reduce((count, daySchedule) => {
            return count + Object.values(daySchedule).filter(staffList => staffList.includes(staff.name)).length;
        }, 0);
        if (actualShifts !== staff.personalExpectedDays) {
            violations += Math.abs(actualShifts - staff.personalExpectedDays);
        }
    });
    return violations;
}

// 檢查月底預休集中的優先度
function checkMonthEndVacationPriority(schedule, year, month) {
    let violations = 0;
    const daysInMonth = new Date(year, month, 0).getDate();
    const lastWeek = daysInMonth - 6;

    staffList.forEach(staff => {
        const lastWeekVacations = staff.preVacationDates.filter(date => date >= lastWeek).length;
        const lastWeekShifts = Object.keys(schedule).filter(day => day >= lastWeek && isStaffWorkingOnDay(staff, day, schedule)).length;
        if (lastWeekVacations > 0 && lastWeekShifts > 0) {
            violations += lastWeekShifts;
        }
    });
    return violations;
}

// 計算接受新解的概率
function acceptanceProbability(currentEnergy, newEnergy, temperature) {
    if (newEnergy < currentEnergy) {
        return 1;
    }
    return Math.exp((currentEnergy - newEnergy) / temperature);
}

// 獲取員工在特定日期的班次
function getStaffShiftForDay(staff, day, schedule) {
    for (let shift in schedule[day]) {
        if (schedule[day][shift].includes(staff.name)) {
            return shift;
        }
    }
    return null;
}

// 檢查員工是否在特定日期工作
function isStaffWorkingOnDay(staff, day, schedule) {
    return Object.values(SHIFTS).some(shift => schedule[day][shift].includes(staff.name));
}

// 獲取特定班次所需的員工數量
function getRequiredStaffForShift(shift) {
    switch (shift) {
        case SHIFTS.DAY:
            return dayShiftCount || 0;
        case SHIFTS.EVENING:
            return eveningShiftCount || 0;
        case SHIFTS.NIGHT:
            return nightShiftCount || 0;
        default:
            return 0;
    }
}

// 檢查是否為預排班
function isPrescheduled(staff, day, shift, year, month) {
    return staff.prescheduledDates.some(preSchedule => 
        preSchedule.date === day && preSchedule.shift === shift
    );
}
// 檢查是否為預班日
function isPrescheduledDay(staff, day) {
    return staff.prescheduledDates.some(prescheduled => prescheduled.date === day);
}
// 檢查是否為預班的特定班次
function isPrescheduledShift(staff, day, shift) {
    return staff.prescheduledDates.some(prescheduled => 
        prescheduled.date === day && prescheduled.shift === shift
    );
}
// 檢查是否為預休日
function isPreVacation(staff, day, year, month) {
    return staff.preVacationDates.includes(parseInt(day));
}

// 顯示排班表
function displaySchedule(schedule, year, month) {
    const scheduleTable = document.getElementById('scheduleTable');
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    
    let tableHTML = `
        <table class="schedule-table">
            <thead>
                <tr>
                    <th>日期</th>
                    <th>星期</th>
                    <th>白班</th>
                    <th>小夜</th>
                    <th>大夜</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (let day = 1; day <= Object.keys(schedule).length; day++) {
        const date = new Date(year, month - 1, day);
        const weekday = weekdays[date.getDay()];
        
        tableHTML += `
            <tr>
                <td>${month}/${day}</td>
                <td>${weekday}</td>
                <td>${schedule[day][SHIFTS.DAY].join(', ')}</td>
                <td>${schedule[day][SHIFTS.EVENING].join(', ')}</td>
                <td>${schedule[day][SHIFTS.NIGHT].join(', ')}</td>
            </tr>
        `;
    }

    tableHTML += `
            </tbody>
        </table>
    `;

    scheduleTable.innerHTML = tableHTML;
    console.log("Schedule to display:", schedule);
}


// 顯示統計資訊
function displayStatistics(schedule) {
    const statisticsTable = document.getElementById('statisticsTable');
    
    let tableHTML = `
        <table class="statistics-table">
            <thead>
                <tr>
                    <th>員工名稱</th>
                    <th>個人預期班數</th>
                    <th>實際班數</th>
                    <th>白班天數</th>
                    <th>小夜天數</th>
                    <th>大夜天數</th>
                </tr>
            </thead>
            <tbody>
    `;

    staffList.forEach(staff => {
        const expectedDays = staff.expectedShiftDays || 0;
        let actualDays = 0;
        let dayShiftDays = 0;
        let eveningShiftDays = 0;
        let nightShiftDays = 0;

        for (let day = 1; day <= Object.keys(schedule).length; day++) {
            if (schedule[day][SHIFTS.DAY].includes(staff.name)) {
                dayShiftDays++;
                actualDays++;
            }
            if (schedule[day][SHIFTS.EVENING].includes(staff.name)) {
                eveningShiftDays++;
                actualDays++;
            }
            if (schedule[day][SHIFTS.NIGHT].includes(staff.name)) {
                nightShiftDays++;
                actualDays++;
            }
        }

        staff.actualShiftDays = actualDays;

        tableHTML += `
            <tr>
                <td>${staff.name}</td>
                <td>${staff.personalExpectedDays}</td>
                <td>${actualDays}</td>
                <td>${dayShiftDays}</td>
                <td>${eveningShiftDays}</td>
                <td>${nightShiftDays}</td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    statisticsTable.innerHTML = tableHTML;
}

// 顯示排班矩陣
function displayScheduleMatrix(schedule, year, month) {
    const scheduleMatrixDiv = document.getElementById('scheduleMatrix');
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    
    let tableHTML = `
        <table class="schedule-matrix">
            <thead>
                <tr>
                    <th>人員 \ 日期</th>
    `;
    
    for (let day = 1; day <= Object.keys(schedule).length; day++) {
        const date = new Date(year, month - 1, day);
        const weekday = weekdays[date.getDay()];
        tableHTML += `<th>${month}/${day}<br>(${weekday})</th>`;
    }
    
    tableHTML += `
                </tr>
            </thead>
            <tbody>
    `;
    
    staffList.forEach(staff => {
        tableHTML += `
            <tr>
                <td>${staff.name}</td>
        `;
        
        for (let day = 1; day <= Object.keys(schedule).length; day++) {
            let shiftForDay = '';
            if (schedule[day][SHIFTS.DAY].includes(staff.name)) {
                shiftForDay = '白';
            } else if (schedule[day][SHIFTS.EVENING].includes(staff.name)) {
                shiftForDay = '小';
            } else if (schedule[day][SHIFTS.NIGHT].includes(staff.name)) {
                shiftForDay = '大';
            }
            tableHTML += `<td>${shiftForDay}</td>`;
        }
        
        tableHTML += `
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    scheduleMatrixDiv.innerHTML = tableHTML;
}
function updateShiftCounts() {
    dayShiftCount = parseInt(document.getElementById('dayShiftCount').value) || 0;
    eveningShiftCount = parseInt(document.getElementById('eveningShiftCount').value) || 0;
    nightShiftCount = parseInt(document.getElementById('nightShiftCount').value) || 0;
    console.log("Updated shift counts:", dayShiftCount, eveningShiftCount, nightShiftCount);
}
// 當DOM加載完成時初始化
document.getElementById('generateScheduleBtn').addEventListener('click', function() {
    updateShiftCounts();
    generateSchedule();
});