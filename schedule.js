let staffList = [];
let currentFlatpickr = null;

function addStaff() {
    const name = prompt("請輸入人員姓名：");
    if (name) {
        const staff = {
            name: name,
            prescheduledDates: [],
            previousMonthSchedules: [],
            shift1: '',
            shift2: ''
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
            <button onclick="showPreschedulingCalendar(${index})">預班</button>
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
        const lastMonthLastDayShift = staffList[index].lastMonthLastDayShift ? ` (${staffList[index].lastMonthLastDayShift})` : '';
        previousMonthSchedulesElement.textContent = `上月上班日期: ${staffList[index].previousMonthSchedules.join(', ')}${lastMonthLastDayShift}`;
    }
}

function updateStaffShift(index, shiftNumber, value) {
    staffList[index][`shift${shiftNumber}`] = value;
    saveToLocalStorage();
}

function deleteStaff(index) {
    if (confirm(`確定要刪除 ${staffList[index].name} 嗎？`)) {
        staffList.splice(index, 1);
        updateStaffList();
        saveToLocalStorage();
    }
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

    // 移除已有的班次選擇欄(如果存在)
    const existingShiftSelectionContainer = document.getElementById(`shift-selection-container-${index}`);
    if (existingShiftSelectionContainer) {
        existingShiftSelectionContainer.remove();
    }

    // 添加新的班次選擇欄
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

    // 設置上月最後一天班次的默認值
    const lastDayShiftSelect = document.getElementById(`last-day-shift-${index}`);
    lastDayShiftSelect.value = staffList[index].lastMonthLastDayShift || '';
}
function confirmPreviousMonthSchedules(index) {
    if (staffList[index].tempPreviousMonthSchedules) {
        staffList[index].previousMonthSchedules = [...staffList[index].tempPreviousMonthSchedules].sort((a, b) => a - b);
        delete staffList[index].tempPreviousMonthSchedules;
    }

    // 獲取用戶選擇的上月最後一天班次
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
function saveToLocalStorage() {
    localStorage.setItem('staffList', JSON.stringify(staffList));
    localStorage.setItem('shiftCounts', JSON.stringify({
        dayShift: document.getElementById('dayShiftCount').value,
        eveningShift: document.getElementById('eveningShiftCount').value,
        nightShift: document.getElementById('nightShiftCount').value
    }));
}

function loadFromLocalStorage() {
    const savedStaffList = localStorage.getItem('staffList');
    if (savedStaffList) {
        staffList = JSON.parse(savedStaffList);
        updateStaffList();
    }
    const savedShiftCounts = localStorage.getItem('shiftCounts');
    if (savedShiftCounts) {
        const shiftCounts = JSON.parse(savedShiftCounts);
        document.getElementById('dayShiftCount').value = shiftCounts.dayShift;
        document.getElementById('eveningShiftCount').value = shiftCounts.eveningShift;
        document.getElementById('nightShiftCount').value = shiftCounts.nightShift;
    }
}

function saveStaffData() {
    const dataToSave = {
        staffList: staffList,
        shiftCounts: {
            dayShift: document.getElementById('dayShiftCount').value,
            eveningShift: document.getElementById('eveningShiftCount').value,
            nightShift: document.getElementById('nightShiftCount').value
        }
    };
    const dataStr = JSON.stringify(dataToSave);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'staff_data.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function loadStaffData() {
    document.getElementById('fileInput').click();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                staffList = data.staffList;
                updateStaffList();
                if (data.shiftCounts) {
                    document.getElementById('dayShiftCount').value = data.shiftCounts.dayShift;
                    document.getElementById('eveningShiftCount').value = data.shiftCounts.eveningShift;
                    document.getElementById('nightShiftCount').value = data.shiftCounts.nightShift;
                }
                saveToLocalStorage();
                alert('人員資料和班次人數設定已成功載入');
            } catch (error) {
                alert('載入失敗，請確保文件格式正確');
            }
        };
        reader.readAsText(file);
    }
}

function deleteAllStaff() {
    if (confirm('確定要刪除所有人員資料嗎？此操作無法撤銷。')) {
        staffList = [];
        updateStaffList();
        saveToLocalStorage();
        alert('所有人員資料已刪除');
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

function clearAllPreschedules() {
    staffList.forEach(staff => {
        staff.prescheduledDates = [];
        staff.previousMonthSchedules = [];
    });
    updateStaffList();
    saveToLocalStorage();
}

// 添加事件監聽器
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('addStaffBtn').addEventListener('click', addStaff);
    document.getElementById('saveStaffDataBtn').addEventListener('click', saveStaffData);
    document.getElementById('loadStaffDataBtn').addEventListener('click', loadStaffData);
    document.getElementById('deleteAllStaffBtn').addEventListener('click', deleteAllStaff);
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);

    document.getElementById('year').addEventListener('change', clearAllPreschedules);
    document.getElementById('month').addEventListener('change', clearAllPreschedules);

    document.getElementById('dayShiftCount').addEventListener('change', saveToLocalStorage);
    document.getElementById('eveningShiftCount').addEventListener('change', saveToLocalStorage);
    document.getElementById('nightShiftCount').addEventListener('change', saveToLocalStorage);

    // 頁面加載時從 localStorage 讀取數據
    loadFromLocalStorage();
});