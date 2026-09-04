// src/admin/pages/AddTeacher.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { db, storage } from "../../firebase/firebase";

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  GraduationCap,
  User,
  AtSign,
  Lock,
  School,
  BookOpen,
  Plus,
  X,
  Clock,
  Loader2,
  Phone,
  Users,
  Camera,
} from "lucide-react";

const weekDays = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
];

// Liiska caadiga ah ee fasalada ka bilaabanaya 1 ilaa F4
const defaultClassOptions = [
  "1", "2", "3", "4", "5", "6", "7", "8",
  "F1", "F2", "F3", "F4"
];

const emptySession = () => ({
  startTime: "",
  endTime: "",
});

const emptyClassBlock = () => ({
  className: "",
  subject: "",
  shift: "",
  days: [],
  daySessions: {},
});

function sortedBySessionTime(sessions) {
  return [...sessions].sort((a, b) =>
    (a.startTime || "").localeCompare(b.startTime || "")
  );
}

function withSessionNumbers(sessions) {
  return sessions.map((s, i) => ({ ...s, sessionNumber: i + 1 }));
}

export default function AddTeacher() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhoneNumber, setParentPhoneNumber] = useState("");
  const [employmentTypes, setEmploymentTypes] = useState([]);

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Fasalada laga soo saari doono db ama default
  const [availableClasses, setAvailableClasses] = useState(defaultClassOptions);

  const [classBlocks, setClassBlocks] = useState([emptyClassBlock()]);
  const [saving, setSaving] = useState(false);

  // 1. Soo akhrinta Fasalada ka jira Database-ka si Dynamic ah
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const classesSnap = await getDocs(collection(db, "classes"));
        if (!classesSnap.empty) {
          const dbClasses = classesSnap.docs.map((d) => d.data().className || d.id);
          // Isku dar fasalada DB-ka iyo kuwii hore oo ka saar kuwa ku doban (Unique)
          const mergedClasses = Array.from(new Set([...defaultClassOptions, ...dbClasses]));
          setAvailableClasses(mergedClasses);
        }
      } catch (err) {
        console.log("Warbixinta fasalada DB-ka waa la heli waayay, waxaa la isticmaalayaa liiska default-ka:", err);
      }
    };
    fetchClasses();
  }, []);

  const toggleEmploymentType = (type) => {
    setEmploymentTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Fadlan dooro sawir sax ah (jpg, png, iwm)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Sawirku waa inuu ka yaraadaa 5MB");
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const updateClassBlock = (index, field, value) => {
    const updated = [...classBlocks];
    updated[index][field] = value;
    setClassBlocks(updated);
  };

  const toggleDay = (index, day) => {
    const updated = [...classBlocks];
    const days = updated[index].days;

    if (days.includes(day)) {
      updated[index].days = days.filter((d) => d !== day);
      const remainingSessions = { ...updated[index].daySessions };
      delete remainingSessions[day];
      updated[index].daySessions = remainingSessions;
    } else {
      updated[index].days = [...days, day];
      updated[index].daySessions = {
        ...updated[index].daySessions,
        [day]: [emptySession()],
      };
    }

    setClassBlocks(updated);
  };

  const addSessionToDay = (index, day) => {
    const updated = [...classBlocks];
    const existing = updated[index].daySessions[day] || [];
    updated[index].daySessions = {
      ...updated[index].daySessions,
      [day]: [...existing, emptySession()],
    };
    setClassBlocks(updated);
  };

  const removeSessionFromDay = (index, day, sessionIdx) => {
    const updated = [...classBlocks];
    const existing = updated[index].daySessions[day] || [];
    if (existing.length === 1) return;
    updated[index].daySessions = {
      ...updated[index].daySessions,
      [day]: existing.filter((_, i) => i !== sessionIdx),
    };
    setClassBlocks(updated);
  };

  const updateSessionTime = (index, day, sessionIdx, field, value) => {
    const updated = [...classBlocks];
    const existing = [...(updated[index].daySessions[day] || [])];
    existing[sessionIdx] = { ...existing[sessionIdx], [field]: value };
    updated[index].daySessions = {
      ...updated[index].daySessions,
      [day]: existing,
    };
    setClassBlocks(updated);
  };

  const addClassBlock = () => {
    setClassBlocks([...classBlocks, emptyClassBlock()]);
  };

  const removeClassBlock = (index) => {
    if (classBlocks.length === 1) return;
    setClassBlocks(classBlocks.filter((_, i) => i !== index));
  };

  const validateSessions = () => {
    for (const block of classBlocks) {
      for (const day of block.days) {
        const sessions = block.daySessions[day] || [];

        for (const s of sessions) {
          if (!s.startTime || !s.endTime) {
            alert(
              `Fadlan buuxi waqtiga bilowga iyo dhamaadka ee ${day} (${block.className || "fasal"})`
            );
            return false;
          }
          if (s.startTime >= s.endTime) {
            alert(
              `${day}: waqtiga dhamaadka waa inuu ka dambeeyaa waqtiga bilowga`
            );
            return false;
          }
        }

        const sorted = [...sessions].sort((a, b) =>
          a.startTime.localeCompare(b.startTime)
        );
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i].endTime > sorted[i + 1].startTime) {
            alert(
              `${day}: xiisadaha waa isku dhacayaan waqti ahaan, fadlan wax ka beddel`
            );
            return false;
          }
        }
      }
    }
    return true;
  };

  // 2. SOO AKHRISKA TIMETABLE-KA IYO KU SHUBAALADA MAADOOBYINKA & ARDAYDA CUSUB
  const syncTeacherTimetableToClasses = async (teacherUsername, teacherFullName) => {
    const modifiedClasses = new Set();
    const assignedStudents = [];

    for (const block of classBlocks) {
      const className = block.className;
      const subject = block.subject;

      if (!className) continue;
      modifiedClasses.add(className);

      for (const day of block.days) {
        const daySessions = block.daySessions[day] || [];
        if (daySessions.length === 0) continue;

        const ttDocKey = `${className}__${day}`;
        const ttRef = doc(db, "timetable", ttDocKey);

        const ttSnap = await getDoc(ttRef);

        let existingSessions = [];
        if (ttSnap.exists()) {
          existingSessions = ttSnap.data().sessions || [];
        }

        let otherTeachersSessions = existingSessions.filter((s) => s.teacherId !== teacherUsername);

        const newTeacherSessions = daySessions.map((s) => ({
          id: `s_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          startTime: s.startTime,
          endTime: s.endTime,
          teacherId: teacherUsername,
          teacherName: teacherFullName,
          subject: subject,
        }));

        const allSessionsCombined = sortedBySessionTime([...otherTeachersSessions, ...newTeacherSessions]);
        const finalSessions = withSessionNumbers(allSessionsCombined);

        await setDoc(ttRef, {
          className,
          day,
          sessions: finalSessions,
          updatedAt: new Date(),
        }, { merge: true });
      }
    }

    // 3. SOO AKHRINAYA ARDAYDA FASALADAAS OO DIGNIIN LA'AAN LOO KU LINGAYO MACALINKA
    for (const className of modifiedClasses) {
      try {
        const studentsSnap = await getDocs(
          query(collection(db, "students"), where("className", "==", className))
        );

        studentsSnap.docs.forEach((docSnap) => {
          const sData = docSnap.data();
          assignedStudents.push({
            studentId: docSnap.id,
            fullName: sData.fullName || "",
            className: className
          });
        });

        if (studentsSnap.empty) continue;

        const fullWeekSchedule = [];
        for (const d of weekDays) {
          const key = `${className}__${d}`;
          const ttSnap = await getDoc(doc(db, "timetable", key));
          const sessionsData = ttSnap.exists() ? ttSnap.data().sessions || [] : [];

          const sortedSessions = sortedBySessionTime(sessionsData).map((s) => ({
            sessionNumber: s.sessionNumber,
            startTime: s.startTime,
            endTime: s.endTime,
            teacherId: s.teacherId,
            teacherName: s.teacherName || s.teacherId,
            subject: s.subject || "",
          }));

          fullWeekSchedule.push({
            day: d,
            dayLabel: d,
            sessions: sortedSessions,
          });
        }

        const batch = writeBatch(db);
        studentsSnap.docs.forEach((studentDoc) => {
          batch.update(doc(db, "students", studentDoc.id), {
            timetable: fullWeekSchedule,
            timetableUpdatedAt: new Date(),
          });
        });
        await batch.commit();
      } catch (err) {
        console.log("Error updating student schedules:", err);
      }
    }

    return assignedStudents;
  };

  const saveTeacher = async (e) => {
    e.preventDefault();

    if (fullName === "" || username === "" || password === "") {
      alert("Fill Required Fields");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    if (phoneNumber === "") {
      alert("Fadlan geli numbarka macalinka");
      return;
    }

    if (parentName === "") {
      alert("Fadlan geli magaca waalidka");
      return;
    }

    if (parentPhoneNumber === "") {
      alert("Fadlan geli numbarka waalidka");
      return;
    }

    if (employmentTypes.length === 0) {
      alert("Fadlan dooro nooca shaqada macalinka (Full Time / Part Time) - waad dooran kartaa labadaba");
      return;
    }

    if (!validateSessions()) {
      return;
    }

    try {
      setSaving(true);

      let teacherPhotoUrl = "";
      if (photoFile) {
        setUploadingPhoto(true);
        const fileExt = photoFile.name.split(".").pop();
        const photoRef = ref(
          storage,
          `teacherPhotos/${username}-${Date.now()}.${fileExt}`
        );
        await uploadBytes(photoRef, photoFile);
        teacherPhotoUrl = await getDownloadURL(photoRef);
        setUploadingPhoto(false);
      }

      const uniqueSubjects = [
        ...new Set(
          classBlocks
            .map((b) => (b.subject || "").trim())
            .filter((s) => s.length > 0)
        ),
      ];

      // DISPATCH TIMETABLE READ & ARDAYDA FASALADAAS
      const assignedStudents = await syncTeacherTimetableToClasses(username, fullName);

      const teacherData = {
        fullName,
        username,
        password,
        phoneNumber,
        phone: phoneNumber,
        parentName,
        matherName: parentName,
        parentPhoneNumber,
        employmentType: employmentTypes,
        subjects: uniqueSubjects,
        teacherPhoto: teacherPhotoUrl,
        classes: classBlocks,
        students: assignedStudents, // Ardayda loo xiray macalinka sida AddStudent.jsx ga
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "teachers", username), teacherData);

      await setDoc(doc(db, "teacher_id", username), {
        ...teacherData,
        teacherUsername: username,
        issuedAt: serverTimestamp(),
      });

      alert("Macalinka waa la kaydiyay, jadwalka fasaladiisa iyo ardayda oo dhan waa la aqriyay oo la cusbooneysiiyay!");
      navigate("/admin/teachers");
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
      setUploadingPhoto(false);
    }
  };

  return (
    <div style={{ background: "#0b0a1c", minHeight: "100vh", padding: "30px" }}>
      <div
        style={{
          background: "linear-gradient(160deg,#151233,#181341)",
          borderRadius: 24,
          padding: "36px 40px",
          border: "1px solid rgba(139,108,245,0.25)",
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <div
            style={{
              width: 52,
              height: 52,
              minWidth: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 20px rgba(109,93,240,0.3)",
            }}
          >
            <GraduationCap color="#fff" size={26} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
              Macalin Cusub Abuur
            </h1>
            <p style={{ margin: "4px 0 0", color: "#8b87ad", fontSize: 13.5 }}>
              Geli macluumaadka macalinka iyo jadwalka fasalada uu xaadirin doono.
            </p>
          </div>
        </div>

        <form onSubmit={saveTeacher}>
          <div style={{ marginBottom: 26 }}>
            <label style={label}>
              <Camera size={15} color="#8b6cf5" />
              Sawirka Macalinka <span style={{ color: "#8b87ad", fontWeight: 400 }}>(ikhtiyaari)</span>
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={photoPreviewBox}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" style={photoPreviewImg} />
                ) : (
                  <Camera size={26} color="#5a5680" />
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={uploadBtn}>
                  {photoPreview ? "Bedel Sawirka" : "Soo Geli Sawir"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    style={{ display: "none" }}
                  />
                </label>
                {photoPreview && (
                  <button type="button" onClick={removePhoto} style={removePhotoBtn}>
                    <X size={13} /> Ka saar sawirka
                  </button>
                )}
                <span style={{ fontSize: 11.5, color: "#6b6890" }}>
                  JPG ama PNG, ugu badnaan 5MB
                </span>
              </div>
            </div>
          </div>

          <div style={topGrid}>
            <Field icon={User} label="Magaca Macalinka">
              <input
                style={input}
                placeholder="Tusaale: Cabdi Xasan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </Field>

            <Field icon={AtSign} label="Username">
              <input
                style={input}
                placeholder="Tusaale: cabdi.macalin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
          </div>

          <div style={topGrid}>
            <Field icon={Phone} label="Numbarka Macalinka">
              <input
                style={input}
                type="tel"
                placeholder="Tusaale: 0615XXXXXX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </Field>

            <Field icon={Users} label="Numbarka Waalidka">
              <input
                style={input}
                type="tel"
                placeholder="Tusaale: 0615XXXXXX"
                value={parentPhoneNumber}
                onChange={(e) => setParentPhoneNumber(e.target.value)}
              />
            </Field>
          </div>

          <div style={topGrid}>
            <Field icon={User} label="Magaca Waalidka">
              <input
                style={input}
                placeholder="Tusaale: Xasan Cali"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
              />
            </Field>
          </div>

          <div style={topGrid}>
            <Field icon={Lock} label="Password">
              <input
                style={{ ...input, maxWidth: 420 }}
                type="password"
                placeholder="Ugu yaraan 6 xaraf"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <Field icon={Clock} label="Nooca Shaqada">
              <div style={employmentCheckRow}>
                <label
                  style={{
                    ...employmentCheckPill,
                    background: employmentTypes.includes("Full Time")
                      ? "linear-gradient(90deg,#6d5df0,#8b6cf5)"
                      : "rgba(255,255,255,0.03)",
                    color: employmentTypes.includes("Full Time") ? "#fff" : "#a9a6c4",
                    borderColor: employmentTypes.includes("Full Time")
                      ? "transparent"
                      : "rgba(139,108,245,0.3)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={employmentTypes.includes("Full Time")}
                    onChange={() => toggleEmploymentType("Full Time")}
                    style={{ display: "none" }}
                  />
                  Full Time
                </label>

                <label
                  style={{
                    ...employmentCheckPill,
                    background: employmentTypes.includes("Part Time")
                      ? "linear-gradient(90deg,#6d5df0,#8b6cf5)"
                      : "rgba(255,255,255,0.03)",
                    color: employmentTypes.includes("Part Time") ? "#fff" : "#a9a6c4",
                    borderColor: employmentTypes.includes("Part Time")
                      ? "transparent"
                      : "rgba(139,108,245,0.3)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={employmentTypes.includes("Part Time")}
                    onChange={() => toggleEmploymentType("Part Time")}
                    style={{ display: "none" }}
                  />
                  Part Time
                </label>
              </div>
              <span style={{ fontSize: 11.5, color: "#6b6890", display: "block", marginTop: 8 }}>
                Waad dooran kartaa mid ama labadaba
              </span>
            </Field>
          </div>

          <hr style={{ margin: "10px 0 26px", border: "none", borderTop: "1px solid rgba(139,108,245,0.2)" }} />

          <h3 style={{ color: "#fff", fontSize: 17, marginBottom: 18 }}>
            Fasalada uu Xaadirin Doono
          </h3>

          {classBlocks.map((block, index) => (
            <div key={index} style={classCard}>
              <div style={classCardHeader}>
                <span style={classCardTitle}>Fasalka #{index + 1}</span>
                {classBlocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeClassBlock(index)}
                    style={removeBtn}
                  >
                    <X size={13} /> Ka saar
                  </button>
                )}
              </div>

              <div style={twoColGrid}>
                <Field icon={School} label="Class">
                  <select
                    style={input}
                    value={block.className}
                    onChange={(e) =>
                      updateClassBlock(index, "className", e.target.value)
                    }
                  >
                    <option value="">-- Dooro Fasal --</option>
                    {availableClasses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field icon={BookOpen} label="Maadada">
                  <input
                    style={input}
                    placeholder="Tusaale: Mathematics"
                    value={block.subject}
                    onChange={(e) =>
                      updateClassBlock(index, "subject", e.target.value)
                    }
                  />
                </Field>

                <Field icon={Clock} label="Shift">
                  <select
                    style={input}
                    value={block.shift}
                    onChange={(e) =>
                      updateClassBlock(index, "shift", e.target.value)
                    }
                  >
                    <option value="">-- Dooro Shift --</option>
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                  </select>
                </Field>
              </div>

              <div style={{ marginTop: 18 }}>
                <label style={label}>Maalmaha Toddobaadka</label>
                <div style={dayRow}>
                  {weekDays.map((day) => {
                    const active = block.days.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => toggleDay(index, day)}
                        style={{
                          ...dayPill,
                          background: active
                            ? "linear-gradient(90deg,#6d5df0,#8b6cf5)"
                            : "rgba(255,255,255,0.03)",
                          color: active ? "#fff" : "#a9a6c4",
                          borderColor: active
                            ? "transparent"
                            : "rgba(139,108,245,0.3)",
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {block.days.length > 0 && (
                <div style={{ marginTop: 22 }}>
                  <label style={label}>Saacadaha Xiisadaha</label>

                  {block.days.map((day) => {
                    const sessions = block.daySessions[day] || [];
                    return (
                      <div key={day} style={dayScheduleCard}>
                        <div style={dayScheduleHeader}>
                          <span style={dayScheduleTitle}>
                            <Clock size={14} color="#8b6cf5" />
                            {day}
                          </span>
                          <button
                            type="button"
                            onClick={() => addSessionToDay(index, day)}
                            style={addSessionBtn}
                          >
                            <Plus size={12} /> Xiisad kale
                          </button>
                        </div>

                        {sessions.map((session, sIdx) => (
                          <div key={sIdx} style={sessionRow}>
                            <span style={sessionLabel}>
                              Xiisadda #{sIdx + 1}
                            </span>

                            <div>
                              <label style={miniLabel}>Waqtiga Bilowga</label>
                              <input
                                type="time"
                                style={timeInput}
                                value={session.startTime}
                                onChange={(e) =>
                                  updateSessionTime(
                                    index,
                                    day,
                                    sIdx,
                                    "startTime",
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                            <div>
                              <label style={miniLabel}>Waqtiga Dhamaadka</label>
                              <input
                                type="time"
                                style={timeInput}
                                value={session.endTime}
                                onChange={(e) =>
                                  updateSessionTime(
                                    index,
                                    day,
                                    sIdx,
                                    "endTime",
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                            {sessions.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  removeSessionFromDay(index, day, sIdx)
                                }
                                style={removeSessionBtn}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          <button type="button" onClick={addClassBlock} style={addBlockBtn}>
            <Plus size={16} /> Ku dar Fasal/Maado Kale
          </button>

          <button type="submit" disabled={saving} style={submitBtn}>
            {saving ? (
              <>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                {uploadingPhoto ? "Sawirka waa la soo gelinayaa..." : "Akrinaaya Timetable-ka & Kaydinaya..."}
              </>
            ) : (
              <>
                <GraduationCap size={18} />
                Abuur Macalin + Akhri Timetable & Kaydi
              </>
            )}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder {
          color: #6b6890;
        }
        select option {
          background: #1e1a4a;
          color: #ffffff;
        }
        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}

function Field({ icon: Icon, label: labelText, children }) {
  return (
    <div>
      <label style={label}>
        <Icon size={15} color="#8b6cf5" />
        {labelText}
      </label>
      {children}
    </div>
  );
}

const label = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 14,
  fontWeight: 600,
  color: "#fff",
  marginBottom: 8,
};

const input = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  boxSizing: "border-box",
  fontSize: 14,
  color: "#e5e3f7",
  background: "rgba(255,255,255,0.02)",
  outline: "none",
};

const topGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 22,
  marginBottom: 22,
};

const twoColGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 20,
};

const classCard = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(139,108,245,0.2)",
  borderRadius: 16,
  padding: 22,
  marginBottom: 18,
};

const classCardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
};

const classCardTitle = {
  color: "#8b6cf5",
  fontWeight: 700,
  fontSize: 15,
};

const removeBtn = {
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.3)",
  color: "#f87171",
  cursor: "pointer",
  fontSize: 12.5,
  borderRadius: 8,
  padding: "6px 10px",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};

const dayRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const dayPill = {
  padding: "9px 18px",
  borderRadius: 20,
  border: "1.5px solid",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const addBlockBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.03)",
  border: "1.5px solid rgba(139,108,245,0.4)",
  color: "#8b6cf5",
  padding: "13px 22px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
  marginBottom: 22,
};

const submitBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "16px",
  width: "100%",
  borderRadius: 14,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 15,
  boxShadow: "0 10px 24px rgba(109,93,240,0.35)",
};

const dayScheduleCard = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(139,108,245,0.15)",
  borderRadius: 12,
  padding: 16,
  marginTop: 12,
};

const dayScheduleHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

const dayScheduleTitle = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontWeight: 700,
  color: "#fff",
  fontSize: 14,
};

const addSessionBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "rgba(139,108,245,0.1)",
  border: "1.5px solid rgba(139,108,245,0.4)",
  color: "#8b6cf5",
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 12,
  cursor: "pointer",
  fontWeight: 600,
};

const sessionRow = {
  display: "flex",
  gap: 16,
  alignItems: "flex-end",
  marginBottom: 12,
  flexWrap: "wrap",
};

const sessionLabel = {
  fontSize: 12.5,
  color: "#a9a6c4",
  minWidth: 80,
  marginBottom: 10,
};

const miniLabel = {
  display: "block",
  fontSize: 11.5,
  color: "#8b87ad",
  marginBottom: 6,
};

const timeInput = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
  color: "#e5e3f7",
  fontSize: 13.5,
  colorScheme: "dark",
};

const removeSessionBtn = {
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.3)",
  color: "#f87171",
  cursor: "pointer",
  borderRadius: 7,
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 10,
};

const photoPreviewBox = {
  width: 88,
  height: 88,
  borderRadius: 14,
  border: "1.5px dashed rgba(139,108,245,0.4)",
  background: "rgba(255,255,255,0.02)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  flexShrink: 0,
};

const photoPreviewImg = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const uploadBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(139,108,245,0.12)",
  border: "1px solid rgba(139,108,245,0.4)",
  color: "#8b6cf5",
  borderRadius: 9,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const removePhotoBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.3)",
  color: "#f87171",
  cursor: "pointer",
  fontSize: 12,
  borderRadius: 8,
  padding: "6px 10px",
  width: "fit-content",
};

const employmentCheckRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const employmentCheckPill = {
  display: "inline-flex",
  alignItems: "center",
  padding: "12px 18px",
  borderRadius: 10,
  border: "1.5px solid",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};