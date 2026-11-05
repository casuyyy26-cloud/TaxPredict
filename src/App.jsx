import { AppProvider, useApp } from "./context/AppContext";
import LoginPage from "./pages/LoginPage";
import LguLayout from "./pages/lgu/LguLayout";
import Create_Signup_Visitor from "./pages/Visitor/Create_Signup_Visitor";
import Create_Signup_Admin from "./pages/Admin/Create_Signup_Admin";

function Router() {
  const { screen, currentUser, isAdmin } = useApp();

  // Public screens accessible before login
  if (screen === "signup") {
    return <Create_Signup_Visitor />;
  }
  if (screen === "login" || !currentUser) {
    return <LoginPage />;
  }

  // Admin-only account creation / management screen
  if (screen === "adminSignup") {
    return isAdmin ? <Create_Signup_Admin /> : <LguLayout />;
  }

  // Authenticated portal (Admin, BPLO Officer, or Guest)
  switch (screen) {
    case "lgu":
    case "admin":
    case "guest":
      return <LguLayout />;
    default:
      return <LguLayout />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}