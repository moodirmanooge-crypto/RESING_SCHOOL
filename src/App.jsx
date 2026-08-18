// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MessagesProvider } from "./context/MessagesContext";

import Home from "./pages/Home";
import About from "./pages/About";
import Admissions from "./pages/Admissions";
import Academics from "./pages/Academics";
import Gallery from "./pages/Gallery";
import News from "./pages/News";
import Contact from "./pages/Contact";
import Library from "./pages/Library";
import Login from "./pages/Login";

// ADMIN
import Dashboard from "./admin/pages/Dashboard";
import AddStudent from "./admin/pages/AddStudent";
import Students from "./admin/pages/Students";
import Teachers from "./admin/pages/Teachers";
import Parents from "./admin/pages/Parents";
import Classes from "./admin/pages/Classes";
import Attendance from "./admin/pages/Attendance";
import Exams from "./admin/pages/Exams";
import Timetable from "./admin/pages/Timetable";
import ExamTimetable from "./admin/pages/ExamTimetable";
import Reports from "./admin/pages/Reports";
import Settings from "./admin/pages/Settings";
import BulkRegistration from "./admin/pages/BulkRegistration";
import AddTeacher from "./admin/pages/AddTeacher";
import AddCashier from "./admin/pages/AddCashier";
import Cashiers from "./admin/pages/Cashiers";
import Messages from "./admin/pages/Messages";
import EditTeacher from "./admin/pages/EditTeacher";
import Shifts from "./admin/pages/Shifts";
import Certificates from "./admin/pages/Certificates";
import ResultsByClass from "./admin/pages/ResultsByClass";
import Holidays from "./admin/pages/Holidays";
import GalleryManager from "./admin/pages/GalleryManager";
import NewsManager from "./admin/pages/NewsManager";
import AddSubAdmin from "./admin/pages/AddSubAdmin";
import ManageAdmins from "./admin/pages/ManageAdmins";
import AdmissionsList from "./admin/pages/AdmissionsList";
import LibraryManager from "./admin/pages/LibraryManager";
import UploadCertificate from "./admin/pages/UploadCertificate";

// STUDENT / PARENT
import StudentDashboard from "./student/Dashboard";
import ParentDashboard from "./parent/Dashboard";

// TEACHER
import TeacherDashboard from "./teacher/Dashboard";
import TeacherAttendance from "./teacher/Attendance";
import TeacherExams from "./teacher/Exams";
import TeacherStudents from "./teacher/Students";
import TeacherResults from "./teacher/Results";
import TeacherProfile from "./teacher/Profile";
import TeacherMessages from "./teacher/Messages";
import TeacherTimetable from "./teacher/ViewTimetable";

// CASHIER
import CashierLayout from "./cashier/Layout";
import CashierDashboard from "./cashier/Dashboard";
import CashierPayments from "./cashier/Payments";
import CashierReports from "./cashier/Reports";
import CashierProfile from "./cashier/Profile";
import ReceiptModal from "./cashier/ReceiptModal";
import ExamCards from "./admin/pages/ExamCards";
import ExamPayments from "./cashier/ExamPayments";
import Receipts from "./admin/pages/Receipts";
import AllIdCards from "./admin/pages/AllIdCards";

// PUBLIC
import VerifyCertificate from "./pages/VerifyCertificate";
import TeacherVerify from "./pages/TeacherVerify";
import PendingDeletions from "./admin/pages/Pendingdeletions";
import StudentIdVerify from "./pages/StudentIdVerify";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/verify/student/:studentId" element={<StudentIdVerify />} />
        <Route path="/admin/pending-deletions" element={<PendingDeletions />} />
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/admissions" element={<Admissions />} />
        <Route path="/academics" element={<Academics />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/news" element={<News />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/library" element={<Library />} />
        <Route path="/admin/receipts" element={<Receipts />} />
        <Route path="/admin-login" element={<Login role="Admin" />} />
        <Route path="/teacher-login" element={<Login role="Teacher" />} />
        <Route path="/student-login" element={<Login role="Student" />} />
        <Route path="/parent-login" element={<Login role="Parent" />} />
        <Route path="/cashier-login" element={<Login role="Cashier" />} />
        <Route path="/cashier/receipts" element={<CashierReports />} />
        <Route path="/admin/exam-cards" element={<ExamCards />} />
        <Route path="/admin/id-cards" element={<AllIdCards />} />
        <Route path="/admin/results-by-class" element={<ResultsByClass />} />
        <Route path="/admin/holidays" element={<Holidays />} />
        <Route path="/admin/gallery" element={<GalleryManager />} />
        <Route path="/admin/news" element={<NewsManager />} />
        <Route path="/admin/add-sub-admin" element={<AddSubAdmin />} />
        <Route path="/admin/manage-admins" element={<ManageAdmins />} />
        <Route path="/admin/library" element={<LibraryManager />} />

        {/* Admin page for uploading the single photo/video shown on the
            public homepage hero section — writes to the
            `settings/homepage` Firestore doc that Home.jsx reads live. */}
        <Route path="/admin/upload-certificate" element={<UploadCertificate />} />

        {/* Admin view of all admission applications submitted from the
            public /admissions page — lists every applicant, shows a
            pending-count badge in the sidebar, and lets the admin
            approve a submission. */}
        <Route path="/admin/admissions" element={<AdmissionsList />} />

        {/* Public certificate verification page — QR code on the Class 8
            leaving certificate links here. No login required. */}
        <Route path="/verify/:certificateId" element={<VerifyCertificate />} />

        {/* Public teacher ID verification page — QR code on the Teacher
            ID card (front + back) links here. No login required. Reads
            the teacher_id/{teacherUsername} Firestore snapshot and shows
            the same details printed on the card. */}
        <Route path="/verify/teacher/:teacherUsername" element={<TeacherVerify />} />

        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/parent/dashboard" element={<ParentDashboard />} />
        <Route path="/cashier/exam-payments" element={<ExamPayments />} />

        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/add-student" element={<AddStudent />} />
        <Route path="/admin/bulk-registration" element={<BulkRegistration />} />
        <Route path="/admin/add-teacher" element={<AddTeacher />} />
        <Route path="/admin/add-cashier" element={<AddCashier />} />
        <Route path="/admin/cashiers" element={<Cashiers />} />
        <Route path="/admin/edit-teacher/:username" element={<EditTeacher />} />

        <Route path="/admin/students" element={<Students />} />
        <Route path="/admin/teachers" element={<Teachers />} />
        <Route path="/admin/parents" element={<Parents />} />
        <Route path="/admin/classes" element={<Classes />} />
        <Route path="/admin/attendance" element={<Attendance />} />
        <Route path="/admin/exams" element={<Exams />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/settings" element={<Settings />} />
        <Route path="/admin/messages" element={<Messages />} />
        <Route path="/admin/timetable" element={<Timetable />} />
        <Route path="/admin/exam-timetable" element={<ExamTimetable />} />
        <Route path="/admin/shifts" element={<Shifts />} />

        {/* Class 8 Leaving Certificates — admin generates/manages them here */}
        <Route path="/admin/certificates" element={<Certificates />} />

        {/* Dhammaan boggagga Teacher waxay ku jiraan MessagesProvider hal mar,
            si Sidebar/Topbar/Messages ay isku wadaagaan xogta fariimaha.
            /teacher/timetable sidoo kale waa in lagu duubaa MessagesProvider
            maxaa yeelay Sidebar.jsx wuxuu isticmaalaa useMessages(). */}
        <Route
          path="/teacher/dashboard"
          element={
            <MessagesProvider>
              <TeacherDashboard />
            </MessagesProvider>
          }
        />
        <Route
          path="/teacher/attendance"
          element={
            <MessagesProvider>
              <TeacherAttendance />
            </MessagesProvider>
          }
        />
        <Route
          path="/teacher/messages"
          element={
            <MessagesProvider>
              <TeacherMessages />
            </MessagesProvider>
          }
        />
        <Route
          path="/teacher/exams"
          element={
            <MessagesProvider>
              <TeacherExams />
            </MessagesProvider>
          }
        />
        <Route
          path="/teacher/students"
          element={
            <MessagesProvider>
              <TeacherStudents />
            </MessagesProvider>
          }
        />
        <Route
          path="/teacher/results"
          element={
            <MessagesProvider>
              <TeacherResults />
            </MessagesProvider>
          }
        />
        <Route
          path="/teacher/profile"
          element={
            <MessagesProvider>
              <TeacherProfile />
            </MessagesProvider>
          }
        />
        <Route
          path="/teacher/timetable"
          element={
            <MessagesProvider>
              <TeacherTimetable />
            </MessagesProvider>
          }
        />

        <Route path="/cashier" element={<CashierLayout />}>
          <Route index element={<CashierDashboard />} />
          <Route path="dashboard" element={<CashierDashboard />} />
          <Route path="payments" element={<CashierPayments />} />
          <Route path="reports" element={<CashierReports />} />
          <Route path="profile" element={<CashierProfile />} />
          <Route path="receipts" element={<CashierReports />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;