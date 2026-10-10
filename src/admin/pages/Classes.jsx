// src/admin/pages/Classes.jsx
// Fasallada — naqshad cusub (light/green, la mid ah Student List).
//
// XOGTA:
//   - Ardayda waxaa laga soo akhriyaa LABADA collection: `students` (Full Time)
//     iyo `partTimeStudents` (Part Time).
//   - Ardayda la codsaday in la tirtiro (pendingDeletion) MARNABA halkan kuma
//     soo muuqdaan — taasi waxay ahayd sababta ardaydii hore "dib u soo noqonayeen".
//
// LABANLAAB (DUPLICATES):
//   - Haddii arday isku magac ah (ama mid magaciisu yahay qayb ka mid ah magaca
//     kale, isla fasal ama isla hooyo) laba jeer la diiwaan geliyay, kan xogta
//     ugu buuxda leh ayaa la muujiyaa, kan kalena waa la qariyaa.
//   - Marka fasal la wareejiyo, labanlaabyada qarsoon waxay la socdaan ardaygii
//     asalka ahaa, si aysan dib ugu soo muuqan fasalkii hore.
//   - Fasal kasta wuxuu muujinayaa "N labanlaab ayaa la qariyay" iyo badhan
//     aad ku eegi karto si aad ugu tirtirto Student List.

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, doc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import {
  School,
  Users,
  ArrowLeft,
  Pencil,
  X,
  Save,
  Loader2,
  Search,
  GraduationCap,
  Phone,
  Clock,
  Heart,
  Copy,
  ChevronRight,
  Layers,
  Eye,
  EyeOff,
} from "lucide-react";

const classOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];
const GRADUATES_KEY = "Qalin Jabis";
const renameTargetOptions = [...classOptions, GRADUATES_KEY];

// ---------------- helpers ----------------
const normalizeName = (n) => (n || "").trim().replace(/\s+/g, " ").toLowerCase();

const photoOf = (s) => (s?.studentPhoto || s?.photoURL || s?.photoUrl || "").trim();

function completeness(s) {
  return ["motherName", "parentPhone", "studentPhone", "district", "shift", "previousSchool"].filter(
    (k) => s[k]
  ).length + (photoOf(s) ? 2 : 0);
}

function idCompare(a, b) {
  return String(a.studentId || a.id).localeCompare(String(b.studentId || b.id), undefined, {
    numeric: true,
  });
}

// Ka saar ardayda labanlaabka ah. Wuxuu soo celinayaa { kept, hidden }.
function dedupeStudents(list) {
  const sorted = [...list].sort((a, b) => completeness(b) - completeness(a) || idCompare(a, b));
  const kept = [];
  const hidden = [];

  for (const s of sorted) {
    const n = normalizeName(s.fullName);
    const dup = kept.find((k) => {
      const kn = normalizeName(k.fullName);
      if (!n || !kn) return false;
      if (n === kn) return true;

      // Mid magaciisu waa bilowga kan kale (tusaale "Ilwaad Xasan Maxamed"
      // iyo "Ilwaad Xasan Maxamed Cabdulaahi") — kaliya haddii magaca gaaban
      // uu leeyahay ugu yaraan 3 eray, oo ay isku fasal yihiin ama isku hooyo.
      const shorter = n.length < kn.length ? n : kn;
      const isPrefix = kn.startsWith(n + " ") || n.startsWith(kn + " ");
      if (!isPrefix || shorter.split(" ").length < 3) return false;
      const sameClass = String(k.className || "") === String(s.className || "");
      const sameMother =
        k.motherName && s.motherName && normalizeName(k.motherName) === normalizeName(s.motherName);
      return sameClass || sameMother;
    });

    if (dup) hidden.push({ ...s, duplicateOfId: dup.id, duplicateOfCollection: dup.collection });
    else kept.push(s);
  }

  return { kept, hidden };
}

const classLabel = (c) => (c === GRADUATES_KEY ? GRADUATES_KEY : `Class ${c}`);

function classTheme(c) {
  if (c === GRADUATES_KEY)
    return { grad: "linear-gradient(135deg,#f59e0b,#b45309)", soft: "#fffbeb", ink: "#b45309", level: "Qalin Jabis" };
  if (String(c).startsWith("F"))
    return { grad: "linear-gradient(135deg,#6366f1,#4338ca)", soft: "#eef2ff", ink: "#4338ca", level: "Secondary" };
  if (classOptions.includes(String(c)))
    return { grad: "linear-gradient(135deg,#22c55e,#15803d)", soft: "#f0fdf4", ink: "#15803d", level: "Primary" };
  return { grad: "linear-gradient(135deg,#94a3b8,#475569)", soft: "#f1f5f9", ink: "#475569", level: "Kale" };
}

// ---------------- small components ----------------
function Avatar({ student, size = 44, radius = 14, ring = "#fff" }) {
  const [failed, setFailed] = useState(false);
  const url = photoOf(student);
  const base = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: radius,
    border: `2.5px solid ${ring}`,
    boxShadow: "0 3px 10px rgba(0,0,0,0.10)",
    background: "#fff",
  };
  if (url && !failed) {
    return (
      <img
        src={url}
        alt={student.fullName || ""}
        onError={() => setFailed(true)}
        style={{ ...base, objectFit: "cover", objectPosition: "center top", display: "block" }}
      />
    );
  }
  return (
    <div
      style={{
        ...base,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#15803d",
        fontWeight: 800,
        fontSize: size * 0.34,
      }}
    >
      {(student.fullName || "?").trim().slice(0, 2).toUpperCase()}
    </div>
  );
}

function AvatarStack({ list, max = 5 }) {
  const shown = list.slice(0, max);
  const extra = list.length - shown.length;
  if (list.length === 0) {
    return <div style={{ fontSize: 12, color: "#9ca3af" }}>Arday ma jiro weli</div>;
  }
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {shown.map((s, i) => (
        <div key={`${s.collection}_${s.id}`} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: max - i }}>
          <Avatar student={s} size={32} radius={999} />
        </div>
      ))}
      {extra > 0 && (
        <div
          style={{
            marginLeft: -10,
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "#f3f4f6",
            border: "2.5px solid #fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 800,
            color: "#4b5563",
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

// =====================================================================
export default function Classes() {
  const [students, setStudents] = useState([]); // la muujinayo (labanlaab la'aan)
  const [duplicates, setDuplicates] = useState([]); // labanlaabyada la qariyay
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [showDuplicates, setShowDuplicates] = useState(false);

  const [selectedClass, setSelectedClass] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [newClassName, setNewClassName] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasFailed, setHasFailed] = useState(null);
  const [failedStudentIds, setFailedStudentIds] = useState(new Set());
  const [viewingStudent, setViewingStudent] = useState(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    try {
      setLoading(true);
      const [fullSnap, partSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "partTimeStudents")),
      ]);
      const all = [
        ...fullSnap.docs.map((d) => ({
          id: d.id,
          collection: "students",
          studentType: d.data().studentType || "Full Time",
          ...d.data(),
        })),
        ...partSnap.docs.map((d) => ({
          id: d.id,
          collection: "partTimeStudents",
          studentType: d.data().studentType || "Part Time",
          ...d.data(),
        })),
      ].filter((s) => !s.pendingDeletion); // ardayda la tirtiray marnaba ha soo noqon

      const { kept, hidden } = dedupeStudents(all);
      setStudents(kept);
      setDuplicates(hidden);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  const keyOf = (s) => `${s.collection}_${s.id}`;

  const classGroups = useMemo(() => {
    const groups = {};
    classOptions.forEach((c) => (groups[c] = []));
    students.forEach((s) => {
      const cls = s.className || "Unknown";
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(s);
    });
    const real = Object.entries(groups)
      .filter(([n]) => n !== GRADUATES_KEY)
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([n, l]) => [n, [...l].sort(idCompare)]);
    return [...real, [GRADUATES_KEY, (groups[GRADUATES_KEY] || []).sort(idCompare)]];
  }, [students]);

  const maxClassSize = Math.max(1, ...classGroups.map(([, l]) => l.length));
  const totalActive = students.filter((s) => s.className !== GRADUATES_KEY).length;
  const graduatesTotal = students.filter((s) => s.className === GRADUATES_KEY).length;

  const classList = useMemo(
    () => (selectedClass ? students.filter((s) => (s.className || "Unknown") === selectedClass) : []),
    [students, selectedClass]
  );

  const classDuplicates = useMemo(
    () => (selectedClass ? duplicates.filter((s) => (s.className || "Unknown") === selectedClass) : []),
    [duplicates, selectedClass]
  );

  const visibleStudents = useMemo(() => {
    const q = search.toLowerCase().trim();
    return [...classList, ...(showDuplicates ? classDuplicates : [])]
      .filter((s) => typeFilter === "ALL" || s.studentType === typeFilter)
      .filter(
        (s) =>
          !q ||
          (s.fullName || "").toLowerCase().includes(q) ||
          (s.studentId || "").toLowerCase().includes(q) ||
          (s.parentPhone || "").includes(q)
      )
      .sort(idCompare);
  }, [classList, classDuplicates, showDuplicates, search, typeFilter]);

  const affectedStudents = useMemo(
    () => (renaming ? students.filter((s) => (s.className || "Unknown") === renaming).sort(idCompare) : []),
    [students, renaming]
  );

  // ---------- rename / move ----------
  function openRename(className) {
    setRenaming(className);
    setNewClassName(className);
    setHasFailed(null);
    setFailedStudentIds(new Set());
  }

  function closeRename() {
    if (saving) return;
    setRenaming(null);
    setNewClassName("");
    setHasFailed(null);
    setFailedStudentIds(new Set());
  }

  function toggleFailedStudent(key) {
    setFailedStudentIds((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function saveRename() {
    if (!newClassName) return alert("Fadlan dooro fasalka cusub");
    if (newClassName === renaming) return closeRename();
    if (hasFailed === null) return alert("Fadlan jawaab su'aasha: Ma jiraa arday dhacay?");

    const toMove = affectedStudents.filter((s) => !failedStudentIds.has(keyOf(s)));
    const staying = affectedStudents.filter((s) => failedStudentIds.has(keyOf(s)));

    if (toMove.length === 0) {
      alert(staying.length ? "Dhammaan ardayda waxaa loo calaamadeeyay inay dhaceen — cidna lama wareejin." : "Fasalkan arday kuma jiraan.");
      return closeRename();
    }

    // Labanlaabyada qarsoon ee ardayda la wareejinayo way la socdaan,
    // si aysan dib ugu soo muuqan fasalkii hore.
    const movingKeys = new Set(toMove.map(keyOf));
    const dupsToMove = duplicates.filter((d) =>
      movingKeys.has(`${d.duplicateOfCollection}_${d.duplicateOfId}`)
    );

    try {
      setSaving(true);
      const all = [...toMove, ...dupsToMove];
      for (let i = 0; i < all.length; i += 450) {
        const batch = writeBatch(db);
        all.slice(i, i + 450).forEach((s) =>
          batch.update(doc(db, s.collection, s.id), { className: newClassName })
        );
        await batch.commit();
      }

      const movedAll = new Set(all.map(keyOf));
      setStudents((prev) => prev.map((s) => (movedAll.has(keyOf(s)) ? { ...s, className: newClassName } : s)));
      setDuplicates((prev) => prev.map((s) => (movedAll.has(keyOf(s)) ? { ...s, className: newClassName } : s)));

      let msg = `${toMove.length} arday ayaa laga wareejiyay ${classLabel(renaming)} → ${classLabel(newClassName)}`;
      if (staying.length) msg += `\n${staying.length} arday ayaa lagu reebay ${classLabel(renaming)} (waxay dhaceen).`;
      alert(msg);

      if (selectedClass === renaming && staying.length === 0) setSelectedClass(newClassName);
      closeRename();
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const sharedModals = (
    <>
      {renaming && (
        <RenameModal
          renaming={renaming}
          newClassName={newClassName}
          setNewClassName={setNewClassName}
          saving={saving}
          onClose={closeRename}
          onSave={saveRename}
          affectedStudents={affectedStudents}
          hasFailed={hasFailed}
          setHasFailed={setHasFailed}
          failedStudentIds={failedStudentIds}
          toggleFailedStudent={toggleFailedStudent}
          keyOf={keyOf}
        />
      )}
      {viewingStudent && (
        <StudentProfileModal student={viewingStudent} onClose={() => setViewingStudent(null)} />
      )}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: #9ca3af; }
        select option { background: #fff; color: #111827; }
        .cls-card { transition: transform .18s ease, box-shadow .18s ease; }
        .cls-card:hover { transform: translateY(-3px); box-shadow: 0 16px 34px rgba(15,23,42,0.10) !important; }
        .stu-card { transition: transform .15s ease, box-shadow .15s ease; }
        .stu-card:hover { transform: translateY(-2px); box-shadow: 0 12px 26px rgba(15,23,42,0.09) !important; }
      `}</style>
    </>
  );

  // =================== DETAIL: hal fasal ===================
  if (selectedClass) {
    const theme = classTheme(selectedClass);
    const isGraduates = selectedClass === GRADUATES_KEY;
    const ft = classList.filter((s) => s.studentType !== "Part Time").length;
    const pt = classList.length - ft;
    const free = classList.filter((s) => s.feeType === "Free").length;
    const orphans = classList.filter((s) => s.orphanStatus === "Yes").length;

    return (
      <div style={page}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ padding: "20px 24px 0" }}>
            <Topbar title="Classes" />
          </div>

          <div style={{ padding: "22px 30px 40px" }}>
            <button
              onClick={() => {
                setSelectedClass(null);
                setShowDuplicates(false);
              }}
              style={backBtn}
            >
              <ArrowLeft size={16} /> Dhammaan Fasallada
            </button>

            {/* Hero-ga fasalka */}
            <div style={{ ...detailHero, background: theme.grad }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18, flex: 1, minWidth: 260 }}>
                <div style={heroClassBadge}>
                  {isGraduates ? <GraduationCap size={30} /> : selectedClass}
                </div>
                <div>
                  <div style={heroKicker}>{theme.level.toUpperCase()}</div>
                  <h1 style={{ margin: "4px 0 2px", fontSize: 28, fontWeight: 800, color: "#fff" }}>
                    {classLabel(selectedClass)}
                  </h1>
                  <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13.5 }}>
                    {classList.length} arday oo ku jira
                  </div>
                </div>
              </div>
              {!isGraduates && (
                <button onClick={() => openRename(selectedClass)} style={heroBtn}>
                  <Pencil size={16} /> Wareeji / Edit Class
                </button>
              )}
            </div>

            {/* Stats */}
            <div style={statsRow}>
              {[
                { k: "ALL", icon: Users, v: classList.length, l: "Dhammaan" },
                { k: "Full Time", icon: GraduationCap, v: ft, l: "Full Time" },
                { k: "Part Time", icon: Clock, v: pt, l: "Part Time" },
              ].map((c) => {
                const Icon = c.icon;
                const active = typeFilter === c.k;
                return (
                  <button
                    key={c.k}
                    onClick={() => setTypeFilter(c.k)}
                    style={{ ...statCard, ...(active ? { ...statCardActive, borderColor: theme.ink, background: theme.soft } : {}) }}
                  >
                    <Icon size={16} color={active ? theme.ink : "#9ca3af"} />
                    <div style={statValue}>{c.v}</div>
                    <div style={statLabel}>{c.l}</div>
                  </button>
                );
              })}
              <div style={{ ...statCard, cursor: "default" }}>
                <Layers size={16} color="#9ca3af" />
                <div style={statValue}>{free}</div>
                <div style={statLabel}>Free</div>
              </div>
              <div style={{ ...statCard, cursor: "default" }}>
                <Heart size={16} color="#9ca3af" />
                <div style={statValue}>{orphans}</div>
                <div style={statLabel}>Agoon</div>
              </div>
            </div>

            {/* Toolbar */}
            <div style={toolbar}>
              <div style={searchWrap}>
                <Search size={16} color="#9ca3af" />
                <input
                  placeholder="Raadi magac, ID ama telefoon..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={searchInput}
                />
              </div>
              {classDuplicates.length > 0 && (
                <button onClick={() => setShowDuplicates((v) => !v)} style={dupToggle}>
                  {showDuplicates ? <EyeOff size={15} /> : <Eye size={15} />}
                  {showDuplicates ? "Qari" : "Muuji"} {classDuplicates.length} labanlaab
                </button>
              )}
            </div>

            {classDuplicates.length > 0 && !showDuplicates && (
              <div style={dupNotice}>
                <Copy size={15} />
                {classDuplicates.length} arday oo labanlaab ah (laba jeer la diiwaan geliyay) ayaa
                laga qariyay liiskan. Si joogto ah uga saar Student List.
              </div>
            )}

            {/* Student cards */}
            {loading ? (
              <p style={{ color: "#6b7280" }}>Loading...</p>
            ) : visibleStudents.length === 0 ? (
              <div style={emptyBox}>
                {isGraduates ? "Wax arday ah weli looma wareejin qaybtan." : "Wax arday ah lama helin."}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
                {visibleStudents.map((s) => {
                  const isDup = Boolean(s.duplicateOfId);
                  return (
                    <div
                      key={keyOf(s)}
                      className="stu-card"
                      onClick={() => setViewingStudent(s)}
                      style={{ ...stuCard, ...(isDup ? stuCardDup : {}) }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <Avatar student={s} size={54} radius={16} ring={theme.soft} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={stuName}>{s.fullName || "—"}</div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, fontWeight: 600 }}>
                            ID {s.studentId || s.id}
                          </div>
                        </div>
                        <ChevronRight size={16} color="#d1d5db" />
                      </div>

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                        <span style={{ ...chip, ...(s.studentType === "Part Time" ? chipBlue : chipGreen) }}>
                          {s.studentType || "Full Time"}
                        </span>
                        <span style={{ ...chip, ...(s.feeType === "Free" ? chipAmber : {}) }}>
                          {s.feeType === "Free" ? "Free" : `$${s.monthlyFee || 0}/bishii`}
                        </span>
                        {s.orphanStatus === "Yes" && <span style={chipRose}>Agoon</span>}
                        {isDup && <span style={chipRose}>Labanlaab</span>}
                      </div>

                      <div style={stuMeta}>
                        <span style={metaItem}>
                          <Phone size={12} color="#9ca3af" /> {s.parentPhone || "—"}
                        </span>
                        <span style={metaItem}>
                          <Clock size={12} color="#9ca3af" /> {s.shift || "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {sharedModals}
      </div>
    );
  }

  // =================== OVERVIEW: dhammaan fasallada ===================
  return (
    <div style={page}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Classes" />
        </div>

        <div style={{ padding: "22px 30px 40px" }}>
          <div style={overviewHero}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={heroKicker}>RISING STAR SCHOOL</div>
              <h1 style={{ margin: "6px 0 4px", fontSize: 28, fontWeight: 800, color: "#fff" }}>Fasallada</h1>
              <p style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.85)" }}>
                Riix fasal si aad u aragto ardayda. Ardayda F4 ee qalin-jabisay u wareeji "{GRADUATES_KEY}".
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={heroStat}>
                <div style={heroStatValue}>{totalActive}</div>
                <div style={heroStatLabel}>Arday</div>
              </div>
              <div style={heroStat}>
                <div style={heroStatValue}>{classGroups.filter(([n, l]) => n !== GRADUATES_KEY && l.length).length}</div>
                <div style={heroStatLabel}>Fasal firfircoon</div>
              </div>
              <div style={heroStat}>
                <div style={heroStatValue}>{graduatesTotal}</div>
                <div style={heroStatLabel}>Qalin Jabis</div>
              </div>
            </div>
          </div>

          {duplicates.length > 0 && (
            <div style={{ ...dupNotice, marginTop: 18 }}>
              <Copy size={15} />
              {duplicates.length} arday oo labanlaab ah ayaa laga qariyay fasallada si aysan dib ugu soo noqon.
            </div>
          )}

          {loading ? (
            <p style={{ color: "#6b7280", marginTop: 20 }}>Loading...</p>
          ) : (
            <>
              {[
                { title: "Primary", items: classGroups.filter(([n]) => !String(n).startsWith("F") && n !== GRADUATES_KEY) },
                { title: "Secondary", items: classGroups.filter(([n]) => String(n).startsWith("F")) },
                { title: "Qalin Jabis", items: classGroups.filter(([n]) => n === GRADUATES_KEY) },
              ].map((sec) =>
                sec.items.length === 0 ? null : (
                  <div key={sec.title}>
                    <div style={sectionHead}>
                      <span>{sec.title}</span>
                      <span style={sectionCount}>
                        {sec.items.reduce((sum, [, l]) => sum + l.length, 0)} arday
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 18 }}>
                      {sec.items.map(([className, list]) => {
                        const theme = classTheme(className);
                        const isGraduates = className === GRADUATES_KEY;
                        const ft = list.filter((s) => s.studentType !== "Part Time").length;
                        const pt = list.length - ft;
                        const pct = Math.round((list.length / maxClassSize) * 100);
                        return (
                          <div
                            key={className}
                            className="cls-card"
                            style={classCard}
                            onClick={() => {
                              setSelectedClass(className);
                              setSearch("");
                              setTypeFilter("ALL");
                            }}
                          >
                            <div style={{ ...classBand, background: theme.grad }}>
                              <div style={classBadge}>
                                {isGraduates ? <GraduationCap size={26} /> : className}
                              </div>
                              <span style={levelChip}>{theme.level}</span>
                            </div>

                            <div style={{ padding: "14px 18px 16px" }}>
                              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827" }}>
                                  {classLabel(className)}
                                </h3>
                                <span style={{ fontSize: 22, fontWeight: 800, color: theme.ink }}>{list.length}</span>
                              </div>
                              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                                {ft} Full Time · {pt} Part Time
                              </div>

                              <div style={barTrack}>
                                <div style={{ ...barFill, width: `${pct}%`, background: theme.grad }} />
                              </div>

                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                                <AvatarStack list={list} />
                                {!isGraduates && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openRename(className);
                                    }}
                                    style={{ ...miniEditBtn, color: theme.ink, background: theme.soft }}
                                  >
                                    <Pencil size={13} /> Edit
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
      {sharedModals}
    </div>
  );
}

// =====================================================================
function RenameModal({
  renaming,
  newClassName,
  setNewClassName,
  saving,
  onClose,
  onSave,
  affectedStudents,
  hasFailed,
  setHasFailed,
  failedStudentIds,
  toggleFailedStudent,
  keyOf,
}) {
  const movingCount = affectedStudents.length - failedStudentIds.size;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <School size={20} color="#16a34a" />
            <h2 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Wareeji {classLabel(renaming)}</h2>
          </div>
          <button onClick={onClose} style={closeBtn}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "22px 26px", maxHeight: "62vh", overflowY: "auto" }}>
          <label style={label}>U guuri ardayda fasalka:</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))", gap: 8 }}>
            {renameTargetOptions.map((c) => {
              const active = newClassName === c;
              const disabled = c === renaming;
              return (
                <button
                  key={c}
                  type="button"
                  disabled={disabled}
                  onClick={() => setNewClassName(c)}
                  style={{
                    ...classPick,
                    ...(c === GRADUATES_KEY ? { gridColumn: "span 2" } : {}),
                    ...(active ? classPickActive : {}),
                    ...(disabled ? { opacity: 0.35, cursor: "not-allowed" } : {}),
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 22 }}>
            <label style={label}>Ma jiraa arday dhacay?</label>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setHasFailed(true)} style={hasFailed === true ? yesNoActive : yesNo}>
                Haa
              </button>
              <button type="button" onClick={() => setHasFailed(false)} style={hasFailed === false ? yesNoActive : yesNo}>
                Maya
              </button>
            </div>
          </div>

          {hasFailed === true && (
            <div style={{ marginTop: 18 }}>
              <label style={label}>Dooro ardayda dhacay — waxay ku hadhayaan {classLabel(renaming)}</label>
              <div style={failList}>
                {affectedStudents.length === 0 ? (
                  <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Fasalkan arday kuma jiraan.</p>
                ) : (
                  affectedStudents.map((s) => {
                    const k = keyOf(s);
                    const checked = failedStudentIds.has(k);
                    return (
                      <label key={k} style={{ ...failRow, ...(checked ? failRowOn : {}) }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFailedStudent(k)}
                          style={{ accentColor: "#dc2626", width: 16, height: 16 }}
                        />
                        <Avatar student={s} size={30} radius={999} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>{s.fullName || "—"}</div>
                          <div style={{ fontSize: 11.5, color: "#6b7280" }}>ID {s.studentId || s.id}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div style={summaryBox}>
            {hasFailed === true
              ? `${movingCount} arday ayaa loo wareejin doonaa ${classLabel(newClassName)}; ${failedStudentIds.size} ayaa ku hadhaya ${classLabel(renaming)}.`
              : `Dhammaan ${affectedStudents.length} arday ee ${classLabel(renaming)} ayaa loo wareejin doonaa ${classLabel(newClassName)}.`}
          </div>
        </div>

        <div style={modalFooter}>
          <button onClick={onClose} style={cancelBtn}>
            Iska daa
          </button>
          <button onClick={onSave} disabled={saving} style={saveBtn}>
            {saving ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Kaydinaya...
              </>
            ) : (
              <>
                <Save size={16} /> Kaydi
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentProfileModal({ student, onClose }) {
  const theme = classTheme(student.className);
  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modal, maxWidth: 560, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ background: theme.grad, padding: "22px 24px 50px", position: "relative" }}>
          <button onClick={onClose} style={{ ...closeBtn, position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.2)", color: "#fff" }}>
            <X size={18} />
          </button>
          <div style={heroKicker}>{classLabel(student.className || "—").toUpperCase()}</div>
        </div>
        <div style={{ padding: "0 24px", marginTop: -40, display: "flex", alignItems: "flex-end", gap: 14 }}>
          <Avatar student={student} size={84} radius={22} />
          <div style={{ paddingBottom: 6 }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#111827" }}>{student.fullName || "—"}</div>
            <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 2 }}>
              ID {student.studentId || student.id} · {student.studentType || "Full Time"}
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 24px 6px", maxHeight: "50vh", overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <ProfileField label="Magaca Hooyada" value={student.motherName} />
            <ProfileField label="Shift" value={student.shift} />
            <ProfileField label="Fee Type" value={student.feeType} />
            <ProfileField label="Lacagta Bishii" value={student.monthlyFee !== undefined && student.monthlyFee !== "" ? `$${student.monthlyFee}` : ""} />
            <ProfileField label="Tel Waalidka" value={student.parentPhone} />
            <ProfileField label="Tel Ardayga" value={student.studentPhone} />
            <ProfileField label="Degmada" value={student.district} />
            <ProfileField label="Dugsiga Hore" value={student.previousSchool} />
            <ProfileField label="Agoon" value={student.orphanStatus} />
          </div>
        </div>

        <div style={modalFooter}>
          <button onClick={onClose} style={cancelBtn}>
            Xir
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label: l, value }) {
  return (
    <div style={{ background: "#f9fafb", border: "1px solid #eef0f2", borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", color: "#9ca3af", textTransform: "uppercase" }}>{l}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginTop: 3 }}>{value || "—"}</div>
    </div>
  );
}

// =====================================================================
// STYLES
// =====================================================================
const page = { display: "flex", minHeight: "100vh", background: "#f3f6f4" };

const overviewHero = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 18,
  padding: "26px 30px",
  borderRadius: 22,
  background: "linear-gradient(120deg,#16a34a,#15803d 60%,#166534)",
  boxShadow: "0 14px 30px rgba(22,163,74,0.25)",
};

const detailHero = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 18,
  padding: "24px 28px",
  borderRadius: 22,
  marginTop: 16,
  boxShadow: "0 14px 30px rgba(15,23,42,0.15)",
};

const heroKicker = { fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: "rgba(255,255,255,0.8)" };

const heroClassBadge = {
  width: 72,
  height: 72,
  minWidth: 72,
  borderRadius: 20,
  background: "rgba(255,255,255,0.18)",
  border: "1.5px solid rgba(255,255,255,0.35)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 28,
  fontWeight: 800,
};

const heroStat = {
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: 14,
  padding: "10px 18px",
  textAlign: "center",
  minWidth: 80,
};
const heroStatValue = { fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.1 };
const heroStatLabel = { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 600 };

const heroBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#fff",
  color: "#111827",
  border: "none",
  padding: "12px 18px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 14,
};

const backBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#fff",
  border: "1.5px solid #e5e7eb",
  color: "#374151",
  padding: "9px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

const sectionHead = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  margin: "28px 2px 14px",
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#111827",
};
const sectionCount = {
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "none",
  color: "#6b7280",
  background: "#fff",
  border: "1px solid #e5e7eb",
  padding: "3px 10px",
  borderRadius: 999,
};

const classCard = {
  background: "#fff",
  borderRadius: 20,
  border: "1px solid #e5e7eb",
  overflow: "hidden",
  boxShadow: "0 6px 18px rgba(15,23,42,0.05)",
  cursor: "pointer",
};
const classBand = {
  height: 86,
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 18px",
};
const classBadge = {
  width: 56,
  height: 56,
  borderRadius: 16,
  background: "rgba(255,255,255,0.2)",
  border: "1.5px solid rgba(255,255,255,0.4)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  fontWeight: 800,
};
const levelChip = {
  alignSelf: "flex-start",
  marginTop: 14,
  background: "rgba(255,255,255,0.22)",
  color: "#fff",
  fontSize: 11,
  fontWeight: 800,
  padding: "4px 10px",
  borderRadius: 999,
};
const barTrack = { height: 6, background: "#f3f4f6", borderRadius: 999, marginTop: 12, overflow: "hidden" };
const barFill = { height: "100%", borderRadius: 999 };
const miniEditBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  border: "none",
  padding: "7px 12px",
  borderRadius: 9,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

const statsRow = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, margin: "18px 0" };
const statCard = { textAlign: "left", background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: "12px 14px", cursor: "pointer" };
const statCardActive = { boxShadow: "0 6px 16px rgba(15,23,42,0.08)" };
const statValue = { fontSize: 22, fontWeight: 800, color: "#111827", marginTop: 6 };
const statLabel = { fontSize: 11.5, color: "#6b7280", fontWeight: 600 };

const toolbar = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  marginBottom: 12,
};
const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flex: "1 1 260px",
  padding: "0 14px",
  borderRadius: 10,
  border: "1.5px solid #e5e7eb",
  background: "#f9fafb",
};
const searchInput = { flex: 1, padding: "11px 0", border: "none", outline: "none", background: "transparent", color: "#111827", fontSize: 13.5 };
const dupToggle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  background: "#fff7ed",
  border: "1.5px solid #fed7aa",
  color: "#c2410c",
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const dupNotice = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 13,
  marginBottom: 14,
};

const emptyBox = { background: "#fff", border: "1px dashed #d1d5db", borderRadius: 14, padding: 30, textAlign: "center", color: "#6b7280" };

const stuCard = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 14,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(15,23,42,0.04)",
};
const stuCardDup = { border: "1.5px dashed #fca5a5", background: "#fffafa" };
const stuName = { fontSize: 14.5, fontWeight: 800, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const stuMeta = { display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "1px solid #f3f4f6" };
const metaItem = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#4b5563", fontWeight: 600 };

const chip = { background: "#f3f4f6", color: "#4b5563", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" };
const chipGreen = { background: "#dcfce7", color: "#15803d" };
const chipBlue = { background: "#e0f2fe", color: "#0369a1" };
const chipAmber = { background: "#fef3c7", color: "#b45309" };
const chipRose = { ...chip, background: "#ffe4e6", color: "#be123c" };

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
};
const modal = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  width: "100%",
  maxWidth: 520,
  maxHeight: "92vh",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
};
const modalHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #e5e7eb" };
const modalFooter = { display: "flex", justifyContent: "flex-end", gap: 12, padding: "16px 24px", borderTop: "1px solid #e5e7eb" };
const closeBtn = {
  background: "#f3f4f6",
  border: "none",
  color: "#374151",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
const label = { display: "block", fontSize: 13.5, fontWeight: 700, color: "#111827", marginBottom: 10 };
const classPick = {
  padding: "11px 0",
  borderRadius: 10,
  border: "1.5px solid #e5e7eb",
  background: "#f9fafb",
  color: "#374151",
  fontWeight: 800,
  fontSize: 13.5,
  cursor: "pointer",
};
const classPickActive = { border: "1.5px solid #16a34a", background: "#16a34a", color: "#fff" };
const yesNo = {
  flex: 1,
  padding: "11px 0",
  borderRadius: 10,
  border: "1.5px solid #e5e7eb",
  background: "#f9fafb",
  color: "#374151",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
};
const yesNoActive = { ...yesNo, background: "#16a34a", border: "1.5px solid #16a34a", color: "#fff" };
const failList = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxHeight: 240,
  overflowY: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 10,
};
const failRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #f3f4f6",
  background: "#fff",
  cursor: "pointer",
};
const failRowOn = { background: "#fef2f2", border: "1px solid #fecaca" };
const summaryBox = {
  marginTop: 18,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 13,
  lineHeight: 1.5,
};
const cancelBtn = {
  background: "#f9fafb",
  border: "1.5px solid #e5e7eb",
  color: "#374151",
  padding: "11px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13.5,
};
const saveBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#16a34a,#15803d)",
  color: "#fff",
  border: "none",
  padding: "11px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13.5,
};