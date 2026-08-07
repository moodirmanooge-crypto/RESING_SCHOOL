import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, storage } from "../../firebase/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  doc,
  setDoc,
  collection,
  getDocs,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import {
  Users,
  Plus,
  Save,
  X,
  Upload,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const classOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];

const emptyRow = () => ({
  fullName: "",
  motherName: "", // ✅ Magaca Hooyada - field cusub
  className: "",
  shift: "",
  feeType: "Free",
  monthlyFee: "",
  parentPhone: "",
  studentPhone: "",
  district: "",
  previousSchool: "",
  orphanStatus: "No",
  parentPassword: "",
  studentPhoto: null,
});

export default function BulkRegistration() {
  const navigate = useNavigate();

  const [students, setStudents] = useState([emptyRow()]);
  const [showPopup, setShowPopup] = useState(false);
  const [savedStudents, setSavedStudents] = useState([]);
  const [saving, setSaving] = useState(false);

  const addRow = () => {
    setStudents([...students, emptyRow()]);
  };

  const handleLastFieldKeyDown = (index, e) => {
    const isLastRow = index === students.length - 1;
    if (!isLastRow) return;

    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      addRow();

      setTimeout(() => {
        const nextInput = document.querySelector(
          `[data-row="${index + 1}"][data-field="fullName"]`
        );
        if (nextInput) nextInput.focus();
      }, 0);
    }
  };

  const removeRow = (index) => {
    if (students.length === 1) return;
    setStudents(students.filter((_, i) => i !== index));
  };

  const handleChange = (index, field, value) => {
    const data = [...students];
    data[index][field] = value;
    setStudents(data);
  };

  const handleFeeTypeChange = (index, value) => {
    const data = [...students];
    data[index].feeType = value;
    if (value === "Free") {
      data[index].monthlyFee = "0";
    }
    setStudents(data);
  };

  const handleFileChange = (index, file) => {
    const data = [...students];
    data[index].studentPhoto = file;
    setStudents(data);
  };

  // ✅ Parent Phone iyo Student Phone — lambar keliya (0-9) ayaa la ogolaanayaa
  const handlePhoneChange = (index, field, value) => {
    const digitsOnly = value.replace(/[^0-9]/g, "");
    const data = [...students];
    data[index][field] = digitsOnly;
    setStudents(data);
  };

  const attachStudentToClassTeachers = async (
    teachersSnap,
    className,
    studentId,
    fullName
  ) => {
    for (const teacherDoc of teachersSnap.docs) {
      const data = teacherDoc.data();
      const teacherClasses = Array.isArray(data.classes) ? data.classes : [];

      const teachesThisClass = teacherClasses.some(
        (c) => c.className === className
      );

      if (teachesThisClass) {
        await updateDoc(doc(db, "teachers", teacherDoc.id), {
          students: arrayUnion({ studentId, fullName }),
        });
      }
    }
  };

  // ✅ Hubinta xogta safka hore intaan la kaydin — sawirka + lambarrada
  const validateStudents = () => {
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const rowLabel = `Safka ${i + 1}`;

      if (!s.fullName.trim()) {
        alert(`${rowLabel}: Fadlan geli Magaca Ardayga`);
        return false;
      }

      // ✅ Hubinta Magaca Hooyada - waajib
      if (!s.motherName.trim()) {
        alert(`${rowLabel}: Fadlan geli Magaca Hooyada`);
        return false;
      }

      if (!s.className) {
        alert(`${rowLabel}: Fadlan dooro Class`);
        return false;
      }

      if (s.feeType === "Paid" && !String(s.monthlyFee).trim()) {
        alert(`${rowLabel}: Fadlan geli Qiimaha Fee-ga bishii (Paid)`);
        return false;
      }

      if (s.parentPhone && !/^\d+$/.test(s.parentPhone)) {
        alert(`${rowLabel}: Parent Phone waa inuu ahaadaa lambar keliya (numbers only)`);
        return false;
      }

      if (s.studentPhone && !/^\d+$/.test(s.studentPhone)) {
        alert(`${rowLabel}: Student Phone waa inuu ahaadaa lambar keliya (numbers only)`);
        return false;
      }

      // ✅ Sawirka ardayga waa waajib — marnaba lama tagi karo qaybtan
      if (!s.studentPhoto) {
        alert(`${rowLabel}: Fadlan soo dooro Sawirka Ardayga — waa waajib`);
        return false;
      }
    }
    return true;
  };

  const saveStudents = async () => {
    try {
      // ✅ Ka hor inta aan wax la kaydin, hubi dhammaan safafka
      if (!validateStudents()) return;

      setSaving(true);
      const saved = [];

      // ✅ Sida ay ku jireen ardayda hore ee database-ka, si aan ID-yadu
      // isugu daba socdaan oo aan wax laga tagin ama laba arday isku ID
      // isku helin — waxaan halkan ka soo aqrinaynaa tirada ardayda jira.
      const existingSnap = await getDocs(collection(db, "students"));
      let nextIdNumber = existingSnap.size;

      const teachersSnap = await getDocs(collection(db, "teachers"));

      for (let i = 0; i < students.length; i++) {
        const student = students[i];

        nextIdNumber += 1;
        const studentId = String(nextIdNumber).padStart(4, "0");

        let photoURL = "";
        const photoRef = ref(
          storage,
          `students/${studentId}/${Date.now()}_${student.studentPhoto.name}`
        );

        await uploadBytes(photoRef, student.studentPhoto);

        photoURL = await getDownloadURL(photoRef);

        const finalMonthlyFee = student.feeType === "Free" ? "0" : student.monthlyFee;

        await setDoc(doc(db, "students", studentId), {
          studentId,
          fullName: student.fullName,
          motherName: student.motherName, // ✅ Magaca Hooyada oo lagu kaydiyo students
          className: student.className,
          shift: student.shift,
          feeType: student.feeType,
          monthlyFee: finalMonthlyFee,
          parentPhone: student.parentPhone,
          studentPhone: student.studentPhone,
          district: student.district,
          previousSchool: student.previousSchool,
          orphanStatus: student.orphanStatus,
          parentPassword: student.parentPassword,
          studentPhoto: photoURL,
          createdAt: new Date(),
        });

        await setDoc(doc(db, "attendance", studentId), {
          studentId,
          studentName: student.fullName,
        });

        await setDoc(doc(db, "cashier", studentId), {
          studentId,
          studentName: student.fullName,
          studentPhone: student.studentPhone,
          parentPhone: student.parentPhone,
          feeType: student.feeType,
          monthlyFee: finalMonthlyFee,
        });

        await setDoc(doc(db, "studentIdCards", studentId), {
          studentId,
          fullName: student.fullName,
          motherName: student.motherName, // ✅ Magaca Hooyada oo lagu daro ID Card-ka
          className: student.className,
          shift: student.shift,
          studentPhoto: photoURL,
          district: student.district,
          parentPhone: student.parentPhone,
          studentPhone: student.studentPhone,
          idIssuedAt: new Date(),
          issuedAt: new Date(),
          createdAt: new Date(),
        });

        if (student.className) {
          await attachStudentToClassTeachers(
            teachersSnap,
            student.className,
            studentId,
            student.fullName
          );
        }

        saved.push({
          ...student,
          studentId,
        });
      }

      setSavedStudents(saved);
      setShowPopup(true);

      // ✅ Marka la kaydiyo si guul leh, jaddwalka waa in uu mar kale
      // ka bilaabmaa xog cusub oo faaruq ah — safkii hore lama arki doono mar dambe
      setStudents([emptyRow()]);
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
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
        }}
      >
        {/* ---- Header ---- */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 30 }}>
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
            <Users color="#fff" size={26} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
              Bulk Student Registration
            </h1>
            <p style={{ margin: "4px 0 0", color: "#8b87ad", fontSize: 13.5 }}>
              Ku dar dhowr arday hal mar, si degdeg ah oo sahlan.
            </p>
          </div>
        </div>

        {/* ---- Table ---- */}
        <div style={{ overflowX: "auto", borderRadius: 16, border: "1px solid rgba(139,108,245,0.2)" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 1450,
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", background: "rgba(139,108,245,0.08)" }}>
                <th style={th}>Full Name</th>
                <th style={th}>Mother Name</th>
                <th style={th}>Class Name</th>
                <th style={th}>Shift</th>
                <th style={th}>Fee Type</th>
                <th style={th}>Monthly Fee ($)</th>
                <th style={th}>Parent Phone</th>
                <th style={th}>Student Phone</th>
                <th style={th}>District</th>
                <th style={th}>Previous School</th>
                <th style={th}>Orphan Status</th>
                <th style={th}>Parent Password</th>
                <th style={th}>Student Photo *</th>
                <th style={{ ...th, textAlign: "center" }}></th>
              </tr>
            </thead>

            <tbody>
              {students.map((student, index) => (
                <tr key={index}>
                  <td style={td}>
                    <input
                      style={input}
                      data-row={index}
                      data-field="fullName"
                      placeholder="Magaca oo dhan"
                      value={student.fullName}
                      onChange={(e) =>
                        handleChange(index, "fullName", e.target.value)
                      }
                    />
                  </td>

                  {/* ✅ Column cusub: Magaca Hooyada */}
                  <td style={td}>
                    <input
                      style={input}
                      data-row={index}
                      data-field="motherName"
                      placeholder="Magaca Hooyada"
                      value={student.motherName}
                      onChange={(e) =>
                        handleChange(index, "motherName", e.target.value)
                      }
                    />
                  </td>

                  <td style={td}>
                    <select
                      style={input}
                      value={student.className}
                      onChange={(e) =>
                        handleChange(index, "className", e.target.value)
                      }
                    >
                      <option value="">Select Class</option>
                      {classOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={td}>
                    <select
                      style={input}
                      value={student.shift}
                      onChange={(e) =>
                        handleChange(index, "shift", e.target.value)
                      }
                    >
                      <option value="">Select</option>
                      <option value="Morning">🌅 Morning</option>
                      <option value="Afternoon">🌇 Afternoon</option>
                    </select>
                  </td>

                  <td style={td}>
                    <select
                      style={input}
                      value={student.feeType}
                      onChange={(e) =>
                        handleFeeTypeChange(index, e.target.value)
                      }
                    >
                      <option value="Free">🆓 Free</option>
                      <option value="Paid">💵 Paid</option>
                    </select>
                  </td>

                  <td style={td}>
                    <input
                      style={{
                        ...input,
                        opacity: student.feeType === "Free" ? 0.4 : 1,
                      }}
                      type="number"
                      placeholder="0.00"
                      disabled={student.feeType === "Free"}
                      value={student.feeType === "Free" ? "0" : student.monthlyFee}
                      onChange={(e) =>
                        handleChange(index, "monthlyFee", e.target.value)
                      }
                    />
                  </td>

                  <td style={td}>
                    <input
                      style={input}
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="61xxxxxxx"
                      value={student.parentPhone}
                      onChange={(e) =>
                        handlePhoneChange(index, "parentPhone", e.target.value)
                      }
                    />
                  </td>

                  <td style={td}>
                    <input
                      style={input}
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="61xxxxxxx"
                      value={student.studentPhone}
                      onChange={(e) =>
                        handlePhoneChange(index, "studentPhone", e.target.value)
                      }
                    />
                  </td>

                  <td style={td}>
                    <input
                      style={input}
                      placeholder="Degmada"
                      value={student.district}
                      onChange={(e) =>
                        handleChange(index, "district", e.target.value)
                      }
                    />
                  </td>

                  <td style={td}>
                    <input
                      style={input}
                      placeholder="Dugsigii hore"
                      value={student.previousSchool}
                      onChange={(e) =>
                        handleChange(index, "previousSchool", e.target.value)
                      }
                    />
                  </td>

                  <td style={td}>
                    <select
                      style={input}
                      value={student.orphanStatus}
                      onChange={(e) =>
                        handleChange(index, "orphanStatus", e.target.value)
                      }
                    >
                      <option>No</option>
                      <option>Yes</option>
                    </select>
                  </td>

                  <td style={td}>
                    <input
                      style={input}
                      placeholder="••••••••"
                      value={student.parentPassword}
                      onChange={(e) =>
                        handleChange(index, "parentPassword", e.target.value)
                      }
                    />
                  </td>

                  <td style={td}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: student.studentPhoto ? "#4ade80" : "#f87171",
                        fontSize: 12,
                        cursor: "pointer",
                        border: student.studentPhoto
                          ? "1px solid rgba(74,222,128,0.4)"
                          : "1px dashed #f87171",
                        borderRadius: 8,
                        padding: "7px 9px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Upload size={13} color={student.studentPhoto ? "#4ade80" : "#f87171"} />
                      {student.studentPhoto ? student.studentPhoto.name.slice(0, 10) + "…" : "Upload *"}
                      <input
                        type="file"
                        accept="image/*"
                        data-row={index}
                        data-field="studentPhoto"
                        onChange={(e) =>
                          handleFileChange(index, e.target.files[0])
                        }
                        onKeyDown={(e) => handleLastFieldKeyDown(index, e)}
                        style={{ display: "none" }}
                      />
                    </label>
                  </td>

                  <td style={{ ...td, textAlign: "center" }}>
                    <button
                      onClick={() => removeRow(index)}
                      style={{
                        background: "rgba(239,68,68,0.15)",
                        color: "#f87171",
                        border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: 8,
                        width: 30,
                        height: 30,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---- Buttons-ka hoose ---- */}
        <div style={{ display: "flex", gap: 14, marginTop: 24 }}>
          <button onClick={addRow} style={btnSecondary}>
            <Plus size={17} />
            Add Row
          </button>

          <button
            onClick={saveStudents}
            disabled={saving}
            style={{
              ...btnPrimary,
              opacity: saving ? 0.7 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            <Save size={17} />
            {saving ? "Kaydinaya..." : "Save All"}
          </button>
        </div>
      </div>

      {/* ---- Popup-ka guusha ---- */}
      {showPopup && (
        <div style={popupOverlay}>
          <div style={popupCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  minWidth: 46,
                  borderRadius: "50%",
                  background: "rgba(34,197,94,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle2 color="#4ade80" size={24} />
              </div>
              <h2 style={{ color: "#fff", margin: 0, fontSize: 19 }}>
                Students Saved Successfully
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {savedStudents.map((student) => (
                <div
                  key={student.studentId}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    border: "1px solid rgba(139,108,245,0.15)",
                  }}
                >
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                    {student.fullName || "—"}
                  </div>
                  <div style={{ color: "#8b87ad", fontSize: 12.5, marginTop: 2 }}>
                    Student ID: {student.studentId}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                // ✅ Marka la aado bogga ardayda, popup-ka xir oo
                // savedStudents nadiifi si booqasho dambe uusan u muuqan
                setShowPopup(false);
                setSavedStudents([]);
                navigate("/admin/students");
              }}
              style={{ ...btnPrimary, width: "100%", marginTop: 22, justifyContent: "center" }}
            >
              Go To Students
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        input::placeholder {
          color: #6b6890;
        }
        select option {
          background: #1e1a4a;
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}

const th = {
  padding: "12px 10px",
  color: "#a9a6c4",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
  borderBottom: "1px solid rgba(139,108,245,0.2)",
};

const td = {
  padding: "8px 10px",
  borderBottom: "1px solid rgba(139,108,245,0.1)",
};

const input = {
  width: "100%",
  padding: "8px 10px",
  boxSizing: "border-box",
  border: "1.5px solid rgba(139,108,245,0.3)",
  borderRadius: 9,
  fontSize: 12.5,
  color: "#e5e3f7",
  background: "rgba(255,255,255,0.02)",
  outline: "none",
  minWidth: 110,
};

const btnPrimary = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "13px 24px",
  fontWeight: 700,
  fontSize: 14.5,
  boxShadow: "0 10px 24px rgba(109,93,240,0.35)",
};

const btnSecondary = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  border: "1.5px solid rgba(139,108,245,0.35)",
  borderRadius: 12,
  padding: "13px 24px",
  fontWeight: 700,
  fontSize: 14.5,
  cursor: "pointer",
};

const popupOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const popupCard = {
  background: "linear-gradient(160deg,#151233,#181341)",
  border: "1px solid rgba(139,108,245,0.3)",
  borderRadius: 18,
  padding: 30,
  minWidth: 380,
  maxWidth: 500,
  maxHeight: "80vh",
  overflowY: "auto",
};