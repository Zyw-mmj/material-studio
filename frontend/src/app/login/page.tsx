import { LoginPanel } from "@/components/auth-provider";
export default function LoginPage() {
  return (
    <main id="main-content" tabIndex={-1} className="page-shell identity-page">
      <LoginPanel />
    </main>
  );
}
