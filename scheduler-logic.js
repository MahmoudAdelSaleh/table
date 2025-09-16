/**
 * هذا الملف يحتوي على الخوارزمية الأساسية لتوزيع الجدول الدراسي.
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
function isTeacherAvailableForLogic(teacherId, dayIndex, periodIndex, currentSchedule, allTeachers, allAssignments) {
    const teacher = allTeachers.find(t => t.id === teacherId);
    if (teacher && teacher.constraints && teacher.constraints[dayIndex] && !teacher.constraints[dayIndex][periodIndex]) {
        return false;
    }

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
 */
function distributeRandomly(assignments, schedule, settings, classes, teachers) {
    let newSchedule = []; 
    let remainingAssignments = [];
    assignments.forEach(a => {
        for(let i = 0; i < a.weeklyCount; i++) {
            remainingAssignments.push(a.id);
        }
    });

    remainingAssignments.sort(() => Math.random() - 0.5);

    let availableSlots = [];
    for (let d = 0; d < settings.days.length; d++) {
        for (let p = 0; p < settings.periods; p++) {
            availableSlots.push({ day: d, period: p });
        }
    }
    
    let placedCount = 0;
    let unplacedCount = 0;
    let unplacedDetails = [];

    for(const assignmentId of remainingAssignments) {
        const assignment = assignments.find(a => a.id === assignmentId);
        if (!assignment) continue;
        
        let placed = false;
        availableSlots.sort(() => Math.random() - 0.5);

        for (const slot of availableSlots) {
            const { day, period } = slot;
            
            const areClassesFree = assignment.classIds.every(cid => {
                return !newSchedule.some(s => 
                    s.dayIndex === day && 
                    s.periodIndex === period && 
                    assignments.find(a => a.id === s.assignmentId)?.classIds.includes(cid)
                );
            });
            
            if (!areClassesFree) continue;

            const areTeachersFree = assignment.teacherIds.every(tid => 
                isTeacherAvailableForLogic(tid, day, period, newSchedule, teachers, assignments)
            );
            
            if(areTeachersFree) {
                newSchedule.push({ assignmentId, dayIndex: day, periodIndex: period });
                placed = true;
                placedCount++;
                break; 
            }
        }
         if(!placed) {
            unplacedCount++;
            unplacedDetails.push(assignment);
        }
    }
    
    return {
        schedule: newSchedule,
        placedCount: placedCount,
        unplacedCount: unplacedCount,
        unplacedDetails: unplacedDetails
    };
}
