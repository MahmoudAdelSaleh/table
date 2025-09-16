// ===================================================
// 0. تهيئة التطبيق
// ===================================================
const canvas = document.getElementById('timetableCanvas');
const ctx = canvas.getContext('2d');

let settings = {};
let displaySettings = {};
let teachers = [];
let classes = [];
let subjects = [];
let assignments = [];
let schedule = [];
let selectedAssignment = null;
let onConfirmCallback = null;
let heldSession = null; // For manual drag-drop from grid

// ===================================================
// 1. إدارة البيانات و LocalStorage
// ===================================================
function saveData() {
    localStorage.setItem('timetable_settings', JSON.stringify(settings));
    localStorage.setItem('timetable_displaySettings', JSON.stringify(displaySettings));
    localStorage.setItem('timetable_teachers', JSON.stringify(teachers));
    localStorage.setItem('timetable_classes', JSON.stringify(classes));
    localStorage.setItem('timetable_subjects', JSON.stringify(subjects));
    localStorage.setItem('timetable_assignments', JSON.stringify(assignments));
    localStorage.setItem('timetable_schedule', JSON.stringify(schedule));
    updateScheduleSummary();
}

function loadData() {
    settings = JSON.parse(localStorage.getItem('timetable_settings')) || {
        days: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"],
        periods: 7,
        schoolName: "اسم المدرسة",
        designerName: "اسم المصمم"
    };
     displaySettings = JSON.parse(localStorage.getItem('timetable_displaySettings')) || {
        cellWidth: 80,
        cellHeight: 60,
        mainFontSize: 13,
        lineWidth: 1
    };
    teachers = JSON.parse(localStorage.getItem('timetable_teachers')) || [];
    classes = JSON.parse(localStorage.getItem('timetable_classes')) || [];
    subjects = JSON.parse(localStorage.getItem('timetable_subjects')) || [];
    assignments = JSON.parse(localStorage.getItem('timetable_assignments')) || [];
    schedule = JSON.parse(localStorage.getItem('timetable_schedule')) || [];
    
    // Cleanup orphaned schedule entries if their assignment was deleted
    schedule = schedule.filter(s => assignments.some(a => a.id === s.assignmentId));
    saveData();
}

// ===================================================
// 2. إعداد ورسم الواجهة الرئيسية (Canvas) - تصميم جديد
// ===================================================
let SIDEBAR_WIDTH, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT, CELL_WIDTH, CELL_HEIGHT;

function updateCanvasDimensions() {
    SIDEBAR_WIDTH = 250;
    ROW_HEADER_WIDTH = 100;
    COL_HEADER_HEIGHT = 60;
    
    CELL_HEIGHT = displaySettings.cellHeight;
    CELL_WIDTH = displaySettings.cellWidth;

    const totalPeriods = (settings.days.length || 0) * (settings.periods || 0);
    canvas.width = SIDEBAR_WIDTH + ROW_HEADER_WIDTH + (totalPeriods * CELL_WIDTH);
    canvas.height = COL_HEADER_HEIGHT + ((classes.length || 0) * CELL_HEIGHT);
    
    draw();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(!settings.days || settings.days.length === 0 || !classes || classes.length === 0) {
         ctx.font = 'bold 24px "Segoe UI"';
         ctx.textAlign = 'center';
         ctx.fillStyle = '#6c757d';
         ctx.fillText('الرجاء إضافة الفصول وتحديد إعدادات الجدول أولاً', canvas.width/2, canvas.height/2);
         return;
    }
    // RTL starts from the right edge
    drawSidebar(canvas.width - SIDEBAR_WIDTH);
    drawGridAndHeaders(canvas.width - SIDEBAR_WIDTH);
    drawSchedule(canvas.width - SIDEBAR_WIDTH);
}

function getAssignmentInfo(assignmentId) {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return {};
    
    const teacherNames = (assignment.teacherIds || []).map(tid => teachers.find(t => t.id === tid)?.name || '').join(' و ');
    const classNames = (assignment.classIds || []).map(cid => classes.find(c => c.id === cid)?.name || '').join(' و ');
    
    const subject = subjects.find(s => s.id === assignment.subjectId);
    return { assignment, teacherNames, classNames, subject };
}

function drawSidebar(startX) {
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(startX, 0, SIDEBAR_WIDTH, canvas.height);
    ctx.strokeStyle = '#dee2e6';
    ctx.strokeRect(startX, 0, SIDEBAR_WIDTH, canvas.height);

    ctx.fillStyle = '#212529';
    ctx.font = 'bold 20px "Segoe UI"';
    ctx.textAlign = 'center';
    ctx.fillText('الحصص المتبقية', startX + SIDEBAR_WIDTH / 2, 35);
    
    let yPos = 75;
    assignments.forEach((assignment) => {
        const { classNames, subject } = getAssignmentInfo(assignment.id);
         if (!classNames || !subject) return;

        const scheduledCount = schedule.filter(s => s.assignmentId === assignment.id).length;
        const remaining = assignment.weeklyCount - scheduledCount;
        if (remaining <= 0) return;

        const text = `${subject.name} - ${classNames}`;
        const remainingText = `(متبقي: ${remaining})`;
        
        if ((selectedAssignment && selectedAssignment.id === assignment.id) || (heldSession && heldSession.assignmentId === assignment.id)) {
            ctx.fillStyle = subject.color;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(startX + 10, yPos - 25, SIDEBAR_WIDTH - 20, 50);
            ctx.globalAlpha = 1.0;
        }
        
        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px "Segoe UI"';
         drawFittingText(text, startX + SIDEBAR_WIDTH / 2, yPos, SIDEBAR_WIDTH - 20, 14, 10);
        ctx.font = '12px "Segoe UI"';
        ctx.fillStyle = '#6c757d';
        ctx.fillText(remainingText, startX + SIDEBAR_WIDTH / 2, yPos + 20);
        yPos += 55;
    });
}

function drawGridAndHeaders(gridStartX) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e9ecef';
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = displaySettings.lineWidth;
    
    const headerX = gridStartX - ROW_HEADER_WIDTH;
    // Draw Corner Box
    ctx.fillRect(headerX, 0, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT);
    ctx.strokeRect(headerX, 0, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT);

    // Draw Row Headers (Classes)
    classes.forEach((aClass, i) => {
        const y = COL_HEADER_HEIGHT + i * CELL_HEIGHT;
        ctx.fillStyle = '#e9ecef';
        ctx.fillRect(headerX, y, ROW_HEADER_WIDTH, CELL_HEIGHT);
        ctx.strokeRect(headerX, y, ROW_HEADER_WIDTH, CELL_HEIGHT);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 15px "Segoe UI"';
        ctx.fillText(aClass.name, headerX + ROW_HEADER_WIDTH / 2, y + CELL_HEIGHT / 2);
    });

    // Draw Column Headers (Days and Periods) - RTL
    settings.days.forEach((day, dayIndex) => {
        const dayX = headerX - ((dayIndex + 1) * settings.periods * CELL_WIDTH);
        const dayWidth = settings.periods * CELL_WIDTH;
        // Day Header
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(dayX, 0, dayWidth, COL_HEADER_HEIGHT / 2);
        ctx.strokeRect(dayX, 0, dayWidth, COL_HEADER_HEIGHT / 2);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 15px "Segoe UI"';
        ctx.fillText(day, dayX + dayWidth / 2, COL_HEADER_HEIGHT / 4);

        // Period Headers for that day
        for (let periodIndex = 0; periodIndex < settings.periods; periodIndex++) {
            const periodX = dayX + (settings.periods - 1 - periodIndex) * CELL_WIDTH;
            ctx.fillStyle = '#f1f1f1';
            ctx.fillRect(periodX, COL_HEADER_HEIGHT / 2, CELL_WIDTH, COL_HEADER_HEIGHT / 2);
            ctx.strokeRect(periodX, COL_HEADER_HEIGHT / 2, CELL_WIDTH, COL_HEADER_HEIGHT / 2);
            ctx.fillStyle = '#333';
            ctx.font = '13px "Segoe UI"';
            ctx.fillText(`ح ${periodIndex + 1}`, periodX + CELL_WIDTH / 2, COL_HEADER_HEIGHT * 0.75);
        }
        
        // Add thick border around the day
        ctx.strokeStyle = '#555'; // Darker color for separation
        ctx.lineWidth = displaySettings.lineWidth * 2;
        ctx.strokeRect(dayX, 0, dayWidth, canvas.height); // Draw border around the entire day column
        ctx.lineWidth = displaySettings.lineWidth; // Reset for other lines
        ctx.strokeStyle = '#ccc'; // Reset to default color
    });
    
    // Draw Grid Lines & Constraints
    const assignmentToCheck = selectedAssignment || (heldSession ? assignments.find(a => a.id === heldSession.assignmentId) : null);

    for (let classIdx = 0; classIdx < classes.length; classIdx++) {
        for (let dayIdx = 0; dayIdx < settings.days.length; dayIdx++) {
            for (let periodIdx = 0; periodIdx < settings.periods; periodIdx++) {
                const x = headerX - (dayIdx * settings.periods + periodIdx) * CELL_WIDTH - CELL_WIDTH;
                const y = COL_HEADER_HEIGHT + classIdx * CELL_HEIGHT;
                ctx.strokeRect(x, y, CELL_WIDTH, CELL_HEIGHT);
                
                // Show constraints
                if(assignmentToCheck && assignmentToCheck.classIds.includes(classes[classIdx].id)) {
                     assignmentToCheck.teacherIds.forEach(teacherId => {
                         if(!isTeacherAvailable(teacherId, dayIdx, periodIdx)) {
                             ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                             ctx.fillRect(x, y, CELL_WIDTH, CELL_HEIGHT);
                         }
                     });
                }
            }
        }
    }
}

function drawFittingText(text, x, y, maxWidth, initialFontSize, minFontSize = 8) {
    let fontSize = initialFontSize;
    ctx.font = `bold ${fontSize}px "Segoe UI"`;
    while (ctx.measureText(text).width > maxWidth && fontSize > minFontSize) {
        fontSize--;
        ctx.font = `bold ${fontSize}px "Segoe UI"`;
    }
    ctx.fillText(text, x, y);
}

function drawSchedule(gridStartX) {
    schedule.forEach(entry => {
        const { teacherNames, subject, assignment } = getAssignmentInfo(entry.assignmentId);
        if (!teacherNames || !subject || !assignment) return;
        
        assignment.classIds.forEach(classId => {
            const classIndex = classes.findIndex(c => c.id === classId);
            if (classIndex === -1) return;
            
            const headerX = gridStartX - ROW_HEADER_WIDTH;
            const x = headerX - (entry.dayIndex * settings.periods + entry.periodIndex) * CELL_WIDTH - CELL_WIDTH;
            const y = COL_HEADER_HEIGHT + classIndex * CELL_HEIGHT;
            
            // Draw cell background
            ctx.fillStyle = subject.color;
            ctx.fillRect(x, y, CELL_WIDTH, CELL_HEIGHT);
            ctx.strokeStyle = '#888';
            ctx.strokeRect(x, y, CELL_WIDTH, CELL_HEIGHT);
            
            // Draw text
            ctx.fillStyle = '#000';
            const fontSize = displaySettings.mainFontSize;
            ctx.font = `bold ${fontSize}px "Segoe UI"`;
            
            const textY1 = y + CELL_HEIGHT / 2 - (fontSize / 2);
            const textY2 = y + CELL_HEIGHT / 2 + (fontSize / 2);
            
            drawFittingText(subject.name, x + CELL_WIDTH / 2, textY1, CELL_WIDTH - 10, fontSize);
            
            ctx.font = `${fontSize - 2}px "Segoe UI"`;
            drawFittingText(teacherNames, x + CELL_WIDTH / 2, textY2, CELL_WIDTH - 10, fontSize - 2);
        });
    });
}

// ===================================================
// 3. التفاعلات والأحداث (Click, Drag, etc.)
// ===================================================
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const gridStartX = canvas.width - SIDEBAR_WIDTH;
    const headerX = gridStartX - ROW_HEADER_WIDTH;

    // Click on sidebar (select an assignment)
    if (x > gridStartX) {
        let yPos = 75;
        const remainingAssignments = assignments.filter(a => {
            const scheduledCount = schedule.filter(s => s.assignmentId === a.id).length;
            return a.weeklyCount - scheduledCount > 0;
        });

        remainingAssignments.forEach(assignment => {
            if (y > yPos - 25 && y < yPos + 30) {
                if (selectedAssignment && selectedAssignment.id === assignment.id) {
                    selectedAssignment = null; // Deselect
                } else {
                    selectedAssignment = assignment;
                }
                heldSession = null;
                draw();
            }
            yPos += 55;
        });
        return;
    }
    
    // Click on grid (add or pick up a session)
    if (x < headerX && y > COL_HEADER_HEIGHT) {
        const dayIdx = Math.floor((headerX - x) / (settings.periods * CELL_WIDTH));
        const periodInDay = Math.floor(((headerX - x) % (settings.periods * CELL_WIDTH)) / CELL_WIDTH);
        const periodIdx = settings.periods - 1 - periodInDay;

        const classIdx = Math.floor((y - COL_HEADER_HEIGHT) / CELL_HEIGHT);
        
         if (dayIdx >= settings.days.length || classIdx >= classes.length) return;

        const clickedClass = classes[classIdx];
        const sessionIndex = schedule.findIndex(s => 
            s.dayIndex === dayIdx && 
            s.periodIndex === periodIdx &&
            assignments.find(a => a.id === s.assignmentId)?.classIds.includes(clickedClass.id)
        );

        if (sessionIndex !== -1) { // Pick up an existing session
            heldSession = schedule[sessionIndex];
            schedule.splice(sessionIndex, 1);
            selectedAssignment = null;
        } else if (selectedAssignment) { // Place a new session
            addSessionToSchedule(selectedAssignment.id, dayIdx, periodIdx, [clickedClass.id]);
            const remaining = selectedAssignment.weeklyCount - schedule.filter(s => s.assignmentId === selectedAssignment.id).length;
            if (remaining <= 0) {
                selectedAssignment = null;
            }
        }
         draw();
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (!heldSession) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const gridStartX = canvas.width - SIDEBAR_WIDTH;
    const headerX = gridStartX - ROW_HEADER_WIDTH;

    if (x < headerX && y > COL_HEADER_HEIGHT) {
        const dayIdx = Math.floor((headerX - x) / (settings.periods * CELL_WIDTH));
        const periodInDay = Math.floor(((headerX - x) % (settings.periods * CELL_WIDTH)) / CELL_WIDTH);
        const periodIdx = settings.periods - 1 - periodInDay;
        const classIdx = Math.floor((y - COL_HEADER_HEIGHT) / CELL_HEIGHT);
        
        if (dayIdx < settings.days.length && classIdx < classes.length) {
            const targetClass = classes[classIdx];
            const assignment = assignments.find(a => a.id === heldSession.assignmentId);
            
            // We need to re-assign classIds for the session based on the drop location,
            // but maintain the merged/split group from the original assignment.
             addSessionToSchedule(heldSession.assignmentId, dayIdx, periodIdx, assignment.classIds);
        } else {
             // Dropped outside grid, return to sidebar
        }
    } else {
         // Dropped on sidebar or outside, return to sidebar
    }
    
    heldSession = null;
    draw();
    saveData();
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const gridStartX = canvas.width - SIDEBAR_WIDTH;
    const headerX = gridStartX - ROW_HEADER_WIDTH;

    if (x < headerX && y > COL_HEADER_HEIGHT) {
        const dayIdx = Math.floor((headerX - x) / (settings.periods * CELL_WIDTH));
        const periodInDay = Math.floor(((headerX - x) % (settings.periods * CELL_WIDTH)) / CELL_WIDTH);
        const periodIdx = settings.periods - 1 - periodInDay;

        const classIdx = Math.floor((y - COL_HEADER_HEIGHT) / CELL_HEIGHT);
        if (dayIdx >= settings.days.length || classIdx >= classes.length) return;

        const clickedClass = classes[classIdx];
        const sessionIndex = schedule.findIndex(s =>
            s.dayIndex === dayIdx &&
            s.periodIndex === periodIdx &&
            assignments.find(a => a.id === s.assignmentId)?.classIds.includes(clickedClass.id)
        );
        
        if (sessionIndex !== -1) {
            customConfirm("هل أنت متأكد من حذف هذه الحصة؟", () => {
                schedule.splice(sessionIndex, 1);
                draw();
                saveData();
            });
        }
    }
});

function addSessionToSchedule(assignmentId, dayIndex, periodIndex, classIds) {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    
    // Check for teacher availability
    for (const teacherId of assignment.teacherIds) {
        if (!isTeacherAvailable(teacherId, dayIndex, periodIndex)) {
            const teacher = teachers.find(t => t.id === teacherId);
            customAlert(`لا يمكن إضافة الحصة. المعلم "${teacher.name}" غير متاح في هذا الوقت.`);
            if(heldSession) { // If we were dragging, put it back
                schedule.push(heldSession);
            }
            return;
        }
    }
    
    // Check if any of the target classes already have a session
    const isClassBusy = schedule.some(entry =>
        entry.dayIndex === dayIndex &&
        entry.periodIndex === periodIndex &&
        assignments.find(a => a.id === entry.assignmentId)?.classIds.some(cid => classIds.includes(cid))
    );
    if(isClassBusy){
         customAlert("لا يمكن إضافة الحصة. أحد الفصول مشغول بالفعل في هذا الوقت.");
         if(heldSession) { schedule.push(heldSession); }
         return;
    }

    schedule.push({ assignmentId, dayIndex, periodIndex });
    saveData();
}

// ===================================================
// 4. إدارة البيانات (المعلمين، المواد، إلخ)
// ===================================================

// --- Settings ---
function saveSettings() {
    const daysInput = document.getElementById('days-input').value;
    settings.days = daysInput.split(',').map(s => s.trim()).filter(Boolean);
    settings.periods = parseInt(document.getElementById('periods-input').value) || 7;
    settings.schoolName = document.getElementById('school-name-input').value || "اسم المدرسة";
    settings.designerName = document.getElementById('designer-name-input').value || "اسم المصمم";
    
    // On settings change, might need to resize constraints arrays for all teachers
    teachers.forEach(teacher => {
        const newConstraints = Array(settings.days.length).fill(null).map(() => Array(settings.periods).fill(true));
        if (teacher.constraints) {
             for(let d=0; d < Math.min(settings.days.length, teacher.constraints.length); d++) {
                 for(let p=0; p < Math.min(settings.periods, teacher.constraints[d].length); p++){
                     newConstraints[d][p] = teacher.constraints[d][p];
                 }
             }
        }
        teacher.constraints = newConstraints;
    });
    
    closeModal('settings-modal');
    saveData();
    updateCanvasDimensions();
}

// --- Teachers ---
function renderTeachersList() {
    const list = document.getElementById('teachers-list');
    list.innerHTML = '';
    teachers.forEach(teacher => {
        const li = document.createElement('li');
        const subject = subjects.find(s => s.id === teacher.primarySubjectId);
        const subjectName = subject ? ` (${subject.name})` : '';
        li.innerHTML = `
            <span>${teacher.name}${subjectName}</span>
            <div>
                <button onclick="openConstraintsModal('${teacher.id}')">القيود</button>
                <button onclick="editTeacher('${teacher.id}')">تعديل</button>
                <button class="btn-danger" onclick="deleteTeacher('${teacher.id}')">حذف</button>
            </div>`;
        list.appendChild(li);
    });
}
function saveTeacher() {
    const name = document.getElementById('teacher-name-input').value.trim();
    const primarySubjectId = document.getElementById('teacher-subject-select').value;
    const id = document.getElementById('teacher-id-input').value;
    if (!name) return;

    if (id) { // Editing
        const teacher = teachers.find(t => t.id === id);
        if (teacher) {
            teacher.name = name;
            teacher.primarySubjectId = primarySubjectId;
        }
    } else { // Adding new
        const newTeacher = {
            id: 't' + Date.now(),
            name: name,
            primarySubjectId: primarySubjectId,
            constraints: Array(settings.days.length).fill(null).map(() => Array(settings.periods).fill(true))
        };
        teachers.push(newTeacher);
    }
    document.getElementById('teacher-name-input').value = '';
    document.getElementById('teacher-id-input').value = '';
    document.getElementById('teacher-subject-select').value = '';
    renderTeachersList();
    saveData();
}
function editTeacher(id) {
    const teacher = teachers.find(t => t.id === id);
    if (teacher) {
        document.getElementById('teacher-name-input').value = teacher.name;
        document.getElementById('teacher-id-input').value = teacher.id;
        document.getElementById('teacher-subject-select').value = teacher.primarySubjectId || '';
    }
}
function deleteTeacher(id) {
    customConfirm(`سيتم حذف المعلم وجميع الحصص المسندة له. هل أنت متأكد؟`, () => {
        assignments = assignments.filter(a => !a.teacherIds.includes(id));
        // also update assignments that might have this teacher as part of a group
        assignments.forEach(a => {
            a.teacherIds = a.teacherIds.filter(tid => tid !== id);
        });
        assignments = assignments.filter(a => a.teacherIds.length > 0); // remove assignments with no teachers left
        schedule = schedule.filter(s => {
            const assignment = assignments.find(a => a.id === s.assignmentId);
            return !!assignment;
        });
        teachers = teachers.filter(t => t.id !== id);

        renderTeachersList();
        saveData();
        draw();
    });
}

// --- Teacher Constraints ---
function openConstraintsModal(teacherId) {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    document.getElementById('constraints-teacher-name').textContent = `قيود المعلم: ${teacher.name}`;
    document.getElementById('constraints-teacher-id').value = teacherId;

    const grid = document.getElementById('constraints-grid');
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `50px repeat(${settings.periods}, 1fr)`;
    
    const daySelector = document.getElementById('day-selector');
    daySelector.innerHTML = '<option value="-1">جميع الأيام</option>';
    settings.days.forEach((day, index) => {
         const option = document.createElement('option');
         option.value = index;
         option.textContent = day;
         daySelector.appendChild(option);
    });

    // Header row
    grid.appendChild(document.createElement('div')); // empty corner
    for (let p = 0; p < settings.periods; p++) {
        grid.innerHTML += `<div><strong>ح ${p+1}</strong></div>`;
    }

    // Grid rows
    settings.days.forEach((day, dayIndex) => {
        grid.innerHTML += `<div><strong>${day}</strong></div>`;
        for (let periodIndex = 0; periodIndex < settings.periods; periodIndex++) {
            const isAvailable = (teacher.constraints && teacher.constraints[dayIndex]) ? teacher.constraints[dayIndex][periodIndex] : true;
            grid.innerHTML += `
                <div>
                    <input type="checkbox" id="c-${dayIndex}-${periodIndex}" ${isAvailable ? '' : 'checked'} 
                        onchange="toggleConstraint(${dayIndex}, ${periodIndex})">
                </div>
            `;
        }
    });
    openModal('constraints-modal');
}

function toggleConstraint(dayIndex, periodIndex) {
    // This function is just for UI feedback if needed, the real saving happens on "saveConstraints"
}

function applyFullDayConstraint() {
    const dayIndex = parseInt(document.getElementById('day-selector').value);
    const selectAll = document.getElementById('select-all-day').checked;

    const applyToDay = (d_idx) => {
         for (let p_idx = 0; p_idx < settings.periods; p_idx++) {
            const checkbox = document.getElementById(`c-${d_idx}-${p_idx}`);
            if(checkbox) checkbox.checked = selectAll;
        }
    };

    if (dayIndex === -1) { // All days
        settings.days.forEach((day, d_idx) => applyToDay(d_idx));
    } else {
        applyToDay(dayIndex);
    }
}

function saveConstraints() {
    const teacherId = document.getElementById('constraints-teacher-id').value;
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;
    
    const newConstraints = Array(settings.days.length).fill(null).map(() => Array(settings.periods).fill(true));

    for (let d = 0; d < settings.days.length; d++) {
        for (let p = 0; p < settings.periods; p++) {
            const checkbox = document.getElementById(`c-${d}-${p}`);
            if (checkbox) {
                newConstraints[d][p] = !checkbox.checked; // checked means NOT available
            }
        }
    }
    teacher.constraints = newConstraints;
    saveData();
    closeModal('constraints-modal');
    draw(); // Redraw to update constraint highlighting if a teacher is selected
}

// --- Classes ---
function renderClassesList() {
    const list = document.getElementById('classes-list');
    list.innerHTML = '';
    classes.forEach(c => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${c.name}</span>
            <div>
                 <button onclick="editClass('${c.id}')">تعديل</button>
                 <button class="btn-danger" onclick="deleteClass('${c.id}')">حذف</button>
            </div>`;
        list.appendChild(li);
    });
}
function saveClass() {
    const name = document.getElementById('class-name-input').value.trim();
    const id = document.getElementById('class-id-input').value;
    if (!name) return;

    if (id) {
        const item = classes.find(i => i.id === id);
        if (item) item.name = name;
    } else {
        classes.push({ id: 'c' + Date.now(), name: name });
    }
    document.getElementById('class-name-input').value = '';
    document.getElementById('class-id-input').value = '';
    renderClassesList();
    saveData();
    updateCanvasDimensions();
}
function editClass(id) {
    const item = classes.find(i => i.id === id);
    if (item) {
        document.getElementById('class-name-input').value = item.name;
        document.getElementById('class-id-input').value = item.id;
    }
}
function deleteClass(id) {
     customConfirm(`سيتم حذف الفصل وجميع الحصص المسندة له. هل أنت متأكد؟`, () => {
        assignments = assignments.filter(a => !a.classIds.includes(id));
        assignments.forEach(a => {
            a.classIds = a.classIds.filter(cid => cid !== id);
        });
        assignments = assignments.filter(a => a.classIds.length > 0);
        schedule = schedule.filter(s => {
            const assignment = assignments.find(a => a.id === s.assignmentId);
            return !!assignment;
        });
        classes = classes.filter(c => c.id !== id);

        renderClassesList();
        saveData();
        updateCanvasDimensions();
    });
}


// --- Subjects ---
function renderSubjectsList() {
    const list = document.getElementById('subjects-list');
    list.innerHTML = '';
    subjects.forEach(s => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span><span style="display:inline-block; width: 20px; height: 20px; background-color:${s.color}; border: 1px solid #ccc; margin-left: 10px;"></span>${s.name} (النصاب: ${s.defaultQuota || 'غير محدد'})</span>
            <div>
                 <button onclick="editSubject('${s.id}')">تعديل</button>
                 <button class="btn-danger" onclick="deleteSubject('${s.id}')">حذف</button>
            </div>`;
        list.appendChild(li);
    });
}
function saveSubject() {
    const name = document.getElementById('subject-name-input').value.trim();
    const color = document.getElementById('subject-color-input').value;
    const quota = parseInt(document.getElementById('subject-quota-input').value);
    const id = document.getElementById('subject-id-input').value;
    if (!name) return;

    if (id) {
        const item = subjects.find(i => i.id === id);
        if (item) {
            item.name = name;
            item.color = color;
            item.defaultQuota = quota;
        }
    } else {
        subjects.push({ id: 's' + Date.now(), name: name, color: color, defaultQuota: quota });
    }
    document.getElementById('subject-name-input').value = '';
    document.getElementById('subject-id-input').value = '';
    renderSubjectsList();
    saveData();
    draw();
}
function editSubject(id) {
    const item = subjects.find(i => i.id === id);
    if (item) {
        document.getElementById('subject-name-input').value = item.name;
        document.getElementById('subject-color-input').value = item.color;
        document.getElementById('subject-quota-input').value = item.defaultQuota || 3;
        document.getElementById('subject-id-input').value = item.id;
    }
}
function deleteSubject(id) {
     customConfirm(`سيتم حذف المادة وجميع الحصص المسندة لها. هل أنت متأكد؟`, () => {
        assignments = assignments.filter(a => a.subjectId !== id);
        schedule = schedule.filter(s => {
            const assignment = assignments.find(a => a.id === s.assignmentId);
            return !!assignment;
        });
        subjects = subjects.filter(s => s.id !== id);
        renderSubjectsList();
        saveData();
        draw();
    });
}

// --- Assignments ---
function renderAssignmentsList() {
    const list = document.getElementById('assignments-list');
    list.innerHTML = '';
    assignments.forEach(a => {
        const { teacherNames, classNames, subject } = getAssignmentInfo(a.id);
        if(!teacherNames || !classNames || !subject) return;

        const li = document.createElement('li');
        li.innerHTML = `
            <span>${subject.name} &larr; ${teacherNames} &larr; ${classNames} (${a.weeklyCount} حصص)</span>
            <button class="btn-danger" onclick="deleteAssignment('${a.id}')">حذف</button>
        `;
        list.appendChild(li);
    });
}
function addAssignment() {
    const classIds = Array.from(document.getElementById('assignment-classes-select').selectedOptions).map(opt => opt.value);
    const subjectId = document.getElementById('assignment-subject-select').value;
    const teacherIds = Array.from(document.getElementById('assignment-teachers-select').selectedOptions).map(opt => opt.value);
    const weeklyCount = parseInt(document.getElementById('assignment-count-input').value);

    if (classIds.length === 0 || !subjectId || teacherIds.length === 0 || !weeklyCount || weeklyCount < 1) {
        customAlert("الرجاء تعبئة جميع الحقول بشكل صحيح.");
        return;
    }

    assignments.push({
        id: 'a' + Date.now(),
        classIds,
        subjectId,
        teacherIds,
        weeklyCount
    });
    
    document.getElementById('assignment-count-input').value = '';
    renderAssignmentsList();
    saveData();
    draw();
}
function deleteAssignment(id) {
    customConfirm(`سيتم حذف هذا النصاب وجميع الحصص المرتبطة به في الجدول. هل أنت متأكد؟`, () => {
        schedule = schedule.filter(s => s.assignmentId !== id);
        assignments = assignments.filter(a => a.id !== id);
        renderAssignmentsList();
        saveData();
        draw();
    });
}

// ===================================================
// 5. وظائف مساعدة (Modals, Alerts, etc.)
// ===================================================
function openModal(modalId) {
    // Populate selects before opening
    if (modalId === 'assignments-modal') {
        const classSelect = document.getElementById('assignment-classes-select');
        const subjectSelect = document.getElementById('assignment-subject-select');
        const teacherSelect = document.getElementById('assignment-teachers-select');
        const countInput = document.getElementById('assignment-count-input');

        classSelect.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        subjectSelect.innerHTML = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        teacherSelect.innerHTML = teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

        subjectSelect.onchange = () => {
            const subject = subjects.find(s => s.id === subjectSelect.value);
            if (subject) {
                countInput.value = subject.defaultQuota || '';
            }
        };
         // Trigger change once to set initial value
        if (subjects.length > 0) subjectSelect.onchange();

    } else if (modalId === 'teachers-modal') {
        const subjectSelect = document.getElementById('teacher-subject-select');
        subjectSelect.innerHTML = '<option value="">-- اختر المادة الأساسية --</option>' 
                                + subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        renderTeachersList();
    } else if (modalId === 'classes-modal') {
        renderClassesList();
    } else if (modalId === 'subjects-modal') {
        renderSubjectsList();
    } else if (modalId === 'assignments-modal') {
        renderAssignmentsList();
    } else if (modalId === 'settings-modal') {
         document.getElementById('school-name-input').value = settings.schoolName;
         document.getElementById('designer-name-input').value = settings.designerName;
         document.getElementById('days-input').value = settings.days.join(', ');
         document.getElementById('periods-input').value = settings.periods;
    } else if (modalId === 'display-settings-modal') {
        // Link sliders to displaySettings and update on load
        const sliders = [
            { id: 'cell-width-slider', valueId: 'cell-width-value', key: 'cellWidth' },
            { id: 'cell-height-slider', valueId: 'cell-height-value', key: 'cellHeight' },
            { id: 'font-size-slider', valueId: 'font-size-value', key: 'mainFontSize' },
            { id: 'line-width-slider', valueId: 'line-width-value', key: 'lineWidth' }
        ];
        sliders.forEach(s => {
            const slider = document.getElementById(s.id);
            const valueSpan = document.getElementById(s.valueId);
            slider.value = displaySettings[s.key];
            valueSpan.textContent = slider.value;
            slider.oninput = () => {
                valueSpan.textContent = slider.value;
                displaySettings[s.key] = parseInt(slider.value);
                updateCanvasDimensions(); // Update canvas in real-time
                saveData();
            };
        });
    }
    
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function customAlert(message) {
    document.getElementById('alert-title').textContent = 'تنبيه';
    document.getElementById('alert-message').textContent = message;
    document.getElementById('alert-confirm-btn').style.display = 'inline-block';
    document.getElementById('alert-cancel-btn').style.display = 'none';
    document.getElementById('alert-confirm-btn').onclick = closeAlert;
    openModal('alert-modal');
}

function customConfirm(message, callback) {
    document.getElementById('alert-title').textContent = 'تأكيد';
    document.getElementById('alert-message').textContent = message;
    document.getElementById('alert-confirm-btn').style.display = 'inline-block';
    document.getElementById('alert-cancel-btn').style.display = 'inline-block';
    openModal('alert-modal');
    onConfirmCallback = callback;
}

function closeAlert() {
    closeModal('alert-modal');
}

document.getElementById('alert-confirm-btn').addEventListener('click', () => {
    if (onConfirmCallback) {
        onConfirmCallback();
        onConfirmCallback = null;
    }
    closeAlert();
});

// ===================================================
// 6. الخوارزميات والوظائف الرئيسية
// ===================================================
function handleRandomDistribution() {
    customConfirm("سيقوم هذا الإجراء بمسح الجدول الحالي وتوزيع الحصص المتبقية عشوائياً. هل تريد المتابعة؟", () => {
        // Use the function from scheduler-logic.js
        const result = distributeRandomly(assignments, schedule, settings, classes, teachers);
        
        schedule = result.schedule; // Update the schedule with the result from the algorithm

        if(result.unplacedCount > 0){
            customAlert(`اكتمل التوزيع. تم وضع ${result.placedCount} حصة. لم يتم وضع ${result.unplacedCount} حصة لعدم توفر أوقات مناسبة أو بسبب القيود.`);
        } else {
             customAlert(`اكتمل التوزيع بنجاح. تم وضع جميع الحصص (${result.placedCount}).`);
        }
        
        saveData();
        draw();
    });
}

function clearSchedule() {
    customConfirm("هل أنت متأكد من مسح جميع الحصص في الجدول؟", () => {
        schedule = [];
        selectedAssignment = null;
        heldSession = null;
        saveData();
        draw();
    });
}

function updateScheduleSummary() {
    const summaryDiv = document.getElementById('schedule-summary');
    if (assignments.length === 0) {
         summaryDiv.innerHTML = "الرجاء إضافة المواد والفصول والمعلمين والأنصبة أولاً.";
         return;
    }
    let totalRequired = 0;
    assignments.forEach(a => totalRequired += a.weeklyCount);
    const totalScheduled = schedule.length;
    
    let html = `إجمالي الحصص المطلوبة: ${totalRequired} | الحصص المجدولة: ${totalScheduled} | المتبقي: ${totalRequired - totalScheduled}<br><br>`;
    
    html += "<strong>أنصبة المعلمين (المجدول / الإجمالي):</strong><br>";
    let teacherSummary = [];
    teachers.forEach(t => {
        let count = 0;
        let total = 0;
        assignments.forEach(a => {
            if (a.teacherIds.includes(t.id)) {
                total += a.weeklyCount;
                count += schedule.filter(s => s.assignmentId === a.id).length;
            }
        });
        if(total > 0) {
            teacherSummary.push(`${t.name}: ${count}/${total}`);
        }
    });
    html += teacherSummary.join(' | ');
    
    summaryDiv.innerHTML = html;
}

// ===================================================
// 7. التصدير والطباعة
// ===================================================
document.getElementById('exportType').addEventListener('change', function() {
    const type = this.value;
    const itemSelect = document.getElementById('exportItem');
    itemSelect.innerHTML = '';

    if (type === 'class') {
        itemSelect.disabled = false;
        classes.forEach(c => itemSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`);
    } else if (type === 'teacher') {
        itemSelect.disabled = false;
        teachers.forEach(t => itemSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`);
    } else if (type === 'supervision') {
        itemSelect.disabled = false;
        settings.days.forEach((day, index) => itemSelect.innerHTML += `<option value="${index}">${day}</option>`);
    } else {
        itemSelect.disabled = true;
    }
});

function generateTableHTML(type, id) {
    let head = [];
    let body = [];
    let title = settings.schoolName;
    
    const periodHeaders = Array.from({ length: settings.periods }, (_, i) => `ح ${i + 1}`);

    if (type === 'school') {
        title = `الجدول الدراسي للمدرسة - ${settings.schoolName}`;
        head.push(['الفصل', ...settings.days.flatMap(day => periodHeaders.map((p, i) => `${day} (${p})`))]);
        classes.forEach(c => {
            const row = [c.name];
            settings.days.forEach((day, dayIndex) => {
                for(let periodIndex = 0; periodIndex < settings.periods; periodIndex++) {
                    const entry = schedule.find(s => {
                        const assignment = assignments.find(a => a.id === s.assignmentId);
                        return s.dayIndex === dayIndex && s.periodIndex === periodIndex && assignment && assignment.classIds.includes(c.id);
                    });
                     if (entry) {
                        const { teacherNames, subject } = getAssignmentInfo(entry.assignmentId);
                        row.push(`${subject.name}\n${teacherNames}`);
                    } else {
                        row.push('');
                    }
                }
            });
            body.push(row);
        });

    } else if (type === 'class' && id) {
         const aClass = classes.find(c => c.id === id);
         title = `الجدول الدراسي للفصل: ${aClass.name}`;
         head.push(['اليوم', ...periodHeaders]);
         settings.days.forEach((day, dayIndex) => {
             const row = [day];
             for(let periodIndex = 0; periodIndex < settings.periods; periodIndex++) {
                 const entry = schedule.find(s => {
                    const assignment = assignments.find(a => a.id === s.assignmentId);
                    return s.dayIndex === dayIndex && s.periodIndex === periodIndex && assignment && assignment.classIds.includes(id);
                 });
                 if (entry) {
                    const { teacherNames, subject } = getAssignmentInfo(entry.assignmentId);
                    row.push(`${subject.name}\n${teacherNames}`);
                } else {
                    row.push('');
                }
             }
             body.push(row);
         });

    } else if (type === 'teacher' && id) {
        const teacher = teachers.find(t => t.id === id);
        title = `الجدول الدراسي للمعلم: ${teacher.name}`;
        head.push(['اليوم', ...periodHeaders]);
        settings.days.forEach((day, dayIndex) => {
            const row = [day];
            for (let periodIndex = 0; periodIndex < settings.periods; periodIndex++) {
                 const entry = schedule.find(s => {
                    const assignment = assignments.find(a => a.id === s.assignmentId);
                    return s.dayIndex === dayIndex && s.periodIndex === periodIndex && assignment && assignment.teacherIds.includes(id);
                 });
                  if (entry) {
                    const { classNames, subject } = getAssignmentInfo(entry.assignmentId);
                    row.push(`${subject.name}\n${classNames}`);
                } else {
                    row.push('');
                }
            }
            body.push(row);
        });
    } else if (type === 'supervision' && id !== undefined) {
        const dayIndex = parseInt(id);
        if(isNaN(dayIndex) || dayIndex < 0 || dayIndex >= settings.days.length) return {html: '', title: ''};
        const dayName = settings.days[dayIndex];
        title = `الجدول اليومي لجميع الفصول - يوم ${dayName}`;
        head.push(['الفصل', ...periodHeaders]);
        classes.forEach(c => {
            const row = [c.name];
            for (let periodIndex = 0; periodIndex < settings.periods; periodIndex++) {
                const entry = schedule.find(s => {
                    const assignment = assignments.find(a => a.id === s.assignmentId);
                    return s.dayIndex === dayIndex && s.periodIndex === periodIndex && assignment && assignment.classIds.includes(c.id);
                });
                if (entry) {
                    const { teacherNames, subject } = getAssignmentInfo(entry.assignmentId);
                    row.push(`${subject.name}\n${teacherNames}`);
                } else {
                    row.push('');
                }
            }
            body.push(row);
        });
    }

    // Generate HTML
    let html = `<h2 style="text-align:center;">${title}</h2><table id="preview-table" border="1" style="width:100%; border-collapse: collapse; text-align: center; font-size: 14px;">`;
    html += '<thead><tr>' + head[0].map(h => `<th>${h}</th>`).join('') + '</tr></thead>';
    html += '<tbody>';
    body.forEach(row => {
        html += '<tr>' + row.map(cell => `<td style="padding: 5px; white-space: pre-wrap;">${cell}</td>`).join('') + '</tr>';
    });
    html += '</tbody></table>';
    html += `<p style="text-align:left; font-size: 12px; margin-top: 20px;">تصميم: ${settings.designerName}</p>`;
    
    return { html, title };
}

function previewTable() {
    const exportType = document.getElementById('exportType').value;
    const exportId = document.getElementById('exportItem').value;

    if ((exportType === 'class' || exportType === 'teacher' || exportType === 'supervision') && !exportId) {
        customAlert("الرجاء اختيار عنصر أولاً.");
        return;
    }
                 
    if (exportType === 'all_teachers') {
        let combinedHtml = '';
        teachers.forEach(teacher => {
            const tableData = generateTableHTML('teacher', teacher.id);
            combinedHtml += tableData.html + '<div style="page-break-after: always;"></div>';
        });
        document.getElementById('preview-title').textContent = "معاينة جداول جميع المعلمين";
        document.getElementById('preview-content').innerHTML = combinedHtml;

    } else {
         const { html, title } = generateTableHTML(exportType, exportId);
         document.getElementById('preview-title').textContent = title;
         document.getElementById('preview-content').innerHTML = html;
    }

    openModal('preview-modal');
    updatePreviewStyles(); // Apply default styles
}

function updatePreviewStyles() {
    const table = document.getElementById('preview-table');
    if (!table) return;
    const fontSize = document.getElementById('preview-font-size').value;
    const cellPadding = document.getElementById('preview-cell-padding').value;
    
    table.style.fontSize = `${fontSize}px`;
    table.querySelectorAll('td, th').forEach(cell => {
        cell.style.padding = `${cellPadding}px`;
    });
}

function printTable() {
    const previewContent = document.getElementById('preview-content').innerHTML;
    const title = document.getElementById('preview-title').textContent;
    
    const printWindow = window.open('', '', 'height=800,width=1200');
    printWindow.document.write('<html><head><title>' + title + '</title>');
    printWindow.document.write('<style>body{font-family: "Segoe UI", sans-serif; direction: rtl;} table{width: 100%; border-collapse: collapse; text-align: center;} th, td{border: 1px solid black; padding: 8px; white-space: pre-wrap;} @media print { .no-print { display: none; } }</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(previewContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
}

document.getElementById('export-button').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
    });
    
    // Add Arabic font
     const font = ' Amiri'; // A sample font, should be replaced by a proper base64 font for production
     doc.addFileToVFS("Amiri-Regular.ttf", font);
     doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
     doc.setFont("Amiri");

    const exportType = document.getElementById('exportType').value;
    const exportId = document.getElementById('exportItem').value;
    
    if ((exportType === 'class' || exportType === 'teacher' || exportType === 'supervision') && !exportId) {
        customAlert("الرجاء اختيار عنصر للتصدير أولاً.");
        return;
    }

    const generatePdf = (title, head, body) => {
         doc.text(title, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
         doc.autoTable({
            head: head,
            body: body,
            startY: 25,
            styles: { font: "Amiri", halign: 'center', cellPadding: 2, fontSize: 8 },
            headStyles: { fillColor: [22, 160, 133] },
            didDrawPage: function(data) {
                // Footer
                doc.setFontSize(10);
                doc.text(`تصميم: ${settings.designerName}`, data.settings.margin.left, doc.internal.pageSize.getHeight() - 10);
            }
        });
    };

    if (exportType === 'all_teachers') {
        teachers.forEach((teacher, index) => {
             const tableData = getAutoTableData('teacher', teacher.id);
             generatePdf(tableData.title, tableData.head, tableData.body);
             if(index < teachers.length - 1) {
                 doc.addPage();
             }
        });
    } else {
         const { title, head, body } = getAutoTableData(exportType, exportId);
         generatePdf(title, head, body);
    }
    
    doc.save(`جدول_${exportType}.pdf`);
});

function getAutoTableData(type, id) {
    // This function mirrors generateTableHTML but for jspdf-autotable format
     let head = [];
     let body = [];
     let title = settings.schoolName;
    const periodHeaders = Array.from({ length: settings.periods }, (_, i) => `ح ${i + 1}`);

    if (type === 'school') {
        title = `الجدول الدراسي للمدرسة - ${settings.schoolName}`;
        head.push(['الفصل', ...settings.days.flatMap(day => periodHeaders.map(p => `${day}\n${p}`))]);
         classes.forEach(c => {
            const row = [c.name];
            settings.days.forEach((_, dayIndex) => {
                for(let periodIndex = 0; periodIndex < settings.periods; periodIndex++) {
                    const entry = schedule.find(s => {
                        const assignment = assignments.find(a => a.id === s.assignmentId);
                        return s.dayIndex === dayIndex && s.periodIndex === periodIndex && assignment && assignment.classIds.includes(c.id);
                    });
                     if (entry) {
                        const { teacherNames, subject } = getAssignmentInfo(entry.assignmentId);
                        row.push(`${subject.name}\n${teacherNames}`);
                    } else {
                        row.push('');
                    }
                }
            });
            body.push(row);
        });
    } else if (type === 'class' && id) {
         const aClass = classes.find(c => c.id === id);
         title = `جدول الفصل: ${aClass.name}`;
         head.push(['اليوم', ...periodHeaders]);
         settings.days.forEach((day, dayIndex) => {
             const row = [day];
             for(let periodIndex = 0; periodIndex < settings.periods; periodIndex++) {
                 const entry = schedule.find(s => {
                    const assignment = assignments.find(a => a.id === s.assignmentId);
                    return s.dayIndex === dayIndex && s.periodIndex === periodIndex && assignment && assignment.classIds.includes(id);
                 });
                 if (entry) {
                    const { teacherNames, subject } = getAssignmentInfo(entry.assignmentId);
                    row.push(`${subject.name}\n${teacherNames}`);
                } else {
                    row.push('');
                }
             }
             body.push(row);
         });
    } else if (type === 'teacher' && id) {
        const teacher = teachers.find(t => t.id === id);
        title = `جدول المعلم: ${teacher.name}`;
        head.push(['اليوم', ...periodHeaders]);
        settings.days.forEach((day, dayIndex) => {
            const row = [day];
            for (let periodIndex = 0; periodIndex < settings.periods; periodIndex++) {
                 const entry = schedule.find(s => {
                    const assignment = assignments.find(a => a.id === s.assignmentId);
                    return s.dayIndex === dayIndex && s.periodIndex === periodIndex && assignment && assignment.teacherIds.includes(id);
                 });
                  if (entry) {
                    const { classNames, subject } = getAssignmentInfo(entry.assignmentId);
                    row.push(`${subject.name}\n${classNames}`);
                } else {
                    row.push('');
                }
            }
            body.push(row);
        });
    } else if (type === 'supervision' && id !== undefined) {
        const dayIndex = parseInt(id);
        if(isNaN(dayIndex) || dayIndex < 0 || dayIndex >= settings.days.length) return { title:'', head:[], body:[] };
        const dayName = settings.days[dayIndex];
        title = `الجدول اليومي - يوم ${dayName}`;
        head.push(['الفصل', ...periodHeaders]);
        classes.forEach(c => {
            const row = [c.name];
            for (let periodIndex = 0; periodIndex < settings.periods; periodIndex++) {
                const entry = schedule.find(s => {
                    const assignment = assignments.find(a => a.id === s.assignmentId);
                    return s.dayIndex === dayIndex && s.periodIndex === periodIndex && assignment && assignment.classIds.includes(c.id);
                });
                if (entry) {
                    const { teacherNames, subject } = getAssignmentInfo(entry.assignmentId);
                    row.push(`${subject.name}\n${teacherNames}`);
                } else {
                    row.push('');
                }
            }
            body.push(row);
        });
    }
    return { title, head, body };
}

// ===================================================
// 8. تصدير Excel والنسخ الاحتياطي
// ===================================================

function exportToExcel() {
    const exportType = document.getElementById('exportType').value;
    const exportId = document.getElementById('exportItem').value;

    if ((exportType === 'class' || exportType === 'teacher' || exportType === 'supervision') && !exportId) {
        customAlert("الرجاء اختيار عنصر للتصدير أولاً.");
        return;
    }

    const wb = XLSX.utils.book_new();
    const date = new Date().toISOString().slice(0, 10);
    let filename = `جدول_${settings.schoolName || 'المدرسة'}_${date}.xlsx`;

    if (exportType === 'all_teachers') {
        filename = `جداول_جميع_المعلمين_${date}.xlsx`;
        teachers.forEach(teacher => {
            if(!teacher.name) return;
            const { title, head, body } = getAutoTableData('teacher', teacher.id);
            const excelBody = body.map(row => row.map(cell => cell.replace(/\n/g, ', ')));
            const ws_data = [head[0], ...excelBody];
            const ws = XLSX.utils.aoa_to_sheet(ws_data);
            XLSX.utils.book_append_sheet(wb, ws, teacher.name.substring(0, 30));
        });
    } else {
        const { title, head, body } = getAutoTableData(exportType, exportId);
        const excelBody = body.map(row => row.map(cell => cell.replace(/\n/g, ', ')));
        const ws_data = [head[0], ...excelBody];
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        XLSX.utils.book_append_sheet(wb, ws, "الجدول");
        filename = `${title.replace(/[\\/:*?"<>|]/g, '').replace(/ /g, '_')}.xlsx`;
    }

    XLSX.writeFile(wb, filename);
}

function saveBackup() {
    try {
        const backupData = {
            settings: settings,
            displaySettings: displaySettings,
            teachers: teachers,
            classes: classes,
            subjects: subjects,
            assignments: assignments,
            schedule: schedule
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        a.href = url;
        a.download = `جدول_${settings.schoolName || 'المدرسة'}_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        customAlert('تم حفظ النسخة الاحتياطية بنجاح.');
    } catch (error) {
        console.error('Failed to save backup:', error);
        customAlert('حدث خطأ أثناء حفظ النسخة الاحتياطية.');
    }
}

function restoreBackup() {
    document.getElementById('backup-file-input').click();
}

document.getElementById('backup-file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const restoredData = JSON.parse(e.target.result);

            if (
                !restoredData.settings ||
                !restoredData.teachers ||
                !restoredData.classes ||
                !restoredData.subjects ||
                !restoredData.assignments ||
                !restoredData.schedule
            ) {
                throw new Error('الملف غير صالح أو تالف.');
            }

            customConfirm('هل أنت متأكد من استعادة هذه النسخة؟ سيتم الكتابة فوق جميع بياناتك الحالية.', () => {
                settings = restoredData.settings;
                displaySettings = restoredData.displaySettings || displaySettings;
                teachers = restoredData.teachers;
                classes = restoredData.classes;
                subjects = restoredData.subjects;
                assignments = restoredData.assignments;
                schedule = restoredData.schedule;

                saveData();
                
                updateCanvasDimensions();
                updateScheduleSummary();
                customAlert('تم استعادة النسخة الاحتياطية بنجاح. سيتم تحديث الواجهة.');
            });

        } catch (error) {
            console.error('Failed to restore backup:', error);
            customAlert('فشل في استعادة النسخة الاحتياطية. تأكد من أن الملف صحيح.\n' + error.message);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
});


// ===================================================
// 9. بدء التطبيق
// ===================================================
window.onload = () => {
    loadData();
    updateCanvasDimensions();
    updateScheduleSummary();
    document.getElementById('exportType').dispatchEvent(new Event('change'));
};
