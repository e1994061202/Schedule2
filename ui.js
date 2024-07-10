// ui.js


function addStaff() {
    const name = prompt("請輸入人員姓名：");
    if (name) {
        const staff = {
            name: name,
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

function updateStaffList() {
    const staffListDiv = document.getElementById("staffList");
    staffListDiv.innerHTML = "";
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
            <span class="prescheduled-dates" id="prescheduled-${index}"></span>
            <span class="previous-month-schedules" id="previous-month-schedules-${index}"></span>
            <div id="preschedule-calendar-container-${index}" style="display: none;">
                <div id="preschedule-calendar-${index}"></div>
                <button onclick="confirmPreschedule(${index})">確認預班</button>
            </div>
            <div id="previous-month-calendar-container-${index}" style="display: none;">
                <div id="previous-month-calendar-${index}"></div>
                <button onclick="confirmPreviousMonthSchedules(${index})">確認上月班表</button>
            </div>
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
    const year = document.getElementById("year").value;
    const month = document.getElementById("month").value;
    const calendarContainer = document.getElementById(`preschedule-calendar-container-${index}`);
    calendarContainer.style.display = 'block';

    if (currentFlatpickr) {
        currentFlatpickr.destroy();
    }

    currentFlatpickr = flatpickr(`#preschedule-calendar-${index}`, {
        mode: "multiple",
        dateFormat: "Y-m-d",
        minDate: `${year}-${month.padStart(2, '0')}-01`,
        maxDate: new Date(year, month, 0),
        defaultDate: staffList[index].prescheduledDates.map(day => `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`),
        inline: true,
        onChange: function(selectedDates, dateStr, instance) {
            staffList[index].tempPrescheduledDates = selectedDates.map(date => date.getDate());
        }
    });
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

function updatePrescheduledDatesDisplay(index) {
    const prescheduledDatesElement = document.getElementById(`prescheduled-${index}`);
    if (prescheduledDatesElement) {
        const sortedDates = [...staffList[index].prescheduledDates].sort((a, b) => a - b);
        prescheduledDatesElement.textContent = `不排班日期: ${sortedDates.join(', ')}`;
    }
}

function showPreviousMonthCalendar(index) {
    const year = document.getElementById("year").value;
    const month = document.getElementById("month").value;
    const previousMonth = month - 1 < 1 ? 12 : month - 1;
    const previousYear = month - 1 < 1 ? year - 1 : year;

    const calendarContainer = document.getElementById(`previous-month-calendar-container-${index}`);
    calendarContainer.style.display = 'block';

    if (currentFlatpickr) {
        currentFlatpickr.destroy();
    }

    currentFlatpickr = flatpickr(`#previous-month-calendar-${index}`, {
        mode: "multiple",
        dateFormat: "Y-m-d",
        minDate: `${previousYear}-${previousMonth.toString().padStart(2, '0')}-01`,
        maxDate: new Date(previousYear, previousMonth, 0),
        defaultDate: staffList[index].previousMonthSchedules.map(day => `${previousYear}-${previousMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`),
        inline: true,
        onChange: function(selectedDates, dateStr, instance) {
            staffList[index].tempPreviousMonthSchedules = selectedDates.map(date => date.getDate());
        }
    });

    const existingShiftSelectionContainer = document.getElementById(`shift-selection-container-${index}`);
    if (existingShiftSelectionContainer) {
        existingShiftSelectionContainer.remove();
    }

    const shiftSelectionContainer = document.createElement('div');
    shiftSelectionContainer.id = `shift-selection-container-${index}`;
    shiftSelectionContainer.innerHTML = `
        <label for="last-day-shift-${index}">上月最後一天班次:</label>
        <select id="last-day-shift-${index}">
            <option value="">請選擇</option>
            <option value="dayShift">白班</option>
            <option value="eveningShift">小夜</option>
            <option value="nightShift">大夜</option>
        </select>
    `;
    calendarContainer.appendChild(shiftSelectionContainer);

    const lastDayShiftSelect = document.getElementById(`last-day-shift-${index}`);
    lastDayShiftSelect.value = staffList[index].lastMonthLastDayShift || '';
}

function confirmPreviousMonthSchedules(index) {
    if (staffList[index].tempPreviousMonthSchedules) {
        staffList[index].previousMonthSchedules = [...staffList[index].tempPreviousMonthSchedules].sort((a, b) => a - b);
        delete staffList[index].tempPreviousMonthSchedules;
    }

    const lastDayShift = document.getElementById(`last-day-shift-${index}`).value;
    if (lastDayShift) {
        staffList[index].lastMonthLastDayShift = lastDayShift;
    }

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
        const lastMonthLastDayShift = staffList[index].lastMonthLastDayShift ? ` (${staffList[index].lastMonthLastDayShift})` : '';
        previousMonthSchedulesElement.textContent = `上月上班日期: ${staffList[index].previousMonthSchedules.join(', ')}${lastMonthLastDayShift}`;
    }
}

function deleteStaff(index) {
    if (confirm(`確定要刪除 ${staffList[index].name} 嗎？`)) {
        staffList.splice(index, 1);
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



// 初始化事件監聽器
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('addStaffBtn').addEventListener('click', addStaff);
    document.getElementById('saveStaffDataBtn').addEventListener('click', saveStaffData);
    document.getElementById('loadStaffDataBtn').addEventListener('click', loadStaffData);
    document.getElementById('deleteAllStaffBtn').addEventListener('click', deleteAllStaff);
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('generateScheduleBtn').addEventListener('click', generateSchedule);

    document.getElementById('year').addEventListener('change', clearAllPreschedules);
    document.getElementById('month').addEventListener('change', clearAllPreschedules);

    document.getElementById('dayShiftCount').addEventListener('change', saveToLocalStorage);
    document.getElementById('eveningShiftCount').addEventListener('change', saveToLocalStorage);
    document.getElementById('nightShiftCount').addEventListener('change', saveToLocalStorage);

    loadFromLocalStorage();
});