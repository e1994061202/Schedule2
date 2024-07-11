
function addStaff() {
    const name = prompt("請輸入人員姓名：");
    if (name) {
        const staff = {
            name: name,
            order: staffList.length,
            prescheduledDates: [],
            previousMonthSchedules: [],
            shift1: '',
            shift2: '',
            consecutiveWorkDays: 0,
            currentConsecutiveWorkDays: 0
        };
        staffList.push(staff);
        updateStaffList();
        saveToLocalStorage();
    }
}
function getLastSevenDaysOfMonth(year, month) {
    const lastDay = new Date(year, month, 0);
    const lastSevenDays = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(lastDay);
        date.setDate(lastDay.getDate() - i);
        lastSevenDays.push(formatDate(date));
    }
    return lastSevenDays;
}
function updateScheduleFromLastMonth() {
    const year = parseInt(document.getElementById("year").value);
    const month = parseInt(document.getElementById("month").value);
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousMonthYear = month === 1 ? year - 1 : year;

    // 从 localStorage 中读取上个月的排班信息
    const previousMonthSchedule = JSON.parse(localStorage.getItem(`schedule-${previousMonthYear}-${previousMonth}`));

    if (previousMonthSchedule) {
        const lastSevenDays = getLastSevenDaysOfMonth(previousMonthYear, previousMonth);

        staffList.forEach(staff => {
            staff.previousMonthSchedules = [];
            staff.lastMonthLastDayShift = null;
            lastSevenDays.forEach(day => {
                if (previousMonthSchedule[day]) {
                    if (previousMonthSchedule[day].dayShift.includes(staff.name)) {
                        staff.previousMonthSchedules.push(parseInt(day.split('-')[2]));
                        if (day === lastSevenDays[lastSevenDays.length - 1]) {
                            staff.lastMonthLastDayShift = 'dayShift'; 
                        }
                    } else if (previousMonthSchedule[day].eveningShift.includes(staff.name)) {
                        staff.previousMonthSchedules.push(parseInt(day.split('-')[2]));
                        if (day === lastSevenDays[lastSevenDays.length - 1]) {
                            staff.lastMonthLastDayShift = 'eveningShift';
                        }
                    } else if (previousMonthSchedule[day].nightShift.includes(staff.name)) {
                        staff.previousMonthSchedules.push(parseInt(day.split('-')[2]));
                        if (day === lastSevenDays[lastSevenDays.length - 1]) {
                            staff.lastMonthLastDayShift = 'nightShift';
                        }
                    }
                }
            });

            updatePreviousMonthSchedulesDisplay(staffList.indexOf(staff));
        });
    } else {
        staffList.forEach((staff, index) => {
            staff.previousMonthSchedules = [];
            staff.lastMonthLastDayShift = null;
            updatePreviousMonthSchedulesDisplay(index);
        });
    }

    // 清空所有员工的不排班日期
    clearAllPreschedules();
}
function updateStaffList() {
    const staffListDiv = document.getElementById("staffList");
    staffListDiv.innerHTML = "";
    
    staffList.sort((a, b) => a.order - b.order);
    
    staffList.forEach((staff, index) => {
        const staffDiv = document.createElement("div");
        staffDiv.innerHTML = `
            ${staff.name}
            <select class="shift-select" onchange="updateStaffShift(${index}, 1, this.value)">
                <option value="">選擇班次1</option>
                <option value="dayShift" ${staff.shift1 === 'dayShift' ? 'selected' : ''}>白班</option>
                <option value="eveningShift" ${staff.shift1 === 'eveningShift' ? 'selected' : ''}>小夜</option>
                <option value="nightShift" ${staff.shift1 === 'nightShift' ? 'selected' : ''}>大夜</option>
            </select>
            <select class="shift-select" onchange="updateStaffShift(${index}, 2, this.value)">
                <option value="">選擇班次2</option>
                <option value="dayShift" ${staff.shift2 === 'dayShift' ? 'selected' : ''}>白班</option>
                <option value="eveningShift" ${staff.shift2 === 'eveningShift' ? 'selected' : ''}>小夜</option>
                <option value="nightShift" ${staff.shift2 === 'nightShift' ? 'selected' : ''}>大夜</option>
            </select>
            <button onclick="showPreschedulingCalendar(${index})">設定不排班日期</button>
            <button onclick="showPreviousMonthCalendar(${index})">上月班表</button>
            <button onclick="deletePreschedule(${index})">刪除預班</button>
            <button onclick="deleteStaff(${index})">刪除</button>
            <button onclick="moveStaffUp(${index})">上移</button>
            <button onclick="moveStaffDown(${index})">下移</button>
            <span class="prescheduled-dates" id="prescheduled-${index}"></span>
            <span class="previous-month-schedules" id="previous-month-schedules-${index}"></span>
        `;
        staffListDiv.appendChild(staffDiv);
        updatePrescheduledDatesDisplay(index);
        updatePreviousMonthSchedulesDisplay(index);
    });
}

function updateStaffShift(index, shiftNumber, value) {
    staffList[index][`shift${shiftNumber}`] = value;
    saveToLocalStorage();
}

function showPreschedulingCalendar(index) {
    showCalendar(index, 'preschedule');
}

function showPreviousMonthCalendar(index) {
    showCalendar(index, 'previous-month');
}

function showCalendar(index, type) {
    const year = document.getElementById("year").value;
    const month = document.getElementById("month").value;
    const isCurrentMonth = type === 'preschedule';
    
    const calendarYear = isCurrentMonth ? year : (month - 1 < 1 ? year - 1 : year);
    const calendarMonth = isCurrentMonth ? month : (month - 1 < 1 ? 12 : month - 1);

    const calendarContainerId = `${type}-calendar-container-${index}`;
    const calendarId = `${type}-calendar-${index}`;
    
    // 檢查容器是否存在，如果不存在則創建
    let calendarContainer = document.getElementById(calendarContainerId);
    if (!calendarContainer) {
        calendarContainer = document.createElement('div');
        calendarContainer.id = calendarContainerId;
        calendarContainer.style.display = 'none';
        
        const calendarDiv = document.createElement('div');
        calendarDiv.id = calendarId;
        calendarContainer.appendChild(calendarDiv);
        
        const confirmButton = document.createElement('button');
        confirmButton.textContent = isCurrentMonth ? '確認預班' : '確認上月班表';
        confirmButton.onclick = () => isCurrentMonth ? confirmPreschedule(index) : confirmPreviousMonthSchedules(index);
        calendarContainer.appendChild(confirmButton);
        
        // 將容器添加到適當的位置
        const staffItem = document.querySelector(`#staffList > div:nth-child(${index + 1})`);
        if (staffItem) {
            staffItem.appendChild(calendarContainer);
        } else {
            console.error(`無法找到索引為 ${index} 的員工列表項目`);
            return; // 如果找不到適當的位置，則退出函數
        }
    }
    
    calendarContainer.style.display = 'block';

    if (currentFlatpickr) {
        currentFlatpickr.destroy();
    }

    const dates = isCurrentMonth ? staffList[index].prescheduledDates : staffList[index].previousMonthSchedules;

    currentFlatpickr = flatpickr(`#${calendarId}`, {
        mode: "multiple",
        dateFormat: "Y-m-d",
        minDate: `${calendarYear}-${calendarMonth.toString().padStart(2, '0')}-01`,
        maxDate: new Date(calendarYear, calendarMonth, 0),
        defaultDate: dates.map(day => `${calendarYear}-${calendarMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`),
        inline: true,
        onChange: function(selectedDates, dateStr, instance) {
            if (isCurrentMonth) {
                staffList[index].tempPrescheduledDates = selectedDates.map(date => date.getDate());
            } else {
                staffList[index].tempPreviousMonthSchedules = selectedDates.map(date => date.getDate());
            }
        }
    });

    if (!isCurrentMonth) {
        // 創建或更新上月最後一天班次選擇
        let shiftSelectionContainer = document.getElementById(`shift-selection-container-${index}`);
        if (!shiftSelectionContainer) {
            shiftSelectionContainer = document.createElement('div');
            shiftSelectionContainer.id = `shift-selection-container-${index}`;
            calendarContainer.appendChild(shiftSelectionContainer);
        }

        shiftSelectionContainer.innerHTML = `
            <label for="last-day-shift-${index}">上月最後一天班次:</label>
            <select id="last-day-shift-${index}">
                <option value="">請選擇</option>
                <option value="dayShift">白班</option>
                <option value="eveningShift">小夜</option>
                <option value="nightShift">大夜</option>
            </select>
        `;

        const lastDayShiftSelect = document.getElementById(`last-day-shift-${index}`);
        lastDayShiftSelect.value = staffList[index].lastMonthLastDayShift || '';
    }
}

function confirmPreschedule(index) {
    if (staffList[index].tempPrescheduledDates) {
        staffList[index].prescheduledDates = [...staffList[index].tempPrescheduledDates].sort((a, b) => a - b);
        delete staffList[index].tempPrescheduledDates;
    }
    updatePrescheduledDatesDisplay(index);
    document.getElementById(`preschedule-calendar-container-${index}`).style.display = 'none';
    if (currentFlatpickr) {
        currentFlatpickr.destroy();
        currentFlatpickr = null;
    }
    saveToLocalStorage();
}

function confirmPreviousMonthSchedules(index) {
    if (staffList[index].tempPreviousMonthSchedules) {
        staffList[index].previousMonthSchedules = [...staffList[index].tempPreviousMonthSchedules].sort((a, b) => a - b);
        delete staffList[index].tempPreviousMonthSchedules;
    }

    const lastDayShift = document.getElementById(`last-day-shift-${index}`).value;
    staffList[index].lastMonthLastDayShift = lastDayShift;

    updatePreviousMonthSchedulesDisplay(index);
    document.getElementById(`previous-month-calendar-container-${index}`).style.display = 'none';
    if (currentFlatpickr) {
        currentFlatpickr.destroy();
        currentFlatpickr = null;
    }
    saveToLocalStorage();
}

function updatePreviousMonthSchedulesDisplay(index) {
    const previousMonthSchedulesElement = document.getElementById(`previous-month-schedules-${index}`);
    if (previousMonthSchedulesElement) {
        const staff = staffList[index];
        const lastMonthLastDayShift = staff.lastMonthLastDayShift ? ` (${staff.lastMonthLastDayShift})` : '';
        const schedules = staff.previousMonthSchedules.length > 0 ? staff.previousMonthSchedules.join(', ') : '無';
        previousMonthSchedulesElement.textContent = `上月上班日期: ${schedules}${lastMonthLastDayShift}`;
    }
}

function updatePreviousMonthSchedulesDisplay(index) {
    const previousMonthSchedulesElement = document.getElementById(`previous-month-schedules-${index}`);
    if (previousMonthSchedulesElement) {
        const lastMonthLastDayShift = staffList[index].lastMonthLastDayShift ? ` (${staffList[index].lastMonthLastDayShift})` : '';
        previousMonthSchedulesElement.textContent = `上月上班日期: ${staffList[index].previousMonthSchedules.join(', ')}${lastMonthLastDayShift}`;
    }
}

function deleteStaff(index) {
    if (confirm(`確定要刪除 ${staffList[index].name} 嗎？`)) {
        const deletedOrder = staffList[index].order;
        staffList.splice(index, 1);
        
        // 更新剩餘員工的順序
        staffList.forEach(staff => {
            if (staff.order > deletedOrder) {
                staff.order--;
            }
        });
        
        updateStaffList();
        saveToLocalStorage();
    }
}

function deletePreschedule(index) {
    if (confirm(`確定要刪除 ${staffList[index].name} 的所有預班資料嗎？`)) {
        staffList[index].prescheduledDates = [];
        staffList[index].previousMonthSchedules = [];
        updateStaffList();
        saveToLocalStorage();
        alert('預班資料已刪除');
    }
}

function moveStaffUp(index) {
    if (index > 0) {
        const temp = staffList[index].order;
        staffList[index].order = staffList[index - 1].order;
        staffList[index - 1].order = temp;
        updateStaffList();
        saveToLocalStorage();
    }
}

function moveStaffDown(index) {
    if (index < staffList.length - 1) {
        const temp = staffList[index].order;
        staffList[index].order = staffList[index + 1].order;
        staffList[index + 1].order = temp;
        updateStaffList();
        saveToLocalStorage();
    }
}
// 更新生成排班表按鈕的事件監聽器
document.getElementById('generateScheduleBtn').addEventListener('click', async function() {
    this.disabled = true;
    try {
        await generateSchedule();
    } catch (error) {
        console.error('排班表生成過程中發生錯誤:', error);
        alert('生成排班表時發生錯誤，請查看控制台以獲取更多信息。');
    } finally {
        this.disabled = false;
    }
});

function updateProgressIndicator(progress) {
    const progressBar = document.getElementById('progressIndicator');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        progressBar.textContent = `${Math.round(progress)}%`;
    }
}

function showError(message) {
    alert(message);
    console.error(message);
}

function showWarning(message) {
    alert(message);
    console.warn(message);
}

function updatePrescheduledDatesDisplay(index) {
    const prescheduledDatesElement = document.getElementById(`prescheduled-${index}`);
    if (prescheduledDatesElement) {
        const sortedDates = [...staffList[index].prescheduledDates].sort((a, b) => a - b);
        prescheduledDatesElement.textContent = `預班日期: ${sortedDates.join(', ')}`;
    }
}

function updatePreviousMonthSchedulesDisplay(index) {
    const previousMonthSchedulesElement = document.getElementById(`previous-month-schedules-${index}`);
    if (previousMonthSchedulesElement) {
        const staff = staffList[index];
        const lastMonthLastDayShift = staff.lastMonthLastDayShift ? ` (${staff.lastMonthLastDayShift})` : '';
        const schedules = staff.previousMonthSchedules.length > 0 ? staff.previousMonthSchedules.join(', ') : '無';
        previousMonthSchedulesElement.textContent = `上月上班日期: ${schedules}${lastMonthLastDayShift}`;
    }
}

// 添加事件監聽器
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('addStaffBtn').addEventListener('click', addStaff);
    document.getElementById('saveStaffDataBtn').addEventListener('click', saveStaffData);
    document.getElementById('loadStaffDataBtn').addEventListener('click', loadStaffData);
    document.getElementById('deleteAllStaffBtn').addEventListener('click', deleteAllStaff);
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('generateScheduleBtn').addEventListener('click', generateSchedule);

    document.getElementById('year').addEventListener('change', updateScheduleFromLastMonth);
    document.getElementById('month').addEventListener('change', updateScheduleFromLastMonth);

    document.getElementById('dayShiftCount').addEventListener('change', saveToLocalStorage);
    document.getElementById('eveningShiftCount').addEventListener('change', saveToLocalStorage);
    document.getElementById('nightShiftCount').addEventListener('change', saveToLocalStorage);

    loadFromLocalStorage();
});