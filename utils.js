// utils.js

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

function clearAllPreschedules() {
    if (confirm('確定要清除所有人員的不排班日期嗎？此操作無法撤銷。')) {
        staffList.forEach(staff => {
            staff.prescheduledDates = [];
            staff.previousMonthSchedules = [];
        });
        updateStaffList();
        saveToLocalStorage();
        alert('所有不排班日期已清除');
    }
}

function isPrescheduled(staff, day) {
    return Array.isArray(staff.prescheduledDates) && staff.prescheduledDates.includes(day);
}

const SHIFT_TIMES = {
    nightShift: { start: 0, end: 8 },
    dayShift: { start: 8, end: 16 },
    eveningShift: { start: 16, end: 24 }
};

// 安全的數組包含檢查函數
function safeArrayIncludes(arr, item) {
    return Array.isArray(arr) && arr.includes(item);
}

// 安全的屬性訪問函數
function safeGet(obj, path, defaultValue = undefined) {
    const travel = regexp =>
        String.prototype.split
            .call(path, regexp)
            .filter(Boolean)
            .reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj);
    const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
    return result === undefined || result === obj ? defaultValue : result;
}

// 更新shift order的函數
function updateShiftOrder(schedule, day1, day2) {
    const shiftOrder = {
        dayShift: [],
        eveningShift: [],
        nightShift: []
    };

    ['dayShift', 'eveningShift', 'nightShift'].forEach(shift => {
        const members = new Set([
            ...(schedule[day1] ? schedule[day1][shift] : []),
            ...(day2 && schedule[day2] ? schedule[day2][shift] : [])
        ]);
        shiftOrder[shift] = Array.from(members);
    });

    return shiftOrder;
}

// 格式化日期為 YYYY-MM-DD 格式
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 解析 YYYY-MM-DD 格式的日期字符串
function parseDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}