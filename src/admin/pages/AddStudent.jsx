import { useState } from "react";
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
  UserPlus,
  User,
  School,
  Wallet,
  Phone,
  Smartphone,
  MapPin,
  BookOpen,
  Heart,
  Lock,
  Camera,
  Loader2,
  Clock,
} from "lucide-react";

const classOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];

export default function AddStudent() {
  const [student, setStudent] = useState({
    fullName: "",
    motherName: "",
    className: "",
    studentType: "",
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

  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setStudent({
      ...student,
      [e.target.name]: e.target.value,
    });
  };

  const handleFeeTypeChange = (e) => {
    const value = e.target.value;
    setStudent({
      ...student,
      feeType: value,
      monthlyFee: value === "Free" ? "0" : student.monthlyFee,
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setStudent({
      ...student,
      studentPhoto: file,
    });
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handlePhoneChange = (e) => {
    const { name, value } = e.target;
    const digitsOnly = value.replace(/[^0-9]/g, "");
    setStudent({
      ...student,
      [name]: digitsOnly,
    });
  };

  const normalizeName = (name) =>
    name.trim().replace(/\s+/g, " ").toLowerCase();

  const isDuplicateFullName = async (fullName) => {
    const target = normalizeName(fullName);
    if (!target) return false;

    const [fullTimeSnap, partTimeSnap] = await Promise.all([
      getDocs(collection(db, "students")),
      getDocs(collection(db, "partTimeStudents")),
    ]);
    const allDocs = [...fullTimeSnap.docs, ...partTimeSnap.docs];
    return allDocs.some((docSnap) => {
      const existingName = docSnap.data().fullName || "";
      return normalizeName(existingName) === target;
    });
  };

  const attachStudentToClassTeachers = async (className, studentId, fullName) => {
    const teachersSnap = await getDocs(collection(db, "teachers"));

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

  const saveStudent = async () => {
    try {
      if (!student.fullName.trim()) {
        alert("Fadlan geli Magaca Ardayga");
        return;
      }

      if (!student.motherName.trim()) {
        alert("Fadlan geli Magaca Hooyada");
        return;
      }

      if (!student.className) {
        alert("Fadlan dooro Class");
        return;
      }

      if (!student.studentType) {
        alert("Fadlan dooro Full Time ama Part Time");
        return;
      }

      if (student.feeType === "Paid" && !String(student.monthlyFee).trim()) {
        alert("Fadlan geli Qiimaha Fee-ga bishii (Paid)");
        return;
      }

      if (student.parentPhone && !/^\d+$/.test(student.parentPhone)) {
        alert("Parent Phone waa inuu ahaadaa lambar keliya (numbers only)");
        return;
      }

      if (student.studentPhone && !/^\d+$/.test(student.studentPhone)) {
        alert("Student Phone waa inuu ahaadaa lambar keliya (numbers only)");
        return;
      }

      if (!student.studentPhoto) {
        alert("Fadlan soo dooro Sawirka Ardayga — waa waajib");
        return;
      }

      setSaving(true);

      const duplicate = await isDuplicateFullName(student.fullName);
      if (duplicate) {
        alert(
          `Arday hore ayaa loo diiwaan geliyay magacan "${student.fullName}". Fadlan isticmaal magac kale ama hubi in ardaygan horey loo diiwaan gelin.`
        );
        setSaving(false);
        return;
      }

      const isPartTime = student.studentType === "Part Time";
      const targetCollection = isPartTime ? "partTimeStudents" : "students";

      const existingSnap = await getDocs(collection(db, targetCollection));
      const studentId = isPartTime
        ? "R" + String(existingSnap.size + 1).padStart(3, "0")
        : String(existingSnap.size + 1).padStart(4, "0");

      let photoURL = "";
      const photoRef = ref(
        storage,
        `${targetCollection}/${studentId}/${Date.now()}_${student.studentPhoto.name}`
      );

      await uploadBytes(photoRef, student.studentPhoto);

      photoURL = await getDownloadURL(photoRef);

      const finalMonthlyFee = student.feeType === "Free" ? "0" : student.monthlyFee;

      await setDoc(doc(db, targetCollection, studentId), {
        studentId,
        fullName: student.fullName,
        motherName: student.motherName,
        className: student.className,
        studentType: student.studentType,
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
        motherName: student.motherName,
        className: student.className,
        studentType: student.studentType,
        studentPhoto: photoURL,
        district: student.district,
        parentPhone: student.parentPhone,
        studentPhone: student.studentPhone,
        idIssuedAt: new Date(),
        issuedAt: new Date(),
        createdAt: new Date(),
      });

      if (!isPartTime) {
        await attachStudentToClassTeachers(
          student.className,
          studentId,
          student.fullName
        );
      }

      alert("Student Saved Successfully: " + student.fullName + "\nStudent ID: " + studentId);

      setStudent({
        fullName: "",
        motherName: "",
        className: "",
        studentType: "",
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
      setPhotoPreview(null);
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
          maxWidth: 1220,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 36 }}>
          <label
            htmlFor="studentPhoto"
            style={{
              width: 110,
              height: 110,
              minWidth: 110,
              borderRadius: "50%",
              background: photoPreview
                ? `url(${photoPreview}) center/cover`
                : "rgba(139,108,245,0.08)",
              border: student.studentPhoto
                ? "2px solid #6d5df0"
                : "2px dashed #ff6b6b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              overflow: "hidden",
            }}
          >
            {!photoPreview && <Camera color="#8b6cf5" size={30} />}
          </label>
          <input
            id="studentPhoto"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          <div>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 22 }}>
              Sawirka Ardayga <span style={{ color: "#ff6b6b" }}>*</span>
            </div>
            <div style={{ color: "#8b87ad", fontSize: 14, marginTop: 6 }}>
              Riix goobta si aad sawir uga soo dooratid — waa waajib
            </div>
          </div>
        </div>

        <div style={grid}>
          <Field icon={User} label="Full Name">
            <input
              style={input}
              name="fullName"
              placeholder="Tusaale: Ahmed Cali"
              value={student.fullName}
              onChange={handleChange}
            />
          </Field>

          <Field icon={User} label="Mother Name">
            <input
              style={input}
              name="motherName"
              placeholder="Tusaale: Faadumo Xasan"
              value={student.motherName}
              onChange={handleChange}
            />
          </Field>

          <Field icon={School} label="Class Name">
            <select
              style={input}
              name="className"
              value={student.className}
              onChange={handleChange}
            >
              <option value="">Select Class</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field icon={Clock} label="Student Type">
            <select
              style={input}
              name="studentType"
              value={student.studentType}
              onChange={handleChange}
            >
              <option value="">Select Type</option>
              <option value="Full Time">🕒 Full Time</option>
              <option value="Part Time">⏱️ Part Time</option>
            </select>
          </Field>

          <Field icon={Wallet} label="Fee Type">
            <select
              style={input}
              name="feeType"
              value={student.feeType}
              onChange={handleFeeTypeChange}
            >
              <option value="Free">🆓 Free</option>
              <option value="Paid">💵 Paid</option>
            </select>
          </Field>

          {student.feeType === "Paid" && (
            <Field icon={Wallet} label="Monthly Fee ($)">
              <input
                style={input}
                type="number"
                name="monthlyFee"
                placeholder="0.00"
                value={student.monthlyFee}
                onChange={handleChange}
              />
            </Field>
          )}

          <Field icon={Phone} label="Parent Phone">
            <input
              style={input}
              name="parentPhone"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="61xxxxxxx"
              value={student.parentPhone}
              onChange={handlePhoneChange}
            />
          </Field>

          <Field icon={Smartphone} label="Student Phone">
            <input
              style={input}
              name="studentPhone"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="61xxxxxxx"
              value={student.studentPhone}
              onChange={handlePhoneChange}
            />
          </Field>

          <Field icon={MapPin} label="District">
            <input
              style={input}
              name="district"
              placeholder="Tusaale: Hodan"
              value={student.district}
              onChange={handleChange}
            />
          </Field>

          <Field icon={BookOpen} label="Previous School">
            <input
              style={input}
              name="previousSchool"
              placeholder="Magaca dugsiga hore"
              value={student.previousSchool}
              onChange={handleChange}
            />
          </Field>

          <Field icon={Heart} label="Orphan Status">
            <select
              style={input}
              name="orphanStatus"
              value={student.orphanStatus}
              onChange={handleChange}
            >
              <option>No</option>
              <option>Yes</option>
            </select>
          </Field>

          <Field icon={Lock} label="Parent Password">
            <input
              style={input}
              type="password"
              name="parentPassword"
              placeholder="••••••••"
              value={student.parentPassword}
              onChange={handleChange}
            />
          </Field>
        </div>

        <button
          onClick={saveStudent}
          disabled={saving}
          style={{
            ...btnPrimary,
            opacity: saving ? 0.7 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? (
            <>
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
              Kaydinaya...
            </>
          ) : (
            <>
              <UserPlus size={18} />
              Complete Registration
            </>
          )}
        </button>
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
      `}</style>
    </div>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 600,
          marginBottom: 10,
          color: "#fff",
          fontSize: 15,
        }}
      >
        <Icon size={17} color="#8b6cf5" />
        {label}
      </label>
      {children}
    </div>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "24px 32px",
  marginBottom: 34,
};

const input = {
  width: "100%",
  padding: "14px 16px",
  boxSizing: "border-box",
  border: "1.5px solid rgba(139,108,245,0.35)",
  borderRadius: 12,
  fontSize: 14.5,
  color: "#e5e3f7",
  outline: "none",
  background: "rgba(255,255,255,0.02)",
  transition: "border-color .2s",
};

const btnPrimary = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  borderRadius: 14,
  padding: "16px 28px",
  fontWeight: 700,
  fontSize: 15,
  boxShadow: "0 10px 24px rgba(109,93,240,0.35)",
};