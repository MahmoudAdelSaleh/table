/**
 * هذا الملف يحتوي على الخوارزمية الأساسية لتوزيع الجدول الدراسي.
 * يمكن أخذ هذا الكود وتكييفه ليعمل كـ Firebase Cloud Function.
 * * كيف سيعمل على Firebase:
 * 1. الواجهة الأمامية (Front-end) ترسل كل البيانات اللازمة (assignments, settings, classes, teachers) إلى الـ Cloud Function.
 * 2. الـ Cloud Function تقوم بتشغيل خوارزمية `distributeRandomly`.
 * 3. الـ Cloud Function تعيد جدول `schedule` المكتمل إلى الواجهة الأمامية.
 * 4. الواجهة الأمامية تقوم بعرض الجدول المستلم.
 * * هذا يسمح بحماية منطق الخوارزمية وجعلها قابلة للتطوير بشكل مستقل.
 */


/**
 * يتحقق مما إذا كان المعلم متاحًا في وقت معين.
 * @param {string} teacherId - معرف المعلم.
 * @param {number} dayIndex - فهرس اليوم.
 * @param {number} periodIndex - فهرس الحصة.
 * @param {Array} currentSchedule - الجدول الحالي للتحقق من التعارضات.
 * @param {Array} allTeachers - قائمة بجميع المعلمين للتحقق من القيود.
 * @param {Array} allAssignments - قائمة بجميع الأنصبة.
 * @returns {boolean} - `true` إذا كان المعلم متاحًا، وإلا `false`.
 */
function isTeacherAvailable(teacherId, dayIndex, periodIndex, currentSchedule, allTeachers, allAssignments) {
    // التحقق من القيود الشخصية للمعلم
    const teacher = allTeachers.find(t => t.id === teacherId);
    if (teacher && teacher.constraints && teacher.constraints[dayIndex] && !teacher.constraints[dayIndex][periodIndex]) {
        return false; // المعلم غير متاح بشكل صريح
    }

    // التحقق مما إذا كان المعلم لديه حصة أخرى في نفس الوقت
    const isBusy = currentSchedule.some(entry => {
        const assignment = allAssignments.find(a => a.id === entry.assignmentId);
        return entry.dayIndex === dayIndex &&
               entry.periodIndex === periodIndex &&
               assignment &&
               assignment.teacherIds.includes(teacherId);
    });

    return !isBusy;
}

/**
 * الخوارزمية الرئيسية لتوزيع الحصص بشكل عشوائي.
 * @param {Array} assignments - قائمة الأنصبة.
 * @param {Array} schedule - الجدول الحالي (عادة يكون فارغًا في البداية).
 * @param {object} settings - إعدادات الجدول (الأيام، الحصص).
 * @param {Array} classes - قائمة الفصول.
 * @param {Array} teachers - قائمة المعلمين.
 * @returns {object} - كائن يحتوي على الجدول المكتمل وعدد الحصص التي لم توضع.
 */
function distributeRandomly(assignments, schedule, settings, classes, teachers) {
    let newSchedule = []; // ابدأ بجدول فارغ

    let remainingAssignments = [];
    assignments.forEach(a => {
        for(let i = 0; i < a.weeklyCount; i++) {
            remainingAssignments.push(a.id);
        }
    });

    // خلط قائمة الحصص لوضعها
    remainingAssignments.sort(() => Math.random() - 0.5);

    let availableSlots = [];
    for (let d = 0; d < settings.days.length; d++) {
        for (let p = 0; p < settings.periods; p++) {
            availableSlots.push({ day: d, period: p });
        }
    }
    
    let placedCount = 0;
    let unplacedCount = 0;

    for(const assignmentId of remainingAssignments) {
        const assignment = assignments.find(a => a.id === assignmentId);
        if (!assignment) continue;
        
        let placed = false;
        availableSlots.sort(() => Math.random() - 0.5); // خلط الأوقات المتاحة لكل حصة

        for (const slot of availableSlots) {
            const { day, period } = slot;
            
            // تحقق مما إذا كانت جميع فصول هذا النصاب متاحة
            const areClassesFree = assignment.classIds.every(cid => {
                const classIndex = classes.findIndex(c => c.id === cid);
                return !newSchedule.some(s => 
                    s.dayIndex === day && 
                    s.periodIndex === period && 
                    assignments.find(a => a.id === s.assignmentId)?.classIds.includes(classes[classIndex].id)
                );
            });
            
            if (!areClassesFree) continue;

            // تحقق مما إذا كان جميع معلمي هذا النصاب متاحين
            const areTeachersFree = assignment.teacherIds.every(tid => 
                isTeacherAvailable(tid, day, period, newSchedule, teachers, assignments)
            );
            
            if(areTeachersFree) {
                newSchedule.push({ assignmentId, dayIndex: day, periodIndex: period });
                placed = true;
                placedCount++;
                break; // انتقل إلى الحصة التالية
            }
        }
         if(!placed) unplacedCount++;
    }
    
    return {
        schedule: newSchedule,
        placedCount: placedCount,
        unplacedCount: unplacedCount,
    };
}
